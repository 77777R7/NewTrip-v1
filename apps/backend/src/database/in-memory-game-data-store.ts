import { randomUUID } from 'node:crypto';
import {
  AuthIdentity,
  CURRENCIES,
  Currency,
  AbandonTripInput,
  ClaimOfflineReportInput,
  ClaimOfflineReportResult,
  CompleteLandmarkInput,
  CompleteLandmarkResult,
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
  RouteSegment,
  StartTripInput,
  Trip,
  VehicleMaintenanceInput,
  VehicleMaintenanceResult,
  WalletBalance,
  WalletMutationInput,
  WalletTransaction,
} from './game-data-store';
import { isOnlineDriveModeUnlocked, simulateOnlineDriveTick } from '../modules/simulation/online-drive-tick';
import { simulateOfflineProgress } from '../modules/simulation/offline-progress';
import { DEFAULT_SIMULATION_CONFIG } from '../modules/simulation/simulation.constants';
import { calculateVehicleMaintenance } from '../modules/vehicle-maintenance/maintenance.formulas';
import { calculatePhotoQualityScore } from '../modules/landmark/photo-quality';
import { nextTutorialStateAfterDriveTick, nextTutorialStateAfterPhoto } from '../modules/tutorial/tutorial-state';

type InternalPlayer = PlayerProfile;
type InternalAnalyticsEvent = {
  playerId: string;
  eventName: string;
  sourceType: string;
  sourceId: string;
  eventPayload: Record<string, unknown>;
  occurredAt: string;
};

const DEFAULT_VEHICLE_DEF = {
  vehicleDefId: '00000000-0000-4000-8000-000000000101',
  vehicleKey: 'van_common_001',
  displayName: 'Blue Travel Van',
  baseSpeedKmph: 72,
  fuelCapacity: 45,
  fuelConsumptionPerKm: 0.075,
  durabilityLossPerKm: 0.018,
  cleanlinessLossPerKm: 0.035,
  offlineEfficiency: 0.6,
  weatherResistance: 0.15,
  defaultSkinId: 'skin_van_blue_default',
};

const TUTORIAL_ROUTE_ID = '00000000-0000-4000-8000-000000000301';
const SHORT_ROUTE_ID = '00000000-0000-4000-8000-000000000302';
const LIVE_CONFIG_VERSION_ID = '00000000-0000-4000-8000-000000000001';

const ROUTE_SEGMENTS: Record<string, RouteSegment[]> = {
  [TUTORIAL_ROUTE_ID]: [
    {
      segmentId: '00000000-0000-4000-8000-000000000401',
      segmentIndex: 0,
      startKm: 0,
      endKm: 34,
      terrainType: 'coast',
      speedMultiplier: 1,
      fuelMultiplier: 1,
      cleanlinessMultiplier: 1,
      durabilityMultiplier: 1,
    },
    {
      segmentId: '00000000-0000-4000-8000-000000000402',
      segmentIndex: 1,
      startKm: 34,
      endKm: 70,
      terrainType: 'forest',
      speedMultiplier: 0.92,
      fuelMultiplier: 1,
      cleanlinessMultiplier: 1.08,
      durabilityMultiplier: 1.02,
    },
    {
      segmentId: '00000000-0000-4000-8000-000000000403',
      segmentIndex: 2,
      startKm: 70,
      endKm: 100,
      terrainType: 'highway',
      speedMultiplier: 1.08,
      fuelMultiplier: 0.95,
      cleanlinessMultiplier: 0.95,
      durabilityMultiplier: 0.95,
    },
  ],
};

const ROUTE_LANDMARKS: Record<string, Landmark[]> = {
  [TUTORIAL_ROUTE_ID]: [
    {
      landmarkId: '00000000-0000-4000-8000-000000000501',
      landmarkKey: 'first_lighthouse',
      name: 'First Lighthouse',
      distanceKm: 40,
      requiredStop: true,
      rarity: 'Common',
      basePhotoCoins: 80,
      photoCardKey: 'photo_first_lighthouse_v1',
    },
  ],
};

const ROUTES: RouteDefinition[] = [
  {
    routeId: TUTORIAL_ROUTE_ID,
    configVersionId: LIVE_CONFIG_VERSION_ID,
    routeKey: 'tutorial_coast_001',
    name: 'Bay Town to Lighthouse Road',
    region: 'Starter Coast',
    startNode: 'Bay Town',
    destinationNode: 'Lighthouse Road',
    routeType: 'Tutorial',
    totalDistanceKm: 100,
    difficulty: 1,
    unlockCostStamps: 0,
    tripPrepFeeCoins: 0,
    rewardMultiplier: 1,
    backgroundPackId: 'bg_coast_pixel_v1',
    isUnlocked: true,
  },
  {
    routeId: SHORT_ROUTE_ID,
    configVersionId: LIVE_CONFIG_VERSION_ID,
    routeKey: 'short_forest_001',
    name: 'Pine Loop Scenic Drive',
    region: 'Starter Forest',
    startNode: 'Lighthouse Road',
    destinationNode: 'Pine Loop',
    routeType: 'Short',
    totalDistanceKm: 180,
    difficulty: 2,
    unlockCostStamps: 2,
    tripPrepFeeCoins: 70,
    rewardMultiplier: 1.08,
    backgroundPackId: 'bg_forest_pixel_v1',
    isUnlocked: false,
  },
];

