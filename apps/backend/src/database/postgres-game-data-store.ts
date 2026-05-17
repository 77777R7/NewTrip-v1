import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool, PoolClient, QueryResultRow } from 'pg';
import {
  AuthIdentity,
  CURRENCIES,
  Currency,
  AbandonTripInput,
  ClaimOfflineReportInput,
  ClaimOfflineReportResult,
  CompleteLandmarkInput,
  CompleteLandmarkResult,
  CompleteRouteInput,
  CompleteRouteResult,
  DriveTickInput,
  DriveTickResult,
  GameDataStore,
  Landmark,
  OfflineReport,
  PlayerProfile,
  PlayerPhoto,
  PlayerState,
  PlayerVehicle,
  RouteDefinition,
  RouteUnlockResult,
  RouteSegment,
  StartTripInput,
  Trip,
  UnlockRouteInput,
  VehicleMaintenanceInput,
  VehicleMaintenanceResult,
  WalletBalance,
  WalletMutationInput,
  WalletTransaction,
} from './game-data-store';
import { calculatePhotoQualityScore } from '../modules/landmark/photo-quality';
import { simulateOfflineProgress } from '../modules/simulation/offline-progress';
import { DEFAULT_SIMULATION_CONFIG } from '../modules/simulation/simulation.constants';
import { isOnlineDriveModeUnlocked, simulateOnlineDriveTick } from '../modules/simulation/online-drive-tick';
import { nextTutorialStateAfterDriveTick, nextTutorialStateAfterPhoto } from '../modules/tutorial/tutorial-state';
import { calculateVehicleMaintenance } from '../modules/vehicle-maintenance/maintenance.formulas';

const TUTORIAL_COMPLETION_REWARDS = {
  roadCoins: 150,
  travelTokens: 1,
  souvenirStamps: 1,
};

@Injectable()
export class PostgresGameDataStore implements GameDataStore, OnModuleDestroy {
  private readonly pool: Pool;

