import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool, PoolClient, QueryResultRow } from 'pg';
import {
  AuthIdentity,
  CURRENCIES,
  Currency,
  AbandonTripInput,
  GameDataStore,
  Landmark,
  PlayerProfile,
  PlayerState,
  PlayerVehicle,
  RouteDefinition,
  RouteSegment,
  StartTripInput,
  Trip,
  WalletBalance,
  WalletMutationInput,
  WalletTransaction,
} from './game-data-store';

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
      const state = await this.loadPlayerStateInTransaction(client, profile.playerId);
      await client.query('commit');
      return state;
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

  private async mutateWallet(input: WalletMutationInput, signedAmount: number): Promise<WalletTransaction> {
    const client = await this.pool.connect();
    try {
      await client.query('begin');

      const existingTx = await client.query(
        `
          select *
          from public.wallet_transactions
          where player_id = $1 and idempotency_key = $2
        `,
        [input.playerId, input.idempotencyKey],
      );
      if (existingTx.rowCount) {
        await client.query('commit');
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

      await client.query('commit');
      return this.toWalletTransaction(transactionResult.rows[0]);
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
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
          vd.display_name
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

  private toPlayerProfile(row: QueryResultRow): PlayerProfile {
    return {
      playerId: row.player_id,
      authProvider: row.auth_provider,
      externalId: row.external_id,
      displayName: row.display_name,
      timezone: row.timezone,
      tutorialState: row.tutorial_state,
      currentVehicleId: row.current_vehicle_id,
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