export class InMemoryGameDataStore implements GameDataStore {
  private readonly playersByIdentity = new Map<string, InternalPlayer>();
  private readonly balancesByPlayer = new Map<string, Map<Currency, number>>();
  private readonly vehiclesByPlayer = new Map<string, PlayerVehicle[]>();
  private readonly transactionsByPlayerAndKey = new Map<string, WalletTransaction>();
  private readonly unlockedRoutesByPlayer = new Map<string, Set<string>>();
  private readonly tripsByPlayer = new Map<string, Trip[]>();
  private readonly tripByPlayerAndIdempotencyKey = new Map<string, Trip>();
  private readonly abandonedTripByPlayerAndIdempotencyKey = new Map<string, Trip>();
  private readonly driveTickResultByPlayerAndIdempotencyKey = new Map<string, DriveTickResult>();
  private readonly completeLandmarkResultByPlayerAndIdempotencyKey = new Map<string, CompleteLandmarkResult>();
  private readonly vehicleMaintenanceResultByPlayerAndIdempotencyKey = new Map<string, VehicleMaintenanceResult>();
  private readonly offlineReports: OfflineReport[] = [];
  private readonly playerPhotos: PlayerPhoto[] = [];
  private readonly analyticsEvents: InternalAnalyticsEvent[] = [];

  async getOrCreatePlayerState(identity: AuthIdentity): Promise<PlayerState> {
    const profile = await this.getOrCreatePlayerProfile(identity);
    this.ensurePlayerDefaults(profile.playerId);
    const pendingOfflineReport = this.getOrCreatePendingOfflineReport(profile);
    this.touchPlayerLastSeen(profile.playerId);

    return {
      profile: { ...profile },
      walletBalances: await this.getWalletBalances(profile.playerId),
      vehicles: [...(this.vehiclesByPlayer.get(profile.playerId) ?? [])],
      pendingOfflineReport,
    };
  }

  async getOrCreatePlayerProfile(identity: AuthIdentity): Promise<PlayerProfile> {
    const key = this.identityKey(identity);
    const existing = this.playersByIdentity.get(key);
    if (existing) {
      return existing;
    }

    const now = new Date().toISOString();
    const player: PlayerProfile = {
      playerId: randomUUID(),
      authProvider: identity.authProvider,
      externalId: identity.externalId,
      displayName: identity.displayName ?? null,
      timezone: identity.timezone ?? 'UTC',
      tutorialState: 'NOT_STARTED',
      currentVehicleId: null,
      lastSeenAt: now,
      createdAt: now,
      updatedAt: now,
    };

    this.playersByIdentity.set(key, player);
    this.ensurePlayerDefaults(player.playerId);
    return player;
  }

  async getWalletBalances(playerId: string): Promise<WalletBalance[]> {
    this.ensurePlayerDefaults(playerId);
    const balances = this.balancesByPlayer.get(playerId);

    return CURRENCIES.map((currency) => ({
      currency,
      balance: balances?.get(currency) ?? 0,
    }));
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
      return [this.routeWithPlayerUnlock(ROUTES[0], state.profile.playerId)];
    }