  constructor(configService: ConfigService) {
    const connectionString = configService.get<string>('DATABASE_URL');
    if (!connectionString) {
      throw new Error('DATABASE_URL is required for PostgresGameDataStore');
    }

    this.pool = new Pool({
      connectionString,
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }

  async getOrCreatePlayerState(identity: AuthIdentity): Promise<PlayerState> {
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      const profile = await this.getOrCreatePlayerProfileInTransaction(client, identity);
      await this.ensurePlayerDefaultsInTransaction(client, profile.playerId);
      const pendingOfflineReport = await this.getOrCreatePendingOfflineReportInTransaction(client, profile);
      await this.touchPlayerLastSeenInTransaction(client, profile.playerId);
      const state = await this.loadPlayerStateInTransaction(client, profile.playerId);
      await client.query('commit');
      return {
        ...state,
        pendingOfflineReport,
      };
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
  }

  async getOrCreatePlayerProfile(identity: AuthIdentity): Promise<PlayerProfile> {
    const state = await this.getOrCreatePlayerState(identity);
    return state.profile;
  }

  async getWalletBalances(playerId: string): Promise<WalletBalance[]> {
    const result = await this.pool.query(
      `
        select currency, balance
        from public.wallet_balances
        where player_id = $1
        order by array_position($2::text[], currency)
      `,
      [playerId, CURRENCIES],
    );

    return result.rows.map((row) => this.toWalletBalance(row));
  }

  async grantWallet(input: WalletMutationInput): Promise<WalletTransaction> {
    if (input.amount <= 0) {
      throw new Error('Grant amount must be positive');
    }
    return this.mutateWallet(input, input.amount);
  }

  async spendWallet(input: WalletMutationInput): Promise<WalletTransaction> {
    if (input.amount <= 0) {
      throw new Error('Spend amount must be positive');
    }
    return this.mutateWallet(input, -input.amount);
  }

  async getAvailableRoutes(identity: AuthIdentity): Promise<RouteDefinition[]> {
    const state = await this.getOrCreatePlayerState(identity);
    if (!this.hasFullRouteAccess(state.profile)) {
      const tutorialRoute = await this.pool.query(
        `
          select rd.*, true as is_unlocked
          from public.route_definitions rd
          join public.config_versions cv on cv.config_version_id = rd.config_version_id
          where cv.status = 'LIVE' and rd.route_type = 'Tutorial' and rd.is_active = true
          order by rd.created_at asc
        `,
      );
      return tutorialRoute.rows.map((row) => this.toRouteDefinition(row));
    }

    const routes = await this.pool.query(
      `
        select
          rd.*,
          (rd.route_type = 'Tutorial' or pur.player_id is not null) as is_unlocked
        from public.route_definitions rd
        join public.config_versions cv on cv.config_version_id = rd.config_version_id
        left join public.player_unlocked_routes pur
          on pur.route_id = rd.route_id and pur.player_id = $1
        where cv.status = 'LIVE'
          and rd.is_active = true
          and (rd.route_type = 'Tutorial' or pur.player_id is not null)
        order by rd.difficulty asc, rd.total_distance_km asc
      `,
      [state.profile.playerId],
    );

    return routes.rows.map((row) => this.toRouteDefinition(row));
  }

  async getRoute(identity: AuthIdentity, routeId: string): Promise<RouteDefinition | null> {
    const state = await this.getOrCreatePlayerState(identity);
    const route = await this.pool.query(
      `
        select
          rd.*,
          (rd.route_type = 'Tutorial' or pur.player_id is not null) as is_unlocked
        from public.route_definitions rd
        join public.config_versions cv on cv.config_version_id = rd.config_version_id
        left join public.player_unlocked_routes pur
          on pur.route_id = rd.route_id and pur.player_id = $1
        where cv.status = 'LIVE'
          and rd.is_active = true
          and (rd.route_id::text = $2 or rd.route_key = $2)
        limit 1
      `,
      [state.profile.playerId, routeId],
    );

    if (!route.rowCount) {
      return null;
    }

    return this.loadRouteDetails(this.toRouteDefinition(route.rows[0]));
  }

  async unlockRoute(identity: AuthIdentity, input: UnlockRouteInput): Promise<RouteUnlockResult> {
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      const profile = await this.getOrCreatePlayerProfileInTransaction(client, identity);
      await this.ensurePlayerDefaultsInTransaction(client, profile.playerId);

      const existingForKey = await client.query(
        `
          select result_payload
          from public.route_unlock_actions
          where player_id = $1 and idempotency_key = $2
          limit 1
          for update
        `,
        [profile.playerId, input.idempotencyKey],
      );
      if (existingForKey.rowCount) {
        await client.query('commit');
        return existingForKey.rows[0].result_payload as RouteUnlockResult;
      }

      const routeResult = await client.query(
        `
          select
            rd.*,
            (rd.route_type = 'Tutorial' or pur.player_id is not null) as is_unlocked
          from public.route_definitions rd
          join public.config_versions cv on cv.config_version_id = rd.config_version_id
          left join public.player_unlocked_routes pur
            on pur.route_id = rd.route_id and pur.player_id = $1
          where cv.status = 'LIVE'
            and rd.is_active = true
            and (rd.route_id::text = $2 or rd.route_key = $2)
          limit 1
        `,
        [profile.playerId, input.routeId],
      );
      if (!routeResult.rowCount) {
        throw new Error('ROUTE_NOT_FOUND');
      }

      const route = this.toRouteDefinition(routeResult.rows[0]);
      if (route.routeType !== 'Tutorial' && !this.hasFullRouteAccess(profile)) {
        throw new Error('ROUTE_LOCKED');
      }

      if (route.routeType === 'Tutorial' || route.isUnlocked) {
        const result: RouteUnlockResult = {
          route: await this.getRouteForTripInTransaction(client, profile.playerId, route.routeId) ?? route,
          costStamps: 0,
          walletBalances: await this.getWalletBalancesInTransaction(client, profile.playerId),
          walletTransactions: [],
        };
        await client.query('commit');
        return result;
      }

      const walletTransactions: WalletTransaction[] = [];
      let stampTxId: string | null = null;
      if (route.unlockCostStamps > 0) {
        const stampTx = await this.mutateWalletInTransaction(client, {
          playerId: profile.playerId,
          currency: 'SOUVENIR_STAMPS',
          amount: route.unlockCostStamps,
          reason: 'ROUTE_UNLOCK',
          sourceType: 'ROUTE_UNLOCK',
          sourceId: route.routeId,
          idempotencyKey: `${input.idempotencyKey}:souvenir_stamps`,
        }, -route.unlockCostStamps);
        walletTransactions.push(stampTx);
        stampTxId = stampTx.transactionId;
      }

      await client.query(
        `
          insert into public.player_unlocked_routes (
            player_id,
            route_id,
            unlocked_by,
            cost_stamps
          )
          values ($1, $2, 'SOUVENIR_STAMPS', $3)
          on conflict (player_id, route_id) do nothing
        `,
        [profile.playerId, route.routeId, route.unlockCostStamps],
      );

      const unlockedRoute = await this.getRouteForTripInTransaction(client, profile.playerId, route.routeId);
      const result: RouteUnlockResult = {
        route: unlockedRoute ?? { ...route, isUnlocked: true },
        costStamps: route.unlockCostStamps,
        walletBalances: await this.getWalletBalancesInTransaction(client, profile.playerId),
        walletTransactions,
      };

      await client.query(
        `
          insert into public.route_unlock_actions (
            player_id,
            route_id,
            idempotency_key,
            cost_stamps,
            wallet_transaction_id,
            result_payload
          )
          values ($1, $2, $3, $4, $5, $6::jsonb)
        `,
        [
          profile.playerId,
          route.routeId,
          input.idempotencyKey,
          route.unlockCostStamps,
          stampTxId,
          JSON.stringify(result),
        ],
      );

      await client.query('commit');
      return result;
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
  }

  async getCurrentTrip(identity: AuthIdentity): Promise<Trip | null> {
    const state = await this.getOrCreatePlayerState(identity);
    const trip = await this.pool.query(
      `
        select *
        from public.player_trips
        where player_id = $1 and status in ('ACTIVE', 'PAUSED', 'FORCED_STOP')
        order by started_at desc
        limit 1
      `,
      [state.profile.playerId],
    );

    if (!trip.rowCount) {
      return null;
    }

    return this.tripWithRoute(this.toTrip(trip.rows[0]), state.profile.playerId);
  }

  async startTrip(identity: AuthIdentity, input: StartTripInput): Promise<Trip> {
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      const profile = await this.getOrCreatePlayerProfileInTransaction(client, identity);
      await this.ensurePlayerDefaultsInTransaction(client, profile.playerId);

      const existingForKey = await client.query(
        `
          select *
          from public.player_trips
          where player_id = $1 and metadata->>'start_idempotency_key' = $2
          limit 1
        `,
        [profile.playerId, input.idempotencyKey],
      );
      if (existingForKey.rowCount) {
        await client.query('commit');
        return this.tripWithRoute(this.toTrip(existingForKey.rows[0]), profile.playerId);
      }

      const activeTrip = await client.query(
        `
          select trip_id
          from public.player_trips
          where player_id = $1 and status in ('ACTIVE', 'PAUSED', 'FORCED_STOP')
          limit 1
        `,
        [profile.playerId],
      );
      if (activeTrip.rowCount) {
        throw new Error('ACTIVE_TRIP_EXISTS');
      }

      const routeResult = await client.query(
        `
          select
            rd.*,
            (rd.route_type = 'Tutorial' or pur.player_id is not null) as is_unlocked
          from public.route_definitions rd
          join public.config_versions cv on cv.config_version_id = rd.config_version_id
          left join public.player_unlocked_routes pur
            on pur.route_id = rd.route_id and pur.player_id = $1
          where cv.status = 'LIVE'
            and rd.is_active = true
            and (rd.route_id::text = $2 or rd.route_key = $2)
          limit 1
        `,
        [profile.playerId, input.routeId],
      );
      if (!routeResult.rowCount) {
        throw new Error('ROUTE_NOT_FOUND');
      }

      const route = this.toRouteDefinition(routeResult.rows[0]);
      if (route.routeType !== 'Tutorial' && !route.isUnlocked) {
        throw new Error('ROUTE_LOCKED');
      }

      const vehicleResult = await client.query(
        `
          select *
          from public.player_vehicles
          where player_id = $1
            and (
              ($2::uuid is not null and player_vehicle_id = $2::uuid)
              or ($2::uuid is null and is_selected = true)
            )
          for update
        `,
        [profile.playerId, input.playerVehicleId ?? null],
      );
      if (!vehicleResult.rowCount) {
        throw new Error('VEHICLE_NOT_FOUND');
      }

      if (route.tripPrepFeeCoins > 0) {
        await this.mutateWalletInTransaction(client, {
          playerId: profile.playerId,
          currency: 'ROAD_COINS',
          amount: route.tripPrepFeeCoins,
          reason: 'TRIP_PREP_FEE',
          sourceType: 'ROUTE_START',
          sourceId: route.routeId,
          idempotencyKey: `${input.idempotencyKey}:trip_prep_fee`,
        }, -route.tripPrepFeeCoins);
      }

      const tripResult = await client.query(
        `
          insert into public.player_trips (
            player_id,
            route_id,
            route_config_version,
            player_vehicle_id,
            status,
            current_distance_km,
            last_simulated_at,
            metadata
          )
          values ($1, $2, $3, $4, 'ACTIVE', 0, now(), jsonb_build_object('start_idempotency_key', $5))
          returning *
        `,
        [profile.playerId, route.routeId, route.configVersionId, vehicleResult.rows[0].player_vehicle_id, input.idempotencyKey],
      );

      await client.query(
        `
          update public.player_vehicles
          set locked_in_trip_id = $2, version = version + 1
          where player_vehicle_id = $1
        `,
        [vehicleResult.rows[0].player_vehicle_id, tripResult.rows[0].trip_id],
      );

      if (profile.tutorialState === 'NOT_STARTED' && route.routeType === 'Tutorial') {
        await client.query(
          `
            update public.players
            set tutorial_state = 'ROUTE_SELECTED', updated_at = now()
            where player_id = $1
          `,
          [profile.playerId],
        );
      }

      await client.query('commit');
      return this.tripWithRoute(this.toTrip(tripResult.rows[0]), profile.playerId);
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
  }

  async abandonTrip(identity: AuthIdentity, input: AbandonTripInput): Promise<Trip> {
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      const profile = await this.getOrCreatePlayerProfileInTransaction(client, identity);
      const existingForKey = await client.query(
        `
          select *
          from public.player_trips
          where player_id = $1 and metadata->>'abandon_idempotency_key' = $2
          limit 1
        `,
        [profile.playerId, input.idempotencyKey],
      );
      if (existingForKey.rowCount) {
        await client.query('commit');
        return this.tripWithRoute(this.toTrip(existingForKey.rows[0]), profile.playerId);
      }

      const tripResult = await client.query(
        `
          select *
          from public.player_trips
          where player_id = $1
            and ($2::uuid is null or trip_id = $2::uuid)
            and status in ('ACTIVE', 'PAUSED', 'FORCED_STOP')
          order by started_at desc
          limit 1
          for update
        `,
        [profile.playerId, input.tripId ?? null],
      );
      if (!tripResult.rowCount) {
        throw new Error('ACTIVE_TRIP_NOT_FOUND');
      }

      const trip = tripResult.rows[0];
      await client.query(
        `
          update public.player_trips
          set status = 'ABANDONED',
              metadata = metadata || jsonb_build_object('abandon_idempotency_key', $2)
          where trip_id = $1
          returning *
        `,
        [trip.trip_id, input.idempotencyKey],
      );
      await client.query(
        `
          update public.player_vehicles
          set locked_in_trip_id = null, version = version + 1
          where player_vehicle_id = $1 and locked_in_trip_id = $2
        `,
        [trip.player_vehicle_id, trip.trip_id],
      );

      await client.query('commit');
      return this.tripWithRoute(this.toTrip({
        ...trip,
        status: 'ABANDONED',
        metadata: {
          ...(trip.metadata ?? {}),
          abandon_idempotency_key: input.idempotencyKey,
        },
      }), profile.playerId);
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
  }

  async driveTick(identity: AuthIdentity, input: DriveTickInput): Promise<DriveTickResult> {
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      const profile = await this.getOrCreatePlayerProfileInTransaction(client, identity);
      await this.ensurePlayerDefaultsInTransaction(client, profile.playerId);

      const existingForKey = await client.query(
        `
          select result_payload
          from public.trip_drive_ticks
          where player_id = $1 and idempotency_key = $2
          limit 1
          for update
        `,
        [profile.playerId, input.idempotencyKey],
      );
      if (existingForKey.rowCount) {
        await client.query('commit');
        return existingForKey.rows[0].result_payload as DriveTickResult;
      }

      const tripResult = await client.query(
        `
          select *
          from public.player_trips
          where player_id = $1 and trip_id = $2
          for update
        `,
        [profile.playerId, input.tripId],
      );
      if (!tripResult.rowCount) {
        throw new Error('TRIP_NOT_FOUND');
      }

      const trip = this.toTrip(tripResult.rows[0]);
      if (trip.status !== 'ACTIVE') {
        throw new Error('TRIP_NOT_ACTIVE');
      }
      if (!isOnlineDriveModeUnlocked(profile.tutorialState, input.mode)) {
        throw new Error('MODE_LOCKED');
      }

      const vehicleResult = await client.query(
        `
          select
            pv.*,
            vd.vehicle_key,
            vd.display_name,
            vd.base_speed_kmph,
            vd.fuel_capacity,
            vd.fuel_consumption_per_km,
            vd.durability_loss_per_km,
            vd.cleanliness_loss_per_km,
            vd.offline_efficiency,
            vd.weather_resistance
          from public.player_vehicles pv
          join public.vehicle_definitions vd on vd.vehicle_def_id = pv.vehicle_def_id
          where pv.player_id = $1 and pv.player_vehicle_id = $2
          for update
        `,
        [profile.playerId, trip.playerVehicleId],
      );
      if (!vehicleResult.rowCount) {
        throw new Error('VEHICLE_NOT_FOUND');
      }

      const routeResult = await client.query(
        `
          select rd.*, true as is_unlocked
          from public.route_definitions rd
          where rd.route_id = $1
          limit 1
        `,
        [trip.routeId],
      );
      if (!routeResult.rowCount) {
        throw new Error('ROUTE_NOT_FOUND');
      }

      const segmentsResult = await client.query(
        `
          select *
          from public.route_segments
          where route_id = $1
          order by segment_index asc
        `,
        [trip.routeId],
      );
      const landmarksResult = await client.query(
        `
          select *
          from public.landmarks
          where route_id = $1
          order by distance_km asc
        `,
        [trip.routeId],
      );

      const route = {
        ...this.toRouteDefinition(routeResult.rows[0]),
        segments: segmentsResult.rows.map((row) => this.toRouteSegment(row)),
        landmarks: landmarksResult.rows.map((row) => this.toLandmark(row)),
      };
      const vehicle = this.toPlayerVehicle(vehicleResult.rows[0]);
      const now = new Date();
      const simulation = simulateOnlineDriveTick({
        mode: input.mode,
        now,
        lastSimulatedAt: new Date(trip.lastSimulatedAt),
        currentDistanceKm: trip.currentDistanceKm,
        elapsedRealSeconds: trip.elapsedRealSeconds,
        previousOnlineTokenMeterKm: trip.onlineTokenMeterKm,
        routeTotalDistanceKm: route.totalDistanceKm,
        routeRewardMultiplier: route.rewardMultiplier,
        vehicle,
        segments: route.segments,
        landmarks: route.landmarks.map((landmark) => ({
          landmarkId: landmark.landmarkId,
          distanceKm: landmark.distanceKm,
          requiredStop: landmark.requiredStop,
        })),
      });
      const nextTutorialState = nextTutorialStateAfterDriveTick({
        currentState: profile.tutorialState,
        mode: input.mode,
        distanceGainKm: simulation.distanceGainKm,
        finalDistanceKm: simulation.finalDistanceKm,
        forcedStopReason: simulation.forcedStopReason,
      });

      const updatedTripResult = await client.query(
        `
          update public.player_trips
          set current_distance_km = $2,
              elapsed_real_seconds = $3,
              online_token_meter_km = $4,
              last_simulated_at = $5,
              status = $6,
              forced_stop_reason = $7,
              metadata = metadata || jsonb_build_object('last_drive_tick_seq', $8)
          where trip_id = $1
          returning *
        `,
        [
          trip.tripId,
          simulation.finalDistanceKm,
          simulation.updatedElapsedRealSeconds,
          simulation.updatedOnlineTokenMeterKm,
          now.toISOString(),
          simulation.updatedTripStatus,
          simulation.forcedStopReason,
          input.clientTickSeq,
        ],
      );

      if (nextTutorialState !== profile.tutorialState) {
        await client.query(
          `
            update public.players
            set tutorial_state = $2, updated_at = now()
            where player_id = $1
          `,
          [profile.playerId, nextTutorialState],
        );
      }

      await client.query(
        `
          update public.player_vehicles
          set current_fuel = $2,
              current_cleanliness = $3,
              current_durability = $4,
              total_distance_km = total_distance_km + $5,
              version = version + 1
          where player_vehicle_id = $1
        `,
        [
          vehicle.playerVehicleId,
          simulation.updatedFuel,
          simulation.updatedCleanliness,
          simulation.updatedDurability,
          simulation.distanceGainKm,
        ],
      );

      const updatedVehicle: PlayerVehicle = {
        ...vehicle,
        currentFuel: simulation.updatedFuel,
        currentCleanliness: simulation.updatedCleanliness,
        currentDurability: simulation.updatedDurability,
      };

      const walletTransactions: WalletTransaction[] = [];
      if (simulation.rewards.roadCoins > 0) {
        walletTransactions.push(
          await this.mutateWalletInTransaction(client, {
            playerId: profile.playerId,
            currency: 'ROAD_COINS',
            amount: simulation.rewards.roadCoins,
            reason: 'ONLINE_DRIVE_REWARD',
            sourceType: 'TRIP_DRIVE_TICK',
            sourceId: trip.tripId,
            idempotencyKey: `${input.idempotencyKey}:road_coins`,
          }, simulation.rewards.roadCoins),
        );
      }
      if (simulation.rewards.travelTokens > 0) {
        walletTransactions.push(
          await this.mutateWalletInTransaction(client, {
            playerId: profile.playerId,
            currency: 'TRAVEL_TOKENS',
            amount: simulation.rewards.travelTokens,
            reason: 'ONLINE_DRIVE_REWARD',
            sourceType: 'TRIP_DRIVE_TICK',
            sourceId: trip.tripId,
            idempotencyKey: `${input.idempotencyKey}:travel_tokens`,
          }, simulation.rewards.travelTokens),
        );
      }

      const result: DriveTickResult = {
        trip: {
          ...this.toTrip(updatedTripResult.rows[0]),
          route,
        },
        vehicle: updatedVehicle,
        durationSeconds: simulation.durationSeconds,
        rawDistanceGainKm: simulation.rawDistanceGainKm,
        distanceGainKm: simulation.distanceGainKm,
        finalDistanceKm: simulation.finalDistanceKm,
        forcedStopReason: simulation.forcedStopReason,
        ...(simulation.landmarkId ? { landmarkId: simulation.landmarkId } : {}),
        fuelUsed: simulation.fuelUsed,
        cleanlinessLoss: simulation.cleanlinessLoss,
        durabilityLoss: simulation.durabilityLoss,
        rewards: simulation.rewards,
        walletBalances: await this.getWalletBalancesInTransaction(client, profile.playerId),
        walletTransactions,
      };

      await this.insertAnalyticsEventInTransaction(client, {
        playerId: profile.playerId,
        eventName: 'drive_tick',
        sourceType: 'TRIP',
        sourceId: trip.tripId,
        payload: {
          mode: input.mode,
          client_tick_seq: input.clientTickSeq,
          duration_seconds: simulation.durationSeconds,
          distance_gain_km: simulation.distanceGainKm,
          forced_stop_reason: simulation.forcedStopReason,
          road_coins: simulation.rewards.roadCoins,
          travel_tokens: simulation.rewards.travelTokens,
        },
      });
      if (simulation.forcedStopReason === 'LANDMARK_REQUIRED') {
        await this.insertAnalyticsEventInTransaction(client, {
          playerId: profile.playerId,
          eventName: 'stopped_at_landmark',
          sourceType: 'TRIP',
          sourceId: trip.tripId,
          payload: {
            landmark_id: simulation.landmarkId,
            distance_km: simulation.finalDistanceKm,
          },
        });
      }

      await client.query(
        `
          insert into public.trip_drive_ticks (
            player_id,
            trip_id,
            idempotency_key,
            client_tick_seq,
            mode,
            duration_seconds,
            distance_gain_km,
            final_distance_km,
            forced_stop_reason,
            rewards,
            result_payload
          )
          values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11::jsonb)
        `,
        [
          profile.playerId,
          trip.tripId,
          input.idempotencyKey,
          input.clientTickSeq,
          input.mode,
          simulation.durationSeconds,
          simulation.distanceGainKm,
          simulation.finalDistanceKm,
          simulation.forcedStopReason,
          JSON.stringify(simulation.rewards),
          JSON.stringify(result),
        ],
      );

      await client.query('commit');
      return result;
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
  }

  async completeLandmark(identity: AuthIdentity, input: CompleteLandmarkInput): Promise<CompleteLandmarkResult> {
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      const profile = await this.getOrCreatePlayerProfileInTransaction(client, identity);
      await this.ensurePlayerDefaultsInTransaction(client, profile.playerId);

      const existingPhoto = await client.query(
        `
          select *
          from public.player_photos
          where player_id = $1 and complete_landmark_idempotency_key = $2
          limit 1
          for update
        `,
        [profile.playerId, input.idempotencyKey],
      );
      if (existingPhoto.rowCount) {
        const photo = this.toPlayerPhoto(existingPhoto.rows[0]);
        const tripResult = await client.query('select * from public.player_trips where trip_id = $1', [photo.tripId]);
        const rewardTxResult = photo.rewardTxId
          ? await client.query('select * from public.wallet_transactions where transaction_id = $1', [photo.rewardTxId])
          : { rows: [] };
        const result: CompleteLandmarkResult = {
          trip: await this.tripWithRouteInTransaction(client, this.toTrip(tripResult.rows[0]), profile.playerId),
          profile,
          photo,
          walletBalances: await this.getWalletBalancesInTransaction(client, profile.playerId),
          walletTransactions: rewardTxResult.rows.map((row) => this.toWalletTransaction(row)),
        };

        await client.query('commit');
        return result;
      }

      const tripResult = await client.query(
        `
          select *
          from public.player_trips
          where player_id = $1 and trip_id = $2
          for update
        `,
        [profile.playerId, input.tripId],
      );
      if (!tripResult.rowCount) {
        throw new Error('TRIP_NOT_FOUND');
      }

      const trip = this.toTrip(tripResult.rows[0]);
      if (trip.status !== 'FORCED_STOP' || trip.forcedStopReason !== 'LANDMARK_REQUIRED') {
        throw new Error('LANDMARK_STOP_REQUIRED');
      }

      const landmarkResult = await client.query(
        `
          select *
          from public.landmarks
          where route_id = $1 and landmark_id = $2
          limit 1
        `,
        [trip.routeId, input.landmarkId],
      );
      if (!landmarkResult.rowCount) {
        throw new Error('LANDMARK_NOT_FOUND');
      }

      const landmark = this.toLandmark(landmarkResult.rows[0]);
      if (trip.currentDistanceKm < landmark.distanceKm) {
        throw new Error('LANDMARK_NOT_FOUND');
      }

      const existingFirstPhoto = await client.query(
        `
          select photo_id
          from public.player_photos
          where player_id = $1 and landmark_id = $2 and is_first_photo = true
          limit 1
          for update
        `,
        [profile.playerId, landmark.landmarkId],
      );
      if (existingFirstPhoto.rowCount) {
        throw new Error('LANDMARK_ALREADY_COMPLETED');
      }

      const vehicleResult = await client.query(
        `
          select
            pv.*,
            vd.vehicle_key,
            vd.display_name,
            vd.base_speed_kmph,
            vd.fuel_capacity,
            vd.fuel_consumption_per_km,
            vd.durability_loss_per_km,
            vd.cleanliness_loss_per_km,
            vd.offline_efficiency,
            vd.weather_resistance
          from public.player_vehicles pv
          join public.vehicle_definitions vd on vd.vehicle_def_id = pv.vehicle_def_id
          where pv.player_id = $1 and pv.player_vehicle_id = $2
          for update
        `,
        [profile.playerId, trip.playerVehicleId],
      );
      if (!vehicleResult.rowCount) {
        throw new Error('VEHICLE_NOT_FOUND');
      }
      const vehicle = this.toPlayerVehicle(vehicleResult.rows[0]);

      const rewardTx = await this.mutateWalletInTransaction(client, {
        playerId: profile.playerId,
        currency: 'ROAD_COINS',
        amount: landmark.basePhotoCoins,
        reason: 'PHOTO_FIRST_REWARD',
        sourceType: 'LANDMARK_PHOTO',
        sourceId: landmark.landmarkId,
        idempotencyKey: `${input.idempotencyKey}:first_photo_reward`,
      }, landmark.basePhotoCoins);

      const nextTutorialState = nextTutorialStateAfterPhoto(profile.tutorialState);
      if (nextTutorialState !== profile.tutorialState) {
        await client.query(
          `
            update public.players
            set tutorial_state = $2, updated_at = now()
            where player_id = $1
          `,
          [profile.playerId, nextTutorialState],
        );
      }

      const updatedTripResult = await client.query(
        `
          update public.player_trips
          set status = 'ACTIVE',
              forced_stop_reason = null,
              last_simulated_at = now()
          where trip_id = $1
          returning *
        `,
        [trip.tripId],
      );

      const insertedPhoto = await client.query(
        `
          insert into public.player_photos (
            player_id,
            trip_id,
            landmark_id,
            photo_card_key,
            quality_score,
            weather,
            day_phase,
            cleanliness_at_shot,
            is_first_photo,
            reward_tx_id,
            complete_landmark_idempotency_key,
            metadata
          )
          values ($1, $2, $3, $4, $5, 'sunny', 'day', $6, true, $7, $8, '{}'::jsonb)
          returning *
        `,
        [
          profile.playerId,
          trip.tripId,
          landmark.landmarkId,
          landmark.photoCardKey,
          calculatePhotoQualityScore({ vehicle, landmark }),
          vehicle.currentCleanliness,
          rewardTx.transactionId,
          input.idempotencyKey,
        ],
      );
      const photo = this.toPlayerPhoto(insertedPhoto.rows[0]);

      await this.insertAnalyticsEventInTransaction(client, {
        playerId: profile.playerId,
        eventName: 'photo_taken',
        sourceType: 'LANDMARK',
        sourceId: landmark.landmarkId,
        payload: {
          trip_id: trip.tripId,
          photo_id: photo.photoId,
          quality_score: photo.qualityScore,
          is_first_photo: true,
        },
      });

      const updatedProfile = {
        ...profile,
        tutorialState: nextTutorialState,
      };
      const updatedRoute = await this.getRouteForTripInTransaction(client, profile.playerId, trip.routeId);
      const result: CompleteLandmarkResult = {
        trip: {
          ...this.toTrip(updatedTripResult.rows[0]),
          route: updatedRoute ?? undefined,
        },
        profile: updatedProfile,
        photo,
        walletBalances: await this.getWalletBalancesInTransaction(client, profile.playerId),
        walletTransactions: [rewardTx],
      };

      await client.query('commit');
      return result;
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
  }

  async claimOfflineReport(identity: AuthIdentity, input: ClaimOfflineReportInput): Promise<ClaimOfflineReportResult> {
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      const profile = await this.getOrCreatePlayerProfileInTransaction(client, identity);

      const reportResult = await client.query(
        `
          select *
          from public.offline_reports
          where player_id = $1 and report_id = $2
          for update
        `,
        [profile.playerId, input.reportId],
      );
      if (!reportResult.rowCount) {
        throw new Error('REPORT_NOT_FOUND');
      }

      const report = this.toOfflineReport(reportResult.rows[0]);
      if (report.claimed) {
        if (report.claimIdempotencyKey !== input.idempotencyKey) {
          throw new Error('REPORT_ALREADY_CLAIMED');
        }
        const walletTransactions = await this.getWalletTransactionsByKeysInTransaction(client, profile.playerId, [
          `${input.idempotencyKey}:road_coins`,
          `${input.idempotencyKey}:travel_tokens`,
        ]);
        const walletBalances = await this.getWalletBalancesInTransaction(client, profile.playerId);
        await client.query('commit');
        return {
          report,
          walletBalances,
          walletTransactions,
        };
      }

      const walletTransactions: WalletTransaction[] = [];
      if (report.roadCoinsPending > 0) {
        walletTransactions.push(
          await this.mutateWalletInTransaction(client, {
            playerId: profile.playerId,
            currency: 'ROAD_COINS',
            amount: report.roadCoinsPending,
            reason: 'OFFLINE_REPORT_CLAIM',
            sourceType: 'OFFLINE_REPORT',
            sourceId: report.reportId,
            idempotencyKey: `${input.idempotencyKey}:road_coins`,
          }, report.roadCoinsPending),
        );
      }
      if (report.travelTokensPending > 0) {
        walletTransactions.push(
          await this.mutateWalletInTransaction(client, {
            playerId: profile.playerId,
            currency: 'TRAVEL_TOKENS',
            amount: report.travelTokensPending,
            reason: 'OFFLINE_REPORT_CLAIM',
            sourceType: 'OFFLINE_REPORT',
            sourceId: report.reportId,
            idempotencyKey: `${input.idempotencyKey}:travel_tokens`,
          }, report.travelTokensPending),
        );
      }

      const updatedReport = await client.query(
        `
          update public.offline_reports
          set claimed = true,
              claimed_at = now(),
              claim_idempotency_key = $2
          where report_id = $1
          returning *
        `,
        [report.reportId, input.idempotencyKey],
      );

      await this.insertAnalyticsEventInTransaction(client, {
        playerId: profile.playerId,
        eventName: 'offline_report_claimed',
        sourceType: 'OFFLINE_REPORT',
        sourceId: report.reportId,
        payload: {
          trip_id: report.tripId,
          distance_travelled_km: report.distanceTravelledKm,
          road_coins: report.roadCoinsPending,
          travel_tokens: report.travelTokensPending,
        },
      });

      const result: ClaimOfflineReportResult = {
        report: this.toOfflineReport(updatedReport.rows[0]),
        walletBalances: await this.getWalletBalancesInTransaction(client, profile.playerId),
        walletTransactions,
      };

      await client.query('commit');
      return result;
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
  }

  async completeRoute(identity: AuthIdentity, input: CompleteRouteInput): Promise<CompleteRouteResult> {
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      const profile = await this.getOrCreatePlayerProfileInTransaction(client, identity);
      await this.ensurePlayerDefaultsInTransaction(client, profile.playerId);

      const existingForKey = await client.query(
        `
          select result_payload
          from public.route_completion_actions
          where player_id = $1 and idempotency_key = $2
          limit 1
          for update
        `,
        [profile.playerId, input.idempotencyKey],
      );
      if (existingForKey.rowCount) {
        await client.query('commit');
        return existingForKey.rows[0].result_payload as CompleteRouteResult;
      }

      const tripResult = await client.query(
        `
          select *
          from public.player_trips
          where player_id = $1 and trip_id = $2
          for update
        `,
        [profile.playerId, input.tripId],
      );
      if (!tripResult.rowCount) {
        throw new Error('TRIP_NOT_FOUND');
      }

      const trip = this.toTrip(tripResult.rows[0]);
      if (trip.status === 'COMPLETED') {
        throw new Error('ROUTE_ALREADY_COMPLETED');
      }
      if (trip.status === 'ABANDONED') {
        throw new Error('TRIP_NOT_ACTIVE');
      }

      const route = await this.getRouteForTripInTransaction(client, profile.playerId, trip.routeId);
      if (!route) {
        throw new Error('ROUTE_NOT_FOUND');
      }
      if (trip.currentDistanceKm < route.totalDistanceKm) {
        throw new Error('ROUTE_NOT_COMPLETE');
      }
      if (trip.forcedStopReason && trip.forcedStopReason !== 'ROUTE_END') {
        throw new Error('ROUTE_NOT_COMPLETE');
      }

      const incompleteRequiredLandmark = await client.query(
        `
          select l.landmark_id
          from public.landmarks l
          left join public.player_photos p
            on p.player_id = $2
            and p.landmark_id = l.landmark_id
            and p.is_first_photo = true
          where l.route_id = $1
            and l.required_stop = true
            and p.photo_id is null
          limit 1
        `,
        [trip.routeId, profile.playerId],
      );
      if (incompleteRequiredLandmark.rowCount) {
        throw new Error('REQUIRED_LANDMARKS_INCOMPLETE');
      }

      const rewards = route.routeType === 'Tutorial'
        ? TUTORIAL_COMPLETION_REWARDS
        : { roadCoins: 0, travelTokens: 0, souvenirStamps: 0 };
      const walletTransactions: WalletTransaction[] = [];
      if (rewards.roadCoins > 0) {
        walletTransactions.push(
          await this.mutateWalletInTransaction(client, {
            playerId: profile.playerId,
            currency: 'ROAD_COINS',
            amount: rewards.roadCoins,
            reason: 'ROUTE_COMPLETE_REWARD',
            sourceType: 'ROUTE_COMPLETION',
            sourceId: trip.tripId,
            idempotencyKey: `${input.idempotencyKey}:road_coins`,
          }, rewards.roadCoins),
        );
      }
      if (rewards.travelTokens > 0) {
        walletTransactions.push(
          await this.mutateWalletInTransaction(client, {
            playerId: profile.playerId,
            currency: 'TRAVEL_TOKENS',
            amount: rewards.travelTokens,
            reason: 'ROUTE_COMPLETE_REWARD',
            sourceType: 'ROUTE_COMPLETION',
            sourceId: trip.tripId,
            idempotencyKey: `${input.idempotencyKey}:travel_tokens`,
          }, rewards.travelTokens),
        );
      }
      if (rewards.souvenirStamps > 0) {
        walletTransactions.push(
          await this.mutateWalletInTransaction(client, {
            playerId: profile.playerId,
            currency: 'SOUVENIR_STAMPS',
            amount: rewards.souvenirStamps,
            reason: 'ROUTE_COMPLETE_REWARD',
            sourceType: 'ROUTE_COMPLETION',
            sourceId: trip.tripId,
            idempotencyKey: `${input.idempotencyKey}:souvenir_stamps`,
          }, rewards.souvenirStamps),
        );
      }

      const updatedTripResult = await client.query(
        `
          update public.player_trips
          set status = 'COMPLETED',
              current_distance_km = $2,
              completed_at = now(),
              forced_stop_reason = null,
              last_simulated_at = now()
          where trip_id = $1
          returning *
        `,
        [trip.tripId, route.totalDistanceKm],
      );

      await client.query(
        `
          update public.player_vehicles
          set locked_in_trip_id = null,
              version = version + 1
          where player_vehicle_id = $1 and locked_in_trip_id = $2
        `,
        [trip.playerVehicleId, trip.tripId],
      );

      let updatedProfile = profile;
      if (route.routeType === 'Tutorial') {
        const updatedProfileResult = await client.query(
          `
            update public.players
            set tutorial_state = 'FULL_SYSTEM_UNLOCKED',
                updated_at = now()
            where player_id = $1
            returning *
          `,
          [profile.playerId],
        );
        updatedProfile = this.toPlayerProfile(updatedProfileResult.rows[0]);
      }

      await this.insertAnalyticsEventInTransaction(client, {
        playerId: profile.playerId,
        eventName: 'route_completed',
        sourceType: 'TRIP',
        sourceId: trip.tripId,
        payload: {
          route_id: route.routeId,
          route_key: route.routeKey,
          total_distance_km: route.totalDistanceKm,
          road_coins: rewards.roadCoins,
          travel_tokens: rewards.travelTokens,
          souvenir_stamps: rewards.souvenirStamps,
        },
      });

      const result: CompleteRouteResult = {
        trip: {
          ...this.toTrip(updatedTripResult.rows[0]),
          route,
        },
        profile: updatedProfile,
        completionRewards: rewards,
        walletBalances: await this.getWalletBalancesInTransaction(client, profile.playerId),
        walletTransactions,
      };

      await client.query(
        `
          insert into public.route_completion_actions (
            player_id,
            trip_id,
            idempotency_key,
            road_coins_reward,
            travel_tokens_reward,
            souvenir_stamps_reward,
            result_payload
          )
          values ($1, $2, $3, $4, $5, $6, $7::jsonb)
        `,
        [
          profile.playerId,
          trip.tripId,
          input.idempotencyKey,
          rewards.roadCoins,
          rewards.travelTokens,
          rewards.souvenirStamps,
          JSON.stringify(result),
        ],
      );

      await client.query('commit');
      return result;
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
  }

  async maintainVehicle(identity: AuthIdentity, input: VehicleMaintenanceInput): Promise<VehicleMaintenanceResult> {
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      const profile = await this.getOrCreatePlayerProfileInTransaction(client, identity);
      await this.ensurePlayerDefaultsInTransaction(client, profile.playerId);

      const existingForKey = await client.query(
        `
          select result_payload
          from public.vehicle_maintenance_actions
          where player_id = $1 and idempotency_key = $2
          limit 1
          for update
        `,
        [profile.playerId, input.idempotencyKey],
      );
      if (existingForKey.rowCount) {
        await client.query('commit');
        return existingForKey.rows[0].result_payload as VehicleMaintenanceResult;
      }

      const vehicleResult = await client.query(
        `
          select
            pv.*,
            vd.vehicle_key,
            vd.display_name,
            vd.base_speed_kmph,
            vd.fuel_capacity,
            vd.fuel_consumption_per_km,
            vd.durability_loss_per_km,
            vd.cleanliness_loss_per_km,
            vd.offline_efficiency,
            vd.weather_resistance
          from public.player_vehicles pv
          join public.vehicle_definitions vd on vd.vehicle_def_id = pv.vehicle_def_id
          where pv.player_id = $1
            and pv.player_vehicle_id = coalesce($2::uuid, $3::uuid)
          for update
        `,
        [profile.playerId, input.playerVehicleId ?? null, profile.currentVehicleId],
      );
      if (!vehicleResult.rowCount) {
        throw new Error('VEHICLE_NOT_FOUND');
      }

      const vehicle = this.toPlayerVehicle(vehicleResult.rows[0]);
      const maintenance = calculateVehicleMaintenance(input.action, vehicle);
      const walletTransaction = await this.mutateWalletInTransaction(client, {
        playerId: profile.playerId,
        currency: 'ROAD_COINS',
        amount: maintenance.costRoadCoins,
        reason: this.maintenanceReason(input.action),
        sourceType: 'VEHICLE_MAINTENANCE',
        sourceId: vehicle.playerVehicleId,
        idempotencyKey: `${input.idempotencyKey}:road_coins`,
      }, -maintenance.costRoadCoins);

      await client.query(
        `
          update public.player_vehicles
          set current_fuel = $2,
              current_cleanliness = $3,
              current_durability = $4,
              version = version + 1
          where player_vehicle_id = $1
        `,
        [
          vehicle.playerVehicleId,
          maintenance.targetFuel,
          maintenance.targetCleanliness,
          maintenance.targetDurability,
        ],
      );

      await this.touchPlayerLastSeenInTransaction(client, profile.playerId);

      const updatedVehicle: PlayerVehicle = {
        ...vehicle,
        currentFuel: maintenance.targetFuel,
        currentCleanliness: maintenance.targetCleanliness,
        currentDurability: maintenance.targetDurability,
      };
      const result: VehicleMaintenanceResult = {
        action: input.action,
        vehicle: updatedVehicle,
        costRoadCoins: maintenance.costRoadCoins,
        restoredAmount: maintenance.restoredAmount,
        walletBalances: await this.getWalletBalancesInTransaction(client, profile.playerId),
        walletTransactions: [walletTransaction],
      };

      await client.query(
        `
          insert into public.vehicle_maintenance_actions (
            player_id,
            player_vehicle_id,
            action,
            idempotency_key,
            cost_road_coins,
            restored_amount,
            wallet_transaction_id,
            result_payload
          )
          values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
        `,
        [
          profile.playerId,
          vehicle.playerVehicleId,
          input.action,
          input.idempotencyKey,
          maintenance.costRoadCoins,
          maintenance.restoredAmount,
          walletTransaction.transactionId,
          JSON.stringify(result),
        ],
      );

      await this.insertAnalyticsEventInTransaction(client, {
        playerId: profile.playerId,
        eventName: 'vehicle_maintenance_completed',
        sourceType: 'VEHICLE',
        sourceId: vehicle.playerVehicleId,
        payload: {
          action: input.action,
          cost_road_coins: maintenance.costRoadCoins,
          restored_amount: maintenance.restoredAmount,
        },
      });

      await client.query('commit');
      return result;
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
  }

  private async getOrCreatePendingOfflineReportInTransaction(
    client: PoolClient,
    profile: PlayerProfile,
  ): Promise<OfflineReport | null> {
    const pendingReport = await client.query(
      `
        select *
        from public.offline_reports
        where player_id = $1 and claimed = false
        order by generated_at desc
        limit 1
      `,
      [profile.playerId],
    );
    if (pendingReport.rowCount) {
      return this.toOfflineReport(pendingReport.rows[0]);
    }

    const tripResult = await client.query(
      `
        select *
        from public.player_trips
        where player_id = $1 and status = 'ACTIVE'
        order by started_at desc
        limit 1
        for update
      `,
      [profile.playerId],
    );
    if (!tripResult.rowCount) {
      return null;
    }

    const trip = this.toTrip(tripResult.rows[0]);
    const vehicleResult = await client.query(
      `
        select
          pv.*,
          vd.vehicle_key,
          vd.display_name,
          vd.base_speed_kmph,
          vd.fuel_capacity,
          vd.fuel_consumption_per_km,
          vd.durability_loss_per_km,
          vd.cleanliness_loss_per_km,
          vd.offline_efficiency,
          vd.weather_resistance
        from public.player_vehicles pv
        join public.vehicle_definitions vd on vd.vehicle_def_id = pv.vehicle_def_id
        where pv.player_id = $1 and pv.player_vehicle_id = $2
        for update
      `,
      [profile.playerId, trip.playerVehicleId],
    );
    if (!vehicleResult.rowCount) {
      return null;
    }

    const route = await this.getRouteForTripInTransaction(client, profile.playerId, trip.routeId);
    if (!route) {
      return null;
    }

    const completedLandmarks = await client.query(
      `
        select landmark_id
        from public.player_photos
        where player_id = $1 and is_first_photo = true
      `,
      [profile.playerId],
    );
    const completedLandmarkIds = new Set(completedLandmarks.rows.map((row) => row.landmark_id));
    const now = new Date();
    const vehicle = this.toPlayerVehicle(vehicleResult.rows[0]);
    const simulation = simulateOfflineProgress({
      now,
      lastSeenAt: new Date(profile.lastSeenAt),
      lastSimulatedAt: new Date(trip.lastSimulatedAt),
      currentDistanceKm: trip.currentDistanceKm,
      elapsedRealSeconds: trip.elapsedRealSeconds,
      previousOfflineTokenMeterKm: trip.offlineTokenMeterKm,
      routeTotalDistanceKm: route.totalDistanceKm,
      routeRewardMultiplier: route.rewardMultiplier,
      vehicle,
      segments: route.segments ?? [],
      landmarks: (route.landmarks ?? []).map((landmark) => ({
        landmarkId: landmark.landmarkId,
        distanceKm: landmark.distanceKm,
        requiredStop: landmark.requiredStop,
        completed: completedLandmarkIds.has(landmark.landmarkId),
      })),
    });
    if (simulation.offlineSeconds < DEFAULT_SIMULATION_CONFIG.offline.minOfflineReportSeconds) {
      return null;
    }

    await client.query(
      `
        update public.player_trips
        set current_distance_km = $2,
            elapsed_real_seconds = $3,
            offline_token_meter_km = $4,
            last_simulated_at = $5,
            status = $6,
            forced_stop_reason = $7
        where trip_id = $1
      `,
      [
        trip.tripId,
        simulation.finalDistanceKm,
        simulation.updatedElapsedRealSeconds,
        simulation.updatedOfflineTokenMeterKm,
        now.toISOString(),
        simulation.updatedTripStatus,
        simulation.forcedStopReason,
      ],
    );
    await client.query(
      `
        update public.player_vehicles
        set current_fuel = $2,
            current_cleanliness = $3,
            current_durability = $4,
            total_distance_km = total_distance_km + $5,
            version = version + 1
        where player_vehicle_id = $1
      `,
      [
        vehicle.playerVehicleId,
        simulation.updatedFuel,
        simulation.updatedCleanliness,
        simulation.updatedDurability,
        simulation.distanceTravelledKm,
      ],
    );

    if (simulation.forcedStopReason === 'LANDMARK_REQUIRED') {
      const nextTutorialState = nextTutorialStateAfterDriveTick({
        currentState: profile.tutorialState,
        mode: 'HOLD_TO_DRIVE',
        distanceGainKm: simulation.distanceTravelledKm,
        finalDistanceKm: simulation.finalDistanceKm,
        forcedStopReason: simulation.forcedStopReason,
      });
      if (nextTutorialState !== profile.tutorialState) {
        await client.query(
          `
            update public.players
            set tutorial_state = $2, updated_at = now()
            where player_id = $1
          `,
          [profile.playerId, nextTutorialState],
        );
      }
    }

    const landmark = simulation.landmarkId
      ? (route.landmarks ?? []).find((candidate) => candidate.landmarkId === simulation.landmarkId)
      : undefined;
    const insertedReport = await client.query(
      `
        insert into public.offline_reports (
          player_id,
          trip_id,
          offline_seconds,
          distance_travelled_km,
          road_coins_pending,
          travel_tokens_pending,
          fuel_used,
          cleanliness_loss,
          durability_loss,
          weather_summary,
          landmark_reached,
          forced_stop_reason
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11::jsonb, $12)
        returning *
      `,
      [
        profile.playerId,
        trip.tripId,
        simulation.offlineSeconds,
        simulation.distanceTravelledKm,
        simulation.rewards.roadCoins,
        simulation.rewards.travelTokens,
        simulation.fuelUsed,
        simulation.cleanlinessLoss,
        simulation.durabilityLoss,
        JSON.stringify({ weather: 'sunny' }),
        landmark
          ? JSON.stringify({
              landmarkId: landmark.landmarkId,
              landmarkKey: landmark.landmarkKey,
              name: landmark.name,
            })
          : null,
        simulation.forcedStopReason,
      ],
    );
    const report = this.toOfflineReport(insertedReport.rows[0]);
    await this.insertAnalyticsEventInTransaction(client, {
      playerId: profile.playerId,
      eventName: 'offline_report_generated',
      sourceType: 'OFFLINE_REPORT',
      sourceId: report.reportId,
      payload: {
        trip_id: report.tripId,
        offline_seconds: report.offlineSeconds,
        distance_travelled_km: report.distanceTravelledKm,
        forced_stop_reason: report.forcedStopReason,
      },
    });

    return report;
  }

  private async mutateWallet(input: WalletMutationInput, signedAmount: number): Promise<WalletTransaction> {
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      const transaction = await this.mutateWalletInTransaction(client, input, signedAmount);
      await client.query('commit');
      return transaction;
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
  }

  private async mutateWalletInTransaction(
    client: PoolClient,
    input: WalletMutationInput,
    signedAmount: number,
  ): Promise<WalletTransaction> {
    const existingTx = await client.query(
      `
        select *
        from public.wallet_transactions
        where player_id = $1 and idempotency_key = $2
      `,
      [input.playerId, input.idempotencyKey],
    );
    if (existingTx.rowCount) {
      return this.toWalletTransaction(existingTx.rows[0]);
    }

    await client.query(
      `
        insert into public.wallet_balances (player_id, currency, balance)
        values ($1, $2, 0)
        on conflict (player_id, currency) do nothing
      `,
      [input.playerId, input.currency],
    );

    const balanceResult = await client.query(
      `
        select balance
        from public.wallet_balances
        where player_id = $1 and currency = $2
        for update
      `,
      [input.playerId, input.currency],
    );
    const balanceBefore = Number(balanceResult.rows[0].balance);
    const balanceAfter = balanceBefore + signedAmount;

    if (balanceAfter < 0) {
      throw new Error('INSUFFICIENT_FUNDS');
    }

    await client.query(
      `
        update public.wallet_balances
        set balance = $3, updated_at = now()
        where player_id = $1 and currency = $2
      `,
      [input.playerId, input.currency, balanceAfter],
    );

    const transactionResult = await client.query(
      `
        insert into public.wallet_transactions (
          player_id,
          currency,
          amount,
          balance_before,
          balance_after,
          reason,
          source_type,
          source_id,
          idempotency_key,
          metadata
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9, '{}'::jsonb)
        returning *
      `,
      [
        input.playerId,
        input.currency,
        signedAmount,
        balanceBefore,
        balanceAfter,
        input.reason,
        input.sourceType,
        input.sourceId ?? null,
        input.idempotencyKey,
      ],
    );

    return this.toWalletTransaction(transactionResult.rows[0]);
  }

  private async getWalletBalancesInTransaction(client: PoolClient, playerId: string): Promise<WalletBalance[]> {
    const result = await client.query(
      `
        select currency, balance
        from public.wallet_balances
        where player_id = $1
        order by array_position($2::text[], currency)
      `,
      [playerId, CURRENCIES],
    );

    return result.rows.map((row) => this.toWalletBalance(row));
  }

  private async getWalletTransactionsByKeysInTransaction(
    client: PoolClient,
    playerId: string,
    idempotencyKeys: string[],
  ): Promise<WalletTransaction[]> {
    const result = await client.query(
      `
        select *
        from public.wallet_transactions
        where player_id = $1 and idempotency_key = any($2::text[])
        order by created_at asc
      `,
      [playerId, idempotencyKeys],
    );

    return result.rows.map((row) => this.toWalletTransaction(row));
  }

  private async touchPlayerLastSeenInTransaction(client: PoolClient, playerId: string): Promise<void> {
    await client.query(
      `
        update public.players
        set last_seen_at = now(), updated_at = now()
        where player_id = $1
      `,
      [playerId],
    );
  }

  private async insertAnalyticsEventInTransaction(
    client: PoolClient,
    input: {
      playerId: string;
      eventName: string;
      sourceType: string;
      sourceId: string;
      payload: Record<string, unknown>;
    },
  ): Promise<void> {
    await client.query(
      `
        insert into public.analytics_events (
          player_id,
          event_name,
          source_type,
          source_id,
          event_payload
        )
        values ($1, $2, $3, $4, $5::jsonb)
      `,
      [input.playerId, input.eventName, input.sourceType, input.sourceId, JSON.stringify(input.payload)],
    );
  }

  private async getOrCreatePlayerProfileInTransaction(
    client: PoolClient,
    identity: AuthIdentity,
  ): Promise<PlayerProfile> {
    const existing = await client.query(
      `
        select *
        from public.players
        where auth_provider = $1 and external_id = $2
        for update
      `,
      [identity.authProvider, identity.externalId],
    );

    if (existing.rowCount) {
      return this.toPlayerProfile(existing.rows[0]);
    }

    const inserted = await client.query(
      `
        insert into public.players (auth_provider, external_id, display_name, timezone)
        values ($1, $2, $3, $4)
        returning *
      `,
      [identity.authProvider, identity.externalId, identity.displayName ?? null, identity.timezone ?? 'UTC'],
    );

    return this.toPlayerProfile(inserted.rows[0]);
  }

  private async ensurePlayerDefaultsInTransaction(client: PoolClient, playerId: string): Promise<void> {
    for (const currency of CURRENCIES) {
      await client.query(
        `
          insert into public.wallet_balances (player_id, currency, balance)
          values ($1, $2, 0)
          on conflict (player_id, currency) do nothing
        `,
        [playerId, currency],
      );
    }

    const vehicleCount = await client.query(
      `
        select count(*)::int as count
        from public.player_vehicles
        where player_id = $1
      `,
      [playerId],
    );

    if (Number(vehicleCount.rows[0].count) > 0) {
      return;
    }

    const defaultVehicleDef = await client.query(
      `
        select vd.*
        from public.vehicle_definitions vd
        join public.config_versions cv on cv.config_version_id = vd.config_version_id
        where cv.status = 'LIVE' and vd.vehicle_key = 'van_common_001'
        limit 1
      `,
    );

    if (!defaultVehicleDef.rowCount) {
      throw new Error('DEFAULT_VEHICLE_NOT_FOUND');
    }

    const vehicleDef = defaultVehicleDef.rows[0];
    const insertedVehicle = await client.query(
      `
        insert into public.player_vehicles (
          player_id,
          vehicle_def_id,
          current_fuel,
          current_durability,
          current_cleanliness,
          selected_skin_id,
          upgrade_level,
          is_selected
        )
        values ($1, $2, $3, 100, 100, $4, 1, true)
        returning *
      `,
      [playerId, vehicleDef.vehicle_def_id, vehicleDef.fuel_capacity, vehicleDef.default_skin_id],
    );

    await client.query(
      `
        update public.players
        set current_vehicle_id = $2, updated_at = now()
        where player_id = $1 and current_vehicle_id is null
      `,
      [playerId, insertedVehicle.rows[0].player_vehicle_id],
    );
  }

  private async loadPlayerStateInTransaction(client: PoolClient, playerId: string): Promise<PlayerState> {
    const profileResult = await client.query('select * from public.players where player_id = $1', [playerId]);
    const balancesResult = await client.query(
      `
        select currency, balance
        from public.wallet_balances
        where player_id = $1
        order by array_position($2::text[], currency)
      `,
      [playerId, CURRENCIES],
    );
    const vehiclesResult = await client.query(
      `
        select
          pv.*,
          vd.vehicle_key,
          vd.display_name,
          vd.base_speed_kmph,
          vd.fuel_capacity,
          vd.fuel_consumption_per_km,
          vd.durability_loss_per_km,
          vd.cleanliness_loss_per_km,
          vd.offline_efficiency,
          vd.weather_resistance
        from public.player_vehicles pv
        join public.vehicle_definitions vd on vd.vehicle_def_id = pv.vehicle_def_id
        where pv.player_id = $1
        order by pv.acquired_at asc
      `,
      [playerId],
    );

    return {
      profile: this.toPlayerProfile(profileResult.rows[0]),
      walletBalances: balancesResult.rows.map((row) => this.toWalletBalance(row)),
      vehicles: vehiclesResult.rows.map((row) => this.toPlayerVehicle(row)),
      pendingOfflineReport: null,
    };
  }

  private async loadRouteDetails(route: RouteDefinition): Promise<RouteDefinition> {
    const [segmentsResult, landmarksResult] = await Promise.all([
      this.pool.query(
        `
          select *
          from public.route_segments
          where route_id = $1
          order by segment_index asc
        `,
        [route.routeId],
      ),
      this.pool.query(
        `
          select *
          from public.landmarks
          where route_id = $1
          order by distance_km asc
        `,
        [route.routeId],
      ),
    ]);

    return {
      ...route,
      segments: segmentsResult.rows.map((row) => this.toRouteSegment(row)),
      landmarks: landmarksResult.rows.map((row) => this.toLandmark(row)),
    };
  }

  private async tripWithRoute(trip: Trip, playerId: string): Promise<Trip> {
    const route = await this.getRouteForPlayer(playerId, trip.routeId);
    return {
      ...trip,
      route: route ?? undefined,
    };
  }

  private async tripWithRouteInTransaction(client: PoolClient, trip: Trip, playerId: string): Promise<Trip> {
    const route = await this.getRouteForTripInTransaction(client, playerId, trip.routeId);
    return {
      ...trip,
      route: route ?? undefined,
    };
  }

  private async getRouteForTripInTransaction(
    client: PoolClient,
    playerId: string,
    routeId: string,
  ): Promise<RouteDefinition | null> {
    const route = await client.query(
      `
        select
          rd.*,
          (rd.route_type = 'Tutorial' or pur.player_id is not null) as is_unlocked
        from public.route_definitions rd
        left join public.player_unlocked_routes pur
          on pur.route_id = rd.route_id and pur.player_id = $1
        where rd.route_id = $2
        limit 1
      `,
      [playerId, routeId],
    );

    if (!route.rowCount) {
      return null;
    }

    const routeDefinition = this.toRouteDefinition(route.rows[0]);
    const segmentsResult = await client.query(
      `
        select *
        from public.route_segments
        where route_id = $1
        order by segment_index asc
      `,
      [routeId],
    );
    const landmarksResult = await client.query(
      `
        select *
        from public.landmarks
        where route_id = $1
        order by distance_km asc
      `,
      [routeId],
    );

    return {
      ...routeDefinition,
      segments: segmentsResult.rows.map((row) => this.toRouteSegment(row)),
      landmarks: landmarksResult.rows.map((row) => this.toLandmark(row)),
    };
  }

  private async getRouteForPlayer(playerId: string, routeId: string): Promise<RouteDefinition | null> {
    const route = await this.pool.query(
      `
        select
          rd.*,
          (rd.route_type = 'Tutorial' or pur.player_id is not null) as is_unlocked
        from public.route_definitions rd
        left join public.player_unlocked_routes pur
          on pur.route_id = rd.route_id and pur.player_id = $1
        where rd.route_id = $2
        limit 1
      `,
      [playerId, routeId],
    );

    return route.rowCount ? this.loadRouteDetails(this.toRouteDefinition(route.rows[0])) : null;
  }

  private hasFullRouteAccess(player: PlayerProfile): boolean {
    return ['ROUTE_COMPLETED', 'FULL_SYSTEM_UNLOCKED'].includes(player.tutorialState);
  }

  private maintenanceReason(action: VehicleMaintenanceInput['action']): string {
    return {
      REFUEL: 'VEHICLE_REFUEL',
      CLEAN: 'VEHICLE_CLEAN',
      REPAIR: 'VEHICLE_REPAIR',
    }[action];
  }

  private toPlayerProfile(row: QueryResultRow): PlayerProfile {
    return {
      playerId: row.player_id,
      authProvider: row.auth_provider,
      externalId: row.external_id,
      displayName: row.display_name,
      timezone: row.timezone,
      tutorialState: row.tutorial_state,
      currentVehicleId: row.current_vehicle_id,
      lastSeenAt: row.last_seen_at.toISOString(),
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };
  }

  private toWalletBalance(row: QueryResultRow): WalletBalance {
    return {
      currency: row.currency as Currency,
      balance: Number(row.balance),
    };
  }

  private toPlayerVehicle(row: QueryResultRow): PlayerVehicle {
    return {
      playerVehicleId: row.player_vehicle_id,
      vehicleDefId: row.vehicle_def_id,
      vehicleKey: row.vehicle_key,
      displayName: row.display_name,
      baseSpeedKmph: Number(row.base_speed_kmph),
      fuelCapacity: Number(row.fuel_capacity),
      fuelConsumptionPerKm: Number(row.fuel_consumption_per_km),
      durabilityLossPerKm: Number(row.durability_loss_per_km),
      cleanlinessLossPerKm: Number(row.cleanliness_loss_per_km),
      offlineEfficiency: Number(row.offline_efficiency),
      weatherResistance: Number(row.weather_resistance),
      currentFuel: Number(row.current_fuel),
      currentDurability: Number(row.current_durability),
      currentCleanliness: Number(row.current_cleanliness),
      selectedSkinId: row.selected_skin_id,
      upgradeLevel: Number(row.upgrade_level),
      isSelected: Boolean(row.is_selected),
    };
  }

  private toRouteDefinition(row: QueryResultRow): RouteDefinition {
    return {
      routeId: row.route_id,
      configVersionId: row.config_version_id,
      routeKey: row.route_key,
      name: row.name,
      region: row.region,
      startNode: row.start_node,
      destinationNode: row.destination_node,
      routeType: row.route_type,
      totalDistanceKm: Number(row.total_distance_km),
      difficulty: Number(row.difficulty),
      unlockCostStamps: Number(row.unlock_cost_stamps),
      tripPrepFeeCoins: Number(row.trip_prep_fee_coins),
      rewardMultiplier: Number(row.reward_multiplier),
      backgroundPackId: row.background_pack_id,
      isUnlocked: Boolean(row.is_unlocked),
    };
  }

  private toRouteSegment(row: QueryResultRow): RouteSegment {
    return {
      segmentId: row.segment_id,
      segmentIndex: Number(row.segment_index),
      startKm: Number(row.start_km),
      endKm: Number(row.end_km),
      terrainType: row.terrain_type,
      speedMultiplier: Number(row.speed_multiplier),
      fuelMultiplier: Number(row.fuel_multiplier),
      cleanlinessMultiplier: Number(row.cleanliness_multiplier),
      durabilityMultiplier: Number(row.durability_multiplier),
    };
  }

  private toLandmark(row: QueryResultRow): Landmark {
    return {
      landmarkId: row.landmark_id,
      landmarkKey: row.landmark_key,
      name: row.name,
      distanceKm: Number(row.distance_km),
      requiredStop: Boolean(row.required_stop),
      rarity: row.rarity,
      basePhotoCoins: Number(row.base_photo_coins),
      photoCardKey: row.photo_card_key,
    };
  }

  private toTrip(row: QueryResultRow): Trip {
    return {
      tripId: row.trip_id,
      playerId: row.player_id,
      routeId: row.route_id,
      routeConfigVersion: row.route_config_version,
      playerVehicleId: row.player_vehicle_id,
      status: row.status,
      currentDistanceKm: Number(row.current_distance_km),
      elapsedRealSeconds: Number(row.elapsed_real_seconds),
      onlineTokenMeterKm: Number(row.online_token_meter_km),
      offlineTokenMeterKm: Number(row.offline_token_meter_km),
      lastSimulatedAt: row.last_simulated_at.toISOString(),
      startedAt: row.started_at.toISOString(),
      completedAt: row.completed_at?.toISOString() ?? null,
      forcedStopReason: row.forced_stop_reason,
    };
  }

  private toPlayerPhoto(row: QueryResultRow): PlayerPhoto {
    return {
      photoId: row.photo_id,
      playerId: row.player_id,
      tripId: row.trip_id,
      landmarkId: row.landmark_id,
      photoCardKey: row.photo_card_key,
      qualityScore: Number(row.quality_score),
      weather: row.weather,
      dayPhase: row.day_phase,
      cleanlinessAtShot: Number(row.cleanliness_at_shot),
      isFirstPhoto: Boolean(row.is_first_photo),
      rewardTxId: row.reward_tx_id,
      takenAt: row.taken_at.toISOString(),
    };
  }

  private toOfflineReport(row: QueryResultRow): OfflineReport {
    return {
      reportId: row.report_id,
      playerId: row.player_id,
      tripId: row.trip_id,
      generatedAt: row.generated_at.toISOString(),
      offlineSeconds: Number(row.offline_seconds),
      distanceTravelledKm: Number(row.distance_travelled_km),
      roadCoinsPending: Number(row.road_coins_pending),
      travelTokensPending: Number(row.travel_tokens_pending),
      fuelUsed: Number(row.fuel_used),
      cleanlinessLoss: Number(row.cleanliness_loss),
      durabilityLoss: Number(row.durability_loss),
      weatherSummary: row.weather_summary ?? {},
      landmarkReached: row.landmark_reached ?? null,
      forcedStopReason: row.forced_stop_reason,
      claimed: Boolean(row.claimed),
      claimedAt: row.claimed_at?.toISOString() ?? null,
      claimIdempotencyKey: row.claim_idempotency_key ?? null,
    };
  }

  private toWalletTransaction(row: QueryResultRow): WalletTransaction {
    return {
      transactionId: row.transaction_id,
      playerId: row.player_id,
      currency: row.currency as Currency,
      amount: Number(row.amount),
      balanceBefore: Number(row.balance_before),
      balanceAfter: Number(row.balance_after),
      reason: row.reason,
      sourceType: row.source_type,
      sourceId: row.source_id,
      idempotencyKey: row.idempotency_key,
      createdAt: row.created_at.toISOString(),
    };
  }
}