    return ROUTES
      .filter((route) => route.routeType === 'Tutorial' || this.isRouteUnlocked(state.profile.playerId, route.routeId))
      .map((route) => this.routeWithPlayerUnlock(route, state.profile.playerId));
  }

  async getRoute(identity: AuthIdentity, routeId: string): Promise<RouteDefinition | null> {
    const state = await this.getOrCreatePlayerState(identity);
    const route = ROUTES.find((candidate) => candidate.routeId === routeId || candidate.routeKey === routeId);
    if (!route) {
      return null;
    }

    return this.routeWithDetails(this.routeWithPlayerUnlock(route, state.profile.playerId));
  }

  async getCurrentTrip(identity: AuthIdentity): Promise<Trip | null> {
    const state = await this.getOrCreatePlayerState(identity);
    const trip = this.findRunningTrip(state.profile.playerId);
    return trip ? this.tripWithRoute(trip) : null;
  }

  async startTrip(identity: AuthIdentity, input: StartTripInput): Promise<Trip> {
    const state = await this.getOrCreatePlayerState(identity);
    const playerId = state.profile.playerId;
    const existingForKey = this.findTripByIdempotencyKey(playerId, input.idempotencyKey);
    if (existingForKey) {
      return this.tripWithRoute(existingForKey);
    }

    if (this.findRunningTrip(playerId)) {
      throw new Error('ACTIVE_TRIP_EXISTS');
    }

    const route = ROUTES.find((candidate) => candidate.routeId === input.routeId || candidate.routeKey === input.routeId);
    if (!route) {
      throw new Error('ROUTE_NOT_FOUND');
    }
    if (route.routeType !== 'Tutorial' && !this.isRouteUnlocked(playerId, route.routeId)) {
      throw new Error('ROUTE_LOCKED');
    }

    const playerVehicle = state.vehicles.find((vehicle) => vehicle.playerVehicleId === (input.playerVehicleId ?? state.profile.currentVehicleId));
    if (!playerVehicle) {
      throw new Error('VEHICLE_NOT_FOUND');
    }

    const now = new Date().toISOString();
    const trip: Trip = {
      tripId: randomUUID(),
      playerId,
      routeId: route.routeId,
      routeConfigVersion: route.configVersionId,
      playerVehicleId: playerVehicle.playerVehicleId,
      status: 'ACTIVE',
      currentDistanceKm: 0,
      elapsedRealSeconds: 0,
      onlineTokenMeterKm: 0,
      offlineTokenMeterKm: 0,
      lastSimulatedAt: now,
      startedAt: now,
      completedAt: null,
      forcedStopReason: null,
    };

    this.tripsByPlayer.set(playerId, [...(this.tripsByPlayer.get(playerId) ?? []), trip]);
    this.tripByPlayerAndIdempotencyKey.set(`${playerId}:${input.idempotencyKey}`, trip);
    this.lockVehicle(playerId, playerVehicle.playerVehicleId, trip.tripId);
    if (state.profile.tutorialState === 'NOT_STARTED') {
      this.transitionTutorialState(playerId, 'ROUTE_SELECTED');
    }
    return this.tripWithRoute(trip);
  }

  async abandonTrip(identity: AuthIdentity, input: AbandonTripInput): Promise<Trip> {
    const state = await this.getOrCreatePlayerState(identity);
    const playerId = state.profile.playerId;
    const existingForKey = this.abandonedTripByPlayerAndIdempotencyKey.get(`${playerId}:${input.idempotencyKey}`);
    if (existingForKey) {
      return this.tripWithRoute(existingForKey);
    }

    const trip = input.tripId
      ? this.tripsByPlayer.get(playerId)?.find((candidate) => candidate.tripId === input.tripId)
      : this.findRunningTrip(playerId);
    if (!trip) {
      throw new Error('ACTIVE_TRIP_NOT_FOUND');
    }
    if (trip.status === 'ABANDONED') {
      return this.tripWithRoute(trip);
    }

    trip.status = 'ABANDONED';
    this.unlockVehicle(playerId, trip.playerVehicleId, trip.tripId);
    this.abandonedTripByPlayerAndIdempotencyKey.set(`${playerId}:${input.idempotencyKey}`, trip);
    return this.tripWithRoute(trip);
  }

  async driveTick(identity: AuthIdentity, input: DriveTickInput): Promise<DriveTickResult> {
    const profile = await this.getOrCreatePlayerProfile(identity);
    this.ensurePlayerDefaults(profile.playerId);
    const playerId = profile.playerId;
    const idempotencyKey = `${playerId}:${input.idempotencyKey}`;
    const existingForKey = this.driveTickResultByPlayerAndIdempotencyKey.get(idempotencyKey);
    if (existingForKey) {
      return this.cloneDriveTickResult(existingForKey);
    }

    const trip = this.tripsByPlayer
      .get(playerId)
      ?.find((candidate) => candidate.tripId === input.tripId);
    if (!trip) {
      throw new Error('TRIP_NOT_FOUND');
    }
    if (trip.status !== 'ACTIVE') {
      throw new Error('TRIP_NOT_ACTIVE');
    }
    if (!isOnlineDriveModeUnlocked(profile.tutorialState, input.mode)) {
      throw new Error('MODE_LOCKED');
    }

    const vehicle = this.vehiclesByPlayer
      .get(playerId)
      ?.find((candidate) => candidate.playerVehicleId === trip.playerVehicleId);
    if (!vehicle) {
      throw new Error('VEHICLE_NOT_FOUND');
    }

    const baseRoute = ROUTES.find((candidate) => candidate.routeId === trip.routeId);
    if (!baseRoute) {
      throw new Error('ROUTE_NOT_FOUND');
    }
    const route = this.routeWithDetails(baseRoute);
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
      segments: route.segments ?? [],
      landmarks: (route.landmarks ?? []).map((landmark) => ({
        landmarkId: landmark.landmarkId,
        distanceKm: landmark.distanceKm,
        requiredStop: landmark.requiredStop,
      })),
    });

    trip.currentDistanceKm = simulation.finalDistanceKm;
    trip.elapsedRealSeconds = simulation.updatedElapsedRealSeconds;
    trip.onlineTokenMeterKm = simulation.updatedOnlineTokenMeterKm;
    trip.lastSimulatedAt = now.toISOString();
    trip.status = simulation.updatedTripStatus;
    trip.forcedStopReason = simulation.forcedStopReason;
    this.transitionTutorialState(
      playerId,
      nextTutorialStateAfterDriveTick({
        currentState: profile.tutorialState,
        mode: input.mode,
        distanceGainKm: simulation.distanceGainKm,
        finalDistanceKm: simulation.finalDistanceKm,
        forcedStopReason: simulation.forcedStopReason,
      }),
    );

    vehicle.currentFuel = simulation.updatedFuel;
    vehicle.currentCleanliness = simulation.updatedCleanliness;
    vehicle.currentDurability = simulation.updatedDurability;

    const walletTransactions: WalletTransaction[] = [];
    if (simulation.rewards.roadCoins > 0) {
      walletTransactions.push(
        await this.grantWallet({
          playerId,
          currency: 'ROAD_COINS',
          amount: simulation.rewards.roadCoins,
          reason: 'ONLINE_DRIVE_REWARD',
          sourceType: 'TRIP_DRIVE_TICK',
          sourceId: trip.tripId,
          idempotencyKey: `${input.idempotencyKey}:road_coins`,
        }),
      );
    }
    if (simulation.rewards.travelTokens > 0) {
      walletTransactions.push(
        await this.grantWallet({
          playerId,
          currency: 'TRAVEL_TOKENS',
          amount: simulation.rewards.travelTokens,
          reason: 'ONLINE_DRIVE_REWARD',
          sourceType: 'TRIP_DRIVE_TICK',
          sourceId: trip.tripId,
          idempotencyKey: `${input.idempotencyKey}:travel_tokens`,
        }),
      );
    }

    const result: DriveTickResult = {
      trip: this.tripWithRoute(trip),
      vehicle: { ...vehicle },
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
      walletBalances: await this.getWalletBalances(playerId),
      walletTransactions,
    };

    this.analyticsEvents.push({
      playerId,
      eventName: 'drive_tick',
      sourceType: 'TRIP',
      sourceId: trip.tripId,
      eventPayload: {
        mode: input.mode,
        client_tick_seq: input.clientTickSeq,
        duration_seconds: simulation.durationSeconds,
        distance_gain_km: simulation.distanceGainKm,
        forced_stop_reason: simulation.forcedStopReason,
        road_coins: simulation.rewards.roadCoins,
        travel_tokens: simulation.rewards.travelTokens,
      },
      occurredAt: now.toISOString(),
    });
    if (simulation.forcedStopReason === 'LANDMARK_REQUIRED') {
      this.analyticsEvents.push({
        playerId,
        eventName: 'stopped_at_landmark',
        sourceType: 'TRIP',
        sourceId: trip.tripId,
        eventPayload: {
          landmark_id: simulation.landmarkId,
          distance_km: simulation.finalDistanceKm,
        },
        occurredAt: now.toISOString(),
      });
    }

    this.driveTickResultByPlayerAndIdempotencyKey.set(idempotencyKey, this.cloneDriveTickResult(result));
    this.touchPlayerLastSeen(playerId);
    return result;
  }

  async completeLandmark(identity: AuthIdentity, input: CompleteLandmarkInput): Promise<CompleteLandmarkResult> {
    const state = await this.getOrCreatePlayerState(identity);
    const playerId = state.profile.playerId;
    const idempotencyKey = `${playerId}:${input.idempotencyKey}`;
    const existingForKey = this.completeLandmarkResultByPlayerAndIdempotencyKey.get(idempotencyKey);
    if (existingForKey) {
      return this.cloneCompleteLandmarkResult(existingForKey);
    }

    const trip = this.tripsByPlayer
      .get(playerId)
      ?.find((candidate) => candidate.tripId === input.tripId);
    if (!trip) {
      throw new Error('TRIP_NOT_FOUND');
    }
    if (trip.status !== 'FORCED_STOP' || trip.forcedStopReason !== 'LANDMARK_REQUIRED') {
      throw new Error('LANDMARK_STOP_REQUIRED');
    }

    const route = ROUTES.find((candidate) => candidate.routeId === trip.routeId);
    if (!route) {
      throw new Error('ROUTE_NOT_FOUND');
    }
    const landmark = (ROUTE_LANDMARKS[route.routeId] ?? []).find(
      (candidate) => candidate.landmarkId === input.landmarkId,
    );
    if (!landmark || trip.currentDistanceKm < landmark.distanceKm) {
      throw new Error('LANDMARK_NOT_FOUND');
    }

    const existingFirstPhoto = this.playerPhotos.find(
      (photo) => photo.playerId === playerId && photo.landmarkId === landmark.landmarkId && photo.isFirstPhoto,
    );
    if (existingFirstPhoto) {
      throw new Error('LANDMARK_ALREADY_COMPLETED');
    }

    const vehicle = this.vehiclesByPlayer
      .get(playerId)
      ?.find((candidate) => candidate.playerVehicleId === trip.playerVehicleId);
    if (!vehicle) {
      throw new Error('VEHICLE_NOT_FOUND');
    }

    const rewardTx = await this.grantWallet({
      playerId,
      currency: 'ROAD_COINS',
      amount: landmark.basePhotoCoins,
      reason: 'PHOTO_FIRST_REWARD',
      sourceType: 'LANDMARK_PHOTO',
      sourceId: landmark.landmarkId,
      idempotencyKey: `${input.idempotencyKey}:first_photo_reward`,
    });
    const now = new Date().toISOString();
    const photo: PlayerPhoto = {
      photoId: randomUUID(),
      playerId,
      tripId: trip.tripId,
      landmarkId: landmark.landmarkId,
      photoCardKey: landmark.photoCardKey,
      qualityScore: calculatePhotoQualityScore({ vehicle, landmark }),
      weather: 'sunny',
      dayPhase: 'day',
      cleanlinessAtShot: vehicle.currentCleanliness,
      isFirstPhoto: true,
      rewardTxId: rewardTx.transactionId,
      takenAt: now,
    };
    this.playerPhotos.push(photo);

    trip.status = 'ACTIVE';
    trip.forcedStopReason = null;
    trip.lastSimulatedAt = now;
    this.transitionTutorialState(playerId, nextTutorialStateAfterPhoto(state.profile.tutorialState));

    this.analyticsEvents.push({
      playerId,
      eventName: 'photo_taken',
      sourceType: 'LANDMARK',
      sourceId: landmark.landmarkId,
      eventPayload: {
        trip_id: trip.tripId,
        photo_id: photo.photoId,
        quality_score: photo.qualityScore,
        is_first_photo: true,
      },
      occurredAt: now,
    });

    const profile = this.findPlayerById(playerId) ?? state.profile;
    const result: CompleteLandmarkResult = {
      trip: this.tripWithRoute(trip),
      profile: { ...profile },
      photo,
      walletBalances: await this.getWalletBalances(playerId),
      walletTransactions: [rewardTx],
    };

    this.completeLandmarkResultByPlayerAndIdempotencyKey.set(idempotencyKey, this.cloneCompleteLandmarkResult(result));
    return result;
  }

  async claimOfflineReport(identity: AuthIdentity, input: ClaimOfflineReportInput): Promise<ClaimOfflineReportResult> {
    const profile = await this.getOrCreatePlayerProfile(identity);
    this.ensurePlayerDefaults(profile.playerId);
    const playerId = profile.playerId;
    const report = this.offlineReports.find(
      (candidate) => candidate.playerId === playerId && candidate.reportId === input.reportId,
    );
    if (!report) {
      throw new Error('REPORT_NOT_FOUND');
    }

    if (report.claimed) {
      if (report.claimIdempotencyKey !== input.idempotencyKey) {
        throw new Error('REPORT_ALREADY_CLAIMED');
      }
      return {
        report: { ...report },
        walletBalances: await this.getWalletBalances(playerId),
        walletTransactions: this.getOfflineClaimTransactions(playerId, input.idempotencyKey),
      };
    }

    const walletTransactions: WalletTransaction[] = [];
    if (report.roadCoinsPending > 0) {
      walletTransactions.push(
        await this.grantWallet({
          playerId,
          currency: 'ROAD_COINS',
          amount: report.roadCoinsPending,
          reason: 'OFFLINE_REPORT_CLAIM',
          sourceType: 'OFFLINE_REPORT',
          sourceId: report.reportId,
          idempotencyKey: `${input.idempotencyKey}:road_coins`,
        }),
      );
    }
    if (report.travelTokensPending > 0) {
      walletTransactions.push(
        await this.grantWallet({
          playerId,
          currency: 'TRAVEL_TOKENS',
          amount: report.travelTokensPending,
          reason: 'OFFLINE_REPORT_CLAIM',
          sourceType: 'OFFLINE_REPORT',
          sourceId: report.reportId,
          idempotencyKey: `${input.idempotencyKey}:travel_tokens`,
        }),
      );
    }

    report.claimed = true;
    report.claimedAt = new Date().toISOString();
    report.claimIdempotencyKey = input.idempotencyKey;
    this.analyticsEvents.push({
      playerId,
      eventName: 'offline_report_claimed',
      sourceType: 'OFFLINE_REPORT',
      sourceId: report.reportId,
      eventPayload: {
        trip_id: report.tripId,
        distance_travelled_km: report.distanceTravelledKm,
        road_coins: report.roadCoinsPending,
        travel_tokens: report.travelTokensPending,
      },
      occurredAt: report.claimedAt,
    });

    return {
      report: { ...report },
      walletBalances: await this.getWalletBalances(playerId),
      walletTransactions,
    };
  }

  async maintainVehicle(identity: AuthIdentity, input: VehicleMaintenanceInput): Promise<VehicleMaintenanceResult> {
    const profile = await this.getOrCreatePlayerProfile(identity);
    this.ensurePlayerDefaults(profile.playerId);
    const playerId = profile.playerId;
    const resultKey = `${playerId}:${input.idempotencyKey}`;
    const existingForKey = this.vehicleMaintenanceResultByPlayerAndIdempotencyKey.get(resultKey);
    if (existingForKey) {
      return this.cloneVehicleMaintenanceResult(existingForKey);
    }

    const vehicle = this.vehiclesByPlayer
      .get(playerId)
      ?.find((candidate) => candidate.playerVehicleId === (input.playerVehicleId ?? profile.currentVehicleId));
    if (!vehicle) {
      throw new Error('VEHICLE_NOT_FOUND');
    }

    const maintenance = calculateVehicleMaintenance(input.action, vehicle);
    const walletTransaction = await this.spendWallet({
      playerId,
      currency: 'ROAD_COINS',
      amount: maintenance.costRoadCoins,
      reason: this.maintenanceReason(input.action),
      sourceType: 'VEHICLE_MAINTENANCE',
      sourceId: vehicle.playerVehicleId,
      idempotencyKey: `${input.idempotencyKey}:road_coins`,
    });

    vehicle.currentFuel = maintenance.targetFuel;
    vehicle.currentCleanliness = maintenance.targetCleanliness;
    vehicle.currentDurability = maintenance.targetDurability;

    this.analyticsEvents.push({
      playerId,
      eventName: 'vehicle_maintenance_completed',
      sourceType: 'VEHICLE',
      sourceId: vehicle.playerVehicleId,
      eventPayload: {
        action: input.action,
        cost_road_coins: maintenance.costRoadCoins,
        restored_amount: maintenance.restoredAmount,
      },
      occurredAt: new Date().toISOString(),
    });

    const result: VehicleMaintenanceResult = {
      action: input.action,
      vehicle: { ...vehicle },
      costRoadCoins: maintenance.costRoadCoins,
      restoredAmount: maintenance.restoredAmount,
      walletBalances: await this.getWalletBalances(playerId),
      walletTransactions: [walletTransaction],
    };

    this.vehicleMaintenanceResultByPlayerAndIdempotencyKey.set(resultKey, this.cloneVehicleMaintenanceResult(result));
    this.touchPlayerLastSeen(playerId);
    return result;
  }

  private mutateWallet(input: WalletMutationInput, signedAmount: number): WalletTransaction {
    this.ensurePlayerDefaults(input.playerId);
    const txKey = `${input.playerId}:${input.idempotencyKey}`;
    const existing = this.transactionsByPlayerAndKey.get(txKey);
    if (existing) {
      return existing;
    }

    const balances = this.balancesByPlayer.get(input.playerId);
    if (!balances) {
      throw new Error('Player wallet is not initialized');
    }

    const balanceBefore = balances.get(input.currency) ?? 0;
    const balanceAfter = balanceBefore + signedAmount;
    if (balanceAfter < 0) {
      throw new Error('INSUFFICIENT_FUNDS');
    }

    balances.set(input.currency, balanceAfter);
    const transaction: WalletTransaction = {
      transactionId: randomUUID(),
      playerId: input.playerId,
      currency: input.currency,
      amount: signedAmount,
      balanceBefore,
      balanceAfter,
      reason: input.reason,
      sourceType: input.sourceType,
      sourceId: input.sourceId ?? null,
      idempotencyKey: input.idempotencyKey,
      createdAt: new Date().toISOString(),
    };

    this.transactionsByPlayerAndKey.set(txKey, transaction);
    return transaction;
  }

  private ensurePlayerDefaults(playerId: string): void {
    if (!this.balancesByPlayer.has(playerId)) {
      this.balancesByPlayer.set(
        playerId,
        new Map(CURRENCIES.map((currency) => [currency, 0])),
      );
    }

    const vehicles = this.vehiclesByPlayer.get(playerId) ?? [];
    if (vehicles.length === 0) {
      const playerVehicle: PlayerVehicle = {
        playerVehicleId: randomUUID(),
        vehicleDefId: DEFAULT_VEHICLE_DEF.vehicleDefId,
        vehicleKey: DEFAULT_VEHICLE_DEF.vehicleKey,
        displayName: DEFAULT_VEHICLE_DEF.displayName,
        baseSpeedKmph: DEFAULT_VEHICLE_DEF.baseSpeedKmph,
        fuelCapacity: DEFAULT_VEHICLE_DEF.fuelCapacity,
        fuelConsumptionPerKm: DEFAULT_VEHICLE_DEF.fuelConsumptionPerKm,
        durabilityLossPerKm: DEFAULT_VEHICLE_DEF.durabilityLossPerKm,
        cleanlinessLossPerKm: DEFAULT_VEHICLE_DEF.cleanlinessLossPerKm,
        offlineEfficiency: DEFAULT_VEHICLE_DEF.offlineEfficiency,
        weatherResistance: DEFAULT_VEHICLE_DEF.weatherResistance,
        currentFuel: DEFAULT_VEHICLE_DEF.fuelCapacity,
        currentDurability: 100,
        currentCleanliness: 100,
        selectedSkinId: DEFAULT_VEHICLE_DEF.defaultSkinId,
        upgradeLevel: 1,
        isSelected: true,
      };
      this.vehiclesByPlayer.set(playerId, [playerVehicle]);
      this.setCurrentVehicle(playerId, playerVehicle.playerVehicleId);
    }
  }

  private getOrCreatePendingOfflineReport(profile: PlayerProfile): OfflineReport | null {
    const pending = this.offlineReports.find((report) => report.playerId === profile.playerId && !report.claimed);
    if (pending) {
      return { ...pending };
    }

    const trip = this.tripsByPlayer
      .get(profile.playerId)
      ?.find((candidate) => candidate.status === 'ACTIVE');
    if (!trip) {
      return null;
    }

    const vehicle = this.vehiclesByPlayer
      .get(profile.playerId)
      ?.find((candidate) => candidate.playerVehicleId === trip.playerVehicleId);
    const route = ROUTES.find((candidate) => candidate.routeId === trip.routeId);
    if (!vehicle || !route) {
      return null;
    }

    const routeDetails = this.routeWithDetails(route);
    const now = new Date();
    const simulation = simulateOfflineProgress({
      now,
      lastSeenAt: new Date(profile.lastSeenAt),
      lastSimulatedAt: new Date(trip.lastSimulatedAt),
      currentDistanceKm: trip.currentDistanceKm,
      elapsedRealSeconds: trip.elapsedRealSeconds,
      previousOfflineTokenMeterKm: trip.offlineTokenMeterKm,
      routeTotalDistanceKm: routeDetails.totalDistanceKm,
      routeRewardMultiplier: routeDetails.rewardMultiplier,
      vehicle,
      segments: routeDetails.segments ?? [],
      landmarks: (routeDetails.landmarks ?? []).map((landmark) => ({
        landmarkId: landmark.landmarkId,
        distanceKm: landmark.distanceKm,
        requiredStop: landmark.requiredStop,
        completed: this.hasFirstPhoto(profile.playerId, landmark.landmarkId),
      })),
    });
    if (simulation.offlineSeconds < DEFAULT_SIMULATION_CONFIG.offline.minOfflineReportSeconds) {
      return null;
    }

    trip.currentDistanceKm = simulation.finalDistanceKm;
    trip.elapsedRealSeconds = simulation.updatedElapsedRealSeconds;
    trip.offlineTokenMeterKm = simulation.updatedOfflineTokenMeterKm;
    trip.lastSimulatedAt = now.toISOString();
    trip.status = simulation.updatedTripStatus;
    trip.forcedStopReason = simulation.forcedStopReason;

    vehicle.currentFuel = simulation.updatedFuel;
    vehicle.currentCleanliness = simulation.updatedCleanliness;
    vehicle.currentDurability = simulation.updatedDurability;

    if (simulation.forcedStopReason === 'LANDMARK_REQUIRED') {
      this.transitionTutorialState(profile.playerId, 'FIRST_LANDMARK_REACHED');
    }

    const landmark = simulation.landmarkId
      ? (routeDetails.landmarks ?? []).find((candidate) => candidate.landmarkId === simulation.landmarkId)
      : undefined;
    const report: OfflineReport = {
      reportId: randomUUID(),
      playerId: profile.playerId,
      tripId: trip.tripId,
      generatedAt: now.toISOString(),
      offlineSeconds: simulation.offlineSeconds,
      distanceTravelledKm: simulation.distanceTravelledKm,
      roadCoinsPending: simulation.rewards.roadCoins,
      travelTokensPending: simulation.rewards.travelTokens,
      fuelUsed: simulation.fuelUsed,
      cleanlinessLoss: simulation.cleanlinessLoss,
      durabilityLoss: simulation.durabilityLoss,
      weatherSummary: { weather: 'sunny' },
      landmarkReached: landmark
        ? {
            landmarkId: landmark.landmarkId,
            landmarkKey: landmark.landmarkKey,
            name: landmark.name,
          }
        : null,
      forcedStopReason: simulation.forcedStopReason,
      claimed: false,
      claimedAt: null,
      claimIdempotencyKey: null,
    };
    this.offlineReports.push(report);
    this.analyticsEvents.push({
      playerId: profile.playerId,
      eventName: 'offline_report_generated',
      sourceType: 'OFFLINE_REPORT',
      sourceId: report.reportId,
      eventPayload: {
        trip_id: trip.tripId,
        offline_seconds: report.offlineSeconds,
        distance_travelled_km: report.distanceTravelledKm,
        forced_stop_reason: report.forcedStopReason,
      },
      occurredAt: report.generatedAt,
    });
    return { ...report };
  }

  private routeWithDetails(route: RouteDefinition): RouteDefinition {
    return {
      ...route,
      segments: ROUTE_SEGMENTS[route.routeId] ?? [],
      landmarks: ROUTE_LANDMARKS[route.routeId] ?? [],
    };
  }

  private routeWithPlayerUnlock(route: RouteDefinition, playerId: string): RouteDefinition {
    return {
      ...route,
      isUnlocked: route.routeType === 'Tutorial' || this.isRouteUnlocked(playerId, route.routeId),
    };
  }

  private tripWithRoute(trip: Trip): Trip {
    const route = ROUTES.find((candidate) => candidate.routeId === trip.routeId);
    return {
      ...trip,
      route: route ? this.routeWithDetails(route) : undefined,
    };
  }

  private hasFullRouteAccess(player: PlayerProfile): boolean {
    return ['ROUTE_COMPLETED', 'FULL_SYSTEM_UNLOCKED'].includes(player.tutorialState);
  }

  private isRouteUnlocked(playerId: string, routeId: string): boolean {
    return this.unlockedRoutesByPlayer.get(playerId)?.has(routeId) ?? false;
  }

  private findRunningTrip(playerId: string): Trip | undefined {
    return this.tripsByPlayer
      .get(playerId)
      ?.find((trip) => ['ACTIVE', 'PAUSED', 'FORCED_STOP'].includes(trip.status));
  }

  private findTripByIdempotencyKey(playerId: string, idempotencyKey: string): Trip | undefined {
    return this.tripByPlayerAndIdempotencyKey.get(`${playerId}:${idempotencyKey}`);
  }

  private lockVehicle(playerId: string, playerVehicleId: string, tripId: string): void {
    const vehicles = this.vehiclesByPlayer.get(playerId) ?? [];
    const vehicle = vehicles.find((candidate) => candidate.playerVehicleId === playerVehicleId);
    if (vehicle) {
      (vehicle as PlayerVehicle & { lockedInTripId?: string }).lockedInTripId = tripId;
    }
  }

  private unlockVehicle(playerId: string, playerVehicleId: string, tripId: string): void {
    const vehicles = this.vehiclesByPlayer.get(playerId) ?? [];
    const vehicle = vehicles.find((candidate) => candidate.playerVehicleId === playerVehicleId);
    if (vehicle && (vehicle as PlayerVehicle & { lockedInTripId?: string }).lockedInTripId === tripId) {
      delete (vehicle as PlayerVehicle & { lockedInTripId?: string }).lockedInTripId;
    }
  }

  private transitionTutorialState(playerId: string, nextState: string): void {
    for (const player of this.playersByIdentity.values()) {
      if (player.playerId === playerId && player.tutorialState !== nextState) {
        if (['PHOTO_TAKEN', 'ROUTE_COMPLETED', 'FULL_SYSTEM_UNLOCKED'].includes(player.tutorialState) && nextState === 'FIRST_LANDMARK_REACHED') {
          return;
        }
        player.tutorialState = nextState;
        player.updatedAt = new Date().toISOString();
      }
    }
  }

  private setCurrentVehicle(playerId: string, playerVehicleId: string): void {
    for (const player of this.playersByIdentity.values()) {
      if (player.playerId === playerId && !player.currentVehicleId) {
        player.currentVehicleId = playerVehicleId;
        player.updatedAt = new Date().toISOString();
      }
    }
  }

  private identityKey(identity: AuthIdentity): string {
    return `${identity.authProvider}:${identity.externalId}`;
  }

  private cloneDriveTickResult(result: DriveTickResult): DriveTickResult {
    return JSON.parse(JSON.stringify(result)) as DriveTickResult;
  }

  private cloneCompleteLandmarkResult(result: CompleteLandmarkResult): CompleteLandmarkResult {
    return JSON.parse(JSON.stringify(result)) as CompleteLandmarkResult;
  }

  private cloneVehicleMaintenanceResult(result: VehicleMaintenanceResult): VehicleMaintenanceResult {
    return JSON.parse(JSON.stringify(result)) as VehicleMaintenanceResult;
  }

  private maintenanceReason(action: VehicleMaintenanceInput['action']): string {
    return {
      REFUEL: 'VEHICLE_REFUEL',
      CLEAN: 'VEHICLE_CLEAN',
      REPAIR: 'VEHICLE_REPAIR',
    }[action];
  }

  private findPlayerById(playerId: string): PlayerProfile | undefined {
    for (const player of this.playersByIdentity.values()) {
      if (player.playerId === playerId) {
        return player;
      }
    }
    return undefined;
  }

  private touchPlayerLastSeen(playerId: string): void {
    for (const player of this.playersByIdentity.values()) {
      if (player.playerId === playerId) {
        const now = new Date().toISOString();
        player.lastSeenAt = now;
        player.updatedAt = now;
      }
    }
  }

  private hasFirstPhoto(playerId: string, landmarkId: string): boolean {
    return this.playerPhotos.some(
      (photo) => photo.playerId === playerId && photo.landmarkId === landmarkId && photo.isFirstPhoto,
    );
  }

  private getOfflineClaimTransactions(playerId: string, claimIdempotencyKey: string): WalletTransaction[] {
    return [`${claimIdempotencyKey}:road_coins`, `${claimIdempotencyKey}:travel_tokens`]
      .map((idempotencyKey) => this.transactionsByPlayerAndKey.get(`${playerId}:${idempotencyKey}`))
      .filter((transaction): transaction is WalletTransaction => Boolean(transaction));
  }
}
