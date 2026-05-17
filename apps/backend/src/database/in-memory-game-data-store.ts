import { randomUUID } from 'node:crypto';
import {
  AnalyticsEvent,
  AuthIdentity,
  CURRENCIES,
  Currency,
  CurrencyReward,
  AbandonTripInput,
  ClaimDailyLoginInput,
  ClaimDailyLoginResult,
  ClaimDailyQuestInput,
  ClaimDailyQuestResult,
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
  DailyLoginStatus,
  DailyQuest,
  DailyQuestListResult,
  PlayerProfile,
  PlayerPhoto,
  PlayerState,
  PlayerVehicle,
  RecordSuspiciousEventInput,
  RouteDefinition,
  RouteUnlockResult,
  RouteSegment,
  StartTripInput,
  Trip,
  SuspiciousEvent,
  UnlockRouteInput,
  QuestEventName,
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
type InternalSuspiciousEvent = SuspiciousEvent;
type InternalDailyLoginClaim = {
  claimId: string;
  playerId: string;
  periodKey: string;
  weekKey: string;
  dayIndex: number;
  rewards: CurrencyReward[];
  idempotencyKey: string;
  claimedAt: string;
};
type DailyQuestDefinition = {
  questId: string;
  questKey: string;
  title: string;
  eventName: QuestEventName;
  targetValue: number;
  reward: CurrencyReward;
  sortOrder: number;
};
type InternalQuestProgress = {
  playerId: string;
  questId: string;
  periodKey: string;
  progressValue: number;
  completedAt: string | null;
  updatedAt: string;
};
type InternalQuestClaim = {
  claimId: string;
  playerId: string;
  questId: string;
  periodKey: string;
  idempotencyKey: string;
  rewardTxId: string;
  claimedAt: string;
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
      endKm: 35,
      terrainType: 'coastal_cliffs',
      speedMultiplier: 1,
      fuelMultiplier: 1,
      cleanlinessMultiplier: 1,
      durabilityMultiplier: 1,
    },
    {
      segmentId: '00000000-0000-4000-8000-000000000402',
      segmentIndex: 1,
      startKm: 35,
      endKm: 70,
      terrainType: 'bridge_coast',
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
      terrainType: 'south_coast_highway',
      speedMultiplier: 1.08,
      fuelMultiplier: 0.95,
      cleanlinessMultiplier: 0.95,
      durabilityMultiplier: 0.95,
    },
  ],
  [SHORT_ROUTE_ID]: [
    {
      segmentId: '00000000-0000-4000-8000-000000000411',
      segmentIndex: 0,
      startKm: 0,
      endKm: 30,
      terrainType: 'monterey_bay_coast',
      speedMultiplier: 1,
      fuelMultiplier: 1,
      cleanlinessMultiplier: 1,
      durabilityMultiplier: 1,
    },
    {
      segmentId: '00000000-0000-4000-8000-000000000412',
      segmentIndex: 1,
      startKm: 30,
      endKm: 65,
      terrainType: 'coastal_town',
      speedMultiplier: 0.96,
      fuelMultiplier: 1.02,
      cleanlinessMultiplier: 1.04,
      durabilityMultiplier: 1,
    },
    {
      segmentId: '00000000-0000-4000-8000-000000000413',
      segmentIndex: 2,
      startKm: 65,
      endKm: 95,
      terrainType: 'boardwalk_approach',
      speedMultiplier: 1.04,
      fuelMultiplier: 0.98,
      cleanlinessMultiplier: 0.98,
      durabilityMultiplier: 0.98,
    },
  ],
};

const ROUTE_LANDMARKS: Record<string, Landmark[]> = {
  [TUTORIAL_ROUTE_ID]: [
    {
      landmarkId: '00000000-0000-4000-8000-000000000501',
      landmarkKey: 'bixby_bridge_lookout',
      name: 'Bixby Bridge Lookout',
      distanceKm: 40,
      requiredStop: true,
      rarity: 'Common',
      basePhotoCoins: 80,
      photoCardKey: 'photo_bixby_bridge_v1',
    },
  ],
  [SHORT_ROUTE_ID]: [
    {
      landmarkId: '00000000-0000-4000-8000-000000000502',
      landmarkKey: 'santa_cruz_boardwalk',
      name: 'Santa Cruz Boardwalk',
      distanceKm: 82,
      requiredStop: true,
      rarity: 'Common',
      basePhotoCoins: 90,
      photoCardKey: 'photo_santa_cruz_boardwalk_v1',
    },
  ],
};

const ROUTES: RouteDefinition[] = [
  {
    routeId: TUTORIAL_ROUTE_ID,
    configVersionId: LIVE_CONFIG_VERSION_ID,
    routeKey: 'tutorial_big_sur_hwy1_001',
    name: 'Big Sur Sunset Drive',
    region: 'California Highway 1',
    startNode: 'Carmel Highlands',
    destinationNode: 'San Carpoforo Creek Approach',
    routeType: 'Tutorial',
    totalDistanceKm: 100,
    difficulty: 1,
    unlockCostStamps: 0,
    tripPrepFeeCoins: 0,
    rewardMultiplier: 1,
    backgroundPackId: 'bg_big_sur_sunset_v1',
    isUnlocked: true,
  },
  {
    routeId: SHORT_ROUTE_ID,
    configVersionId: LIVE_CONFIG_VERSION_ID,
    routeKey: 'short_coast_to_town_001',
    name: 'Big Sur to Santa Cruz Drive',
    region: 'California Central Coast',
    startNode: 'Monterey Bay',
    destinationNode: 'Santa Cruz Boardwalk',
    routeType: 'Short',
    totalDistanceKm: 95,
    difficulty: 2,
    unlockCostStamps: 1,
    tripPrepFeeCoins: 70,
    rewardMultiplier: 1.08,
    backgroundPackId: 'bg_santa_cruz_sunset_v1',
    isUnlocked: false,
  },
];

const TUTORIAL_COMPLETION_REWARDS = {
  roadCoins: 150,
  travelTokens: 1,
  souvenirStamps: 1,
};

const DAILY_QUEST_DEFINITIONS: DailyQuestDefinition[] = [
  {
    questId: '00000000-0000-4000-8000-000000000701',
    questKey: 'drive_online_distance',
    title: 'Drive online',
    eventName: 'DRIVE_DISTANCE_ONLINE',
    targetValue: 0.25,
    reward: { currency: 'ROAD_COINS', amount: 40 },
    sortOrder: 1,
  },
  {
    questId: '00000000-0000-4000-8000-000000000702',
    questKey: 'claim_offline_report',
    title: 'Claim a Travel Report',
    eventName: 'OFFLINE_REPORT_CLAIMED',
    targetValue: 1,
    reward: { currency: 'TRAVEL_TOKENS', amount: 1 },
    sortOrder: 2,
  },
  {
    questId: '00000000-0000-4000-8000-000000000703',
    questKey: 'refuel_vehicle',
    title: 'Refuel vehicle',
    eventName: 'VEHICLE_REFUELED',
    targetValue: 1,
    reward: { currency: 'ROAD_COINS', amount: 30 },
    sortOrder: 3,
  },
  {
    questId: '00000000-0000-4000-8000-000000000704',
    questKey: 'take_photo',
    title: 'Take a photo',
    eventName: 'PHOTO_TAKEN',
    targetValue: 1,
    reward: { currency: 'ROAD_COINS', amount: 50 },
    sortOrder: 4,
  },
  {
    questId: '00000000-0000-4000-8000-000000000705',
    questKey: 'complete_route',
    title: 'Complete a route',
    eventName: 'ROUTE_COMPLETED',
    targetValue: 1,
    reward: { currency: 'STAMP_FRAGMENTS', amount: 2 },
    sortOrder: 5,
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
  private readonly completeRouteResultByPlayerAndIdempotencyKey = new Map<string, CompleteRouteResult>();
  private readonly routeUnlockResultByPlayerAndIdempotencyKey = new Map<string, RouteUnlockResult>();
  private readonly vehicleMaintenanceResultByPlayerAndIdempotencyKey = new Map<string, VehicleMaintenanceResult>();
  private readonly dailyLoginClaims: InternalDailyLoginClaim[] = [];
  private readonly dailyLoginResultByPlayerAndIdempotencyKey = new Map<string, ClaimDailyLoginResult>();
  private readonly questProgressByPlayerQuestPeriod = new Map<string, InternalQuestProgress>();
  private readonly questClaims: InternalQuestClaim[] = [];
  private readonly questClaimResultByPlayerAndIdempotencyKey = new Map<string, ClaimDailyQuestResult>();
  private readonly offlineReports: OfflineReport[] = [];
  private readonly playerPhotos: PlayerPhoto[] = [];
  private readonly analyticsEvents: InternalAnalyticsEvent[] = [];
  private readonly suspiciousEvents: InternalSuspiciousEvent[] = [];

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

  async getDailyLogin(identity: AuthIdentity): Promise<DailyLoginStatus> {
    const profile = await this.getOrCreatePlayerProfile(identity);
    this.ensurePlayerDefaults(profile.playerId);
    return this.buildDailyLoginStatus(profile.playerId);
  }

  async claimDailyLogin(identity: AuthIdentity, input: ClaimDailyLoginInput): Promise<ClaimDailyLoginResult> {
    const profile = await this.getOrCreatePlayerProfile(identity);
    this.ensurePlayerDefaults(profile.playerId);
    const playerId = profile.playerId;
    const resultKey = `${playerId}:${input.idempotencyKey}`;
    const existingForKey = this.dailyLoginResultByPlayerAndIdempotencyKey.get(resultKey);
    if (existingForKey) {
      return this.cloneDailyLoginResult(existingForKey);
    }

    const now = new Date();
    const periodKey = this.periodKeyFor(now);
    const weekKey = this.weekKeyFor(now);
    const existingClaim = this.dailyLoginClaims.find(
      (claim) => claim.playerId === playerId && claim.periodKey === periodKey,
    );
    if (existingClaim) {
      throw new Error('DAILY_LOGIN_ALREADY_CLAIMED');
    }

    const dayIndex = this.dailyLoginDayIndex(playerId, weekKey);
    const rewards = this.dailyLoginRewardsFor(playerId, weekKey, dayIndex);
    const walletTransactions: WalletTransaction[] = [];
    for (const reward of rewards) {
      walletTransactions.push(
        await this.grantWallet({
          playerId,
          currency: reward.currency,
          amount: reward.amount,
          reason: 'DAILY_LOGIN_REWARD',
          sourceType: 'DAILY_LOGIN',
          sourceId: periodKey,
          idempotencyKey: `${input.idempotencyKey}:${reward.currency.toLowerCase()}`,
        }),
      );
    }

    const claim: InternalDailyLoginClaim = {
      claimId: randomUUID(),
      playerId,
      periodKey,
      weekKey,
      dayIndex,
      rewards,
      idempotencyKey: input.idempotencyKey,
      claimedAt: now.toISOString(),
    };
    this.dailyLoginClaims.push(claim);
    const result: ClaimDailyLoginResult = {
      periodKey,
      weekKey,
      dayIndex,
      alreadyClaimed: true,
      claimedAt: claim.claimedAt,
      rewards,
      walletBalances: await this.getWalletBalances(playerId),
      walletTransactions,
    };

    this.dailyLoginResultByPlayerAndIdempotencyKey.set(resultKey, this.cloneDailyLoginResult(result));
    this.touchPlayerLastSeen(playerId);
    return result;
  }

  async getDailyQuests(identity: AuthIdentity): Promise<DailyQuestListResult> {
    const profile = await this.getOrCreatePlayerProfile(identity);
    this.ensurePlayerDefaults(profile.playerId);
    const periodKey = this.periodKeyFor(new Date());
    return {
      periodKey,
      quests: this.buildDailyQuests(profile.playerId, periodKey),
    };
  }

  async claimDailyQuest(identity: AuthIdentity, input: ClaimDailyQuestInput): Promise<ClaimDailyQuestResult> {
    const profile = await this.getOrCreatePlayerProfile(identity);
    this.ensurePlayerDefaults(profile.playerId);
    const playerId = profile.playerId;
    const resultKey = `${playerId}:${input.idempotencyKey}`;
    const existingForKey = this.questClaimResultByPlayerAndIdempotencyKey.get(resultKey);
    if (existingForKey) {
      return this.cloneDailyQuestClaimResult(existingForKey);
    }

    const definition = DAILY_QUEST_DEFINITIONS.find((quest) => quest.questKey === input.questKey);
    if (!definition) {
      throw new Error('QUEST_NOT_FOUND');
    }

    const periodKey = this.periodKeyFor(new Date());
    const quest = this.buildDailyQuest(playerId, periodKey, definition);
    if (!quest.completed) {
      throw new Error('QUEST_INCOMPLETE');
    }

    const existingClaim = this.questClaims.find(
      (claim) => claim.playerId === playerId && claim.questId === definition.questId && claim.periodKey === periodKey,
    );
    if (existingClaim) {
      throw new Error('QUEST_ALREADY_CLAIMED');
    }

    const rewardTx = await this.grantWallet({
      playerId,
      currency: definition.reward.currency,
      amount: definition.reward.amount,
      reason: 'QUEST_REWARD',
      sourceType: 'DAILY_QUEST',
      sourceId: definition.questKey,
      idempotencyKey: `${input.idempotencyKey}:reward`,
    });
    this.questClaims.push({
      claimId: randomUUID(),
      playerId,
      questId: definition.questId,
      periodKey,
      idempotencyKey: input.idempotencyKey,
      rewardTxId: rewardTx.transactionId,
      claimedAt: new Date().toISOString(),
    });

    const result: ClaimDailyQuestResult = {
      quest: {
        ...quest,
        claimed: true,
      },
      walletBalances: await this.getWalletBalances(playerId),
      walletTransactions: [rewardTx],
    };

    this.questClaimResultByPlayerAndIdempotencyKey.set(resultKey, this.cloneDailyQuestClaimResult(result));
    this.touchPlayerLastSeen(playerId);
    return result;
  }

  async getAnalyticsEvents(identity: AuthIdentity, limit = 100): Promise<AnalyticsEvent[]> {
    const profile = await this.getOrCreatePlayerProfile(identity);
    return this.analyticsEvents
      .filter((event) => event.playerId === profile.playerId)
      .slice(-limit)
      .map((event, index) => ({
        eventId: `memory-analytics-${index}`,
        playerId: event.playerId,
        eventName: event.eventName,
        sourceType: event.sourceType,
        sourceId: event.sourceId,
        eventPayload: { ...event.eventPayload },
        occurredAt: event.occurredAt,
      }));
  }

  async getSuspiciousEvents(identity: AuthIdentity, limit = 100): Promise<SuspiciousEvent[]> {
    const profile = await this.getOrCreatePlayerProfile(identity);
    return this.suspiciousEvents
      .filter((event) => event.playerId === profile.playerId)
      .slice(-limit)
      .map((event) => ({
        ...event,
        requestPayload: { ...event.requestPayload },
        serverSnapshot: { ...event.serverSnapshot },
      }));
  }

  async recordSuspiciousEvent(identity: AuthIdentity, input: RecordSuspiciousEventInput): Promise<SuspiciousEvent> {
    const profile = await this.getOrCreatePlayerProfile(identity);
    this.ensurePlayerDefaults(profile.playerId);
    const event: SuspiciousEvent = {
      suspiciousEventId: randomUUID(),
      playerId: profile.playerId,
      riskType: input.riskType,
      severity: input.severity,
      sourceEndpoint: input.sourceEndpoint,
      tripId: input.tripId ?? null,
      requestPayload: input.requestPayload ?? {},
      serverSnapshot: input.serverSnapshot ?? {},
      actionTaken: input.actionTaken,
      createdAt: new Date().toISOString(),
    };
    this.suspiciousEvents.push(event);
    return { ...event };
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

  async unlockRoute(identity: AuthIdentity, input: UnlockRouteInput): Promise<RouteUnlockResult> {
    const state = await this.getOrCreatePlayerState(identity);
    const playerId = state.profile.playerId;
    const resultKey = `${playerId}:${input.idempotencyKey}`;
    const existingForKey = this.routeUnlockResultByPlayerAndIdempotencyKey.get(resultKey);
    if (existingForKey) {
      return this.cloneRouteUnlockResult(existingForKey);
    }

    const route = ROUTES.find((candidate) => candidate.routeId === input.routeId || candidate.routeKey === input.routeId);
    if (!route) {
      throw new Error('ROUTE_NOT_FOUND');
    }

    if (route.routeType !== 'Tutorial' && !this.hasFullRouteAccess(state.profile)) {
      throw new Error('ROUTE_LOCKED');
    }

    if (route.routeType === 'Tutorial' || this.isRouteUnlocked(playerId, route.routeId)) {
      return {
        route: this.routeWithDetails(this.routeWithPlayerUnlock(route, playerId)),
        costStamps: 0,
        walletBalances: await this.getWalletBalances(playerId),
        walletTransactions: [],
      };
    }

    const walletTransactions: WalletTransaction[] = [];
    if (route.unlockCostStamps > 0) {
      walletTransactions.push(
        await this.spendWallet({
          playerId,
          currency: 'SOUVENIR_STAMPS',
          amount: route.unlockCostStamps,
          reason: 'ROUTE_UNLOCK',
          sourceType: 'ROUTE_UNLOCK',
          sourceId: route.routeId,
          idempotencyKey: `${input.idempotencyKey}:souvenir_stamps`,
        }),
      );
    }

    const unlockedRoutes = this.unlockedRoutesByPlayer.get(playerId) ?? new Set<string>();
    unlockedRoutes.add(route.routeId);
    this.unlockedRoutesByPlayer.set(playerId, unlockedRoutes);
    const result: RouteUnlockResult = {
      route: this.routeWithDetails(this.routeWithPlayerUnlock(route, playerId)),
      costStamps: route.unlockCostStamps,
      walletBalances: await this.getWalletBalances(playerId),
      walletTransactions,
    };

    this.routeUnlockResultByPlayerAndIdempotencyKey.set(resultKey, this.cloneRouteUnlockResult(result));
    return result;
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

    if (route.tripPrepFeeCoins > 0) {
      await this.spendWallet({
        playerId,
        currency: 'ROAD_COINS',
        amount: route.tripPrepFeeCoins,
        reason: 'TRIP_PREP_FEE',
        sourceType: 'ROUTE_START',
        sourceId: route.routeId,
        idempotencyKey: `${input.idempotencyKey}:trip_prep_fee`,
      });
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
      this.analyticsEvents.push({
        playerId,
        eventName: 'tutorial_start',
        sourceType: 'TRIP',
        sourceId: trip.tripId,
        eventPayload: {
          route_id: route.routeId,
          route_key: route.routeKey,
        },
        occurredAt: now,
      });
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
    const rawDurationSeconds = Math.floor((now.getTime() - new Date(trip.lastSimulatedAt).getTime()) / 1000);
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
    const previousTutorialState = profile.tutorialState;
    const nextTutorialState = nextTutorialStateAfterDriveTick({
      currentState: previousTutorialState,
      mode: input.mode,
      distanceGainKm: simulation.distanceGainKm,
      finalDistanceKm: simulation.finalDistanceKm,
      forcedStopReason: simulation.forcedStopReason,
    });
    this.transitionTutorialState(playerId, nextTutorialState);

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
    if (simulation.forcedStopReason === 'LOW_FUEL') {
      this.analyticsEvents.push({
        playerId,
        eventName: 'stopped_low_fuel',
        sourceType: 'TRIP',
        sourceId: trip.tripId,
        eventPayload: {
          distance_km: simulation.finalDistanceKm,
          fuel_used: simulation.fuelUsed,
        },
        occurredAt: now.toISOString(),
      });
    }
    if (previousTutorialState !== nextTutorialState && nextTutorialState === 'AUTO_DRIVING_UNLOCKED') {
      this.analyticsEvents.push({
        playerId,
        eventName: 'auto_driving_unlocked',
        sourceType: 'TRIP',
        sourceId: trip.tripId,
        eventPayload: {
          distance_km: simulation.finalDistanceKm,
        },
        occurredAt: now.toISOString(),
      });
    }
    if (rawDurationSeconds > DEFAULT_SIMULATION_CONFIG.online.maxOnlineTickSeconds) {
      await this.recordSuspiciousEvent(identity, {
        riskType: 'TICK_RATE_LIMITED',
        severity: 1,
        sourceEndpoint: 'POST /trip/drive-tick',
        tripId: trip.tripId,
        requestPayload: {
          mode: input.mode,
          client_tick_seq: input.clientTickSeq,
          idempotency_key: input.idempotencyKey,
        },
        serverSnapshot: {
          raw_duration_seconds: rawDurationSeconds,
          effective_duration_seconds: simulation.durationSeconds,
          max_online_tick_seconds: DEFAULT_SIMULATION_CONFIG.online.maxOnlineTickSeconds,
        },
        actionTaken: 'CLAMP_AND_LOG',
      });
    }
    const effectiveSpeedKmph = simulation.durationSeconds > 0
      ? (simulation.rawDistanceGainKm / simulation.durationSeconds) * 3600
      : 0;
    const hardSpeedCapKmph = vehicle.baseSpeedKmph * 1.5;
    if (effectiveSpeedKmph > hardSpeedCapKmph) {
      await this.recordSuspiciousEvent(identity, {
        riskType: 'SPEED_LIMIT_EXCEEDED',
        severity: 2,
        sourceEndpoint: 'POST /trip/drive-tick',
        tripId: trip.tripId,
        requestPayload: {
          mode: input.mode,
          client_tick_seq: input.clientTickSeq,
          idempotency_key: input.idempotencyKey,
        },
        serverSnapshot: {
          effective_speed_kmph: Number(effectiveSpeedKmph.toFixed(6)),
          hard_speed_cap_kmph: Number(hardSpeedCapKmph.toFixed(6)),
          raw_distance_gain_km: simulation.rawDistanceGainKm,
          duration_seconds: simulation.durationSeconds,
        },
        actionTaken: 'CLAMP_AND_LOG',
      });
    }
    if (simulation.distanceGainKm > 0) {
      this.recordQuestEvent(playerId, 'DRIVE_DISTANCE_ONLINE', simulation.distanceGainKm);
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
    this.recordQuestEvent(playerId, 'PHOTO_TAKEN', 1);

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
    this.recordQuestEvent(playerId, 'OFFLINE_REPORT_CLAIMED', 1);

    return {
      report: { ...report },
      walletBalances: await this.getWalletBalances(playerId),
      walletTransactions,
    };
  }

  async completeRoute(identity: AuthIdentity, input: CompleteRouteInput): Promise<CompleteRouteResult> {
    const state = await this.getOrCreatePlayerState(identity);
    const playerId = state.profile.playerId;
    const resultKey = `${playerId}:${input.idempotencyKey}`;
    const existingForKey = this.completeRouteResultByPlayerAndIdempotencyKey.get(resultKey);
    if (existingForKey) {
      return this.cloneCompleteRouteResult(existingForKey);
    }

    const trip = this.tripsByPlayer
      .get(playerId)
      ?.find((candidate) => candidate.tripId === input.tripId);
    if (!trip) {
      throw new Error('TRIP_NOT_FOUND');
    }
    if (trip.status === 'COMPLETED') {
      throw new Error('ROUTE_ALREADY_COMPLETED');
    }
    if (trip.status === 'ABANDONED') {
      throw new Error('TRIP_NOT_ACTIVE');
    }

    const baseRoute = ROUTES.find((candidate) => candidate.routeId === trip.routeId);
    if (!baseRoute) {
      throw new Error('ROUTE_NOT_FOUND');
    }
    const route = this.routeWithDetails(baseRoute);
    if (trip.currentDistanceKm < route.totalDistanceKm) {
      throw new Error('ROUTE_NOT_COMPLETE');
    }
    if (trip.forcedStopReason && trip.forcedStopReason !== 'ROUTE_END') {
      throw new Error('ROUTE_NOT_COMPLETE');
    }

    const incompleteRequiredLandmark = (route.landmarks ?? []).find(
      (landmark) => landmark.requiredStop && !this.hasFirstPhoto(playerId, landmark.landmarkId),
    );
    if (incompleteRequiredLandmark) {
      throw new Error('REQUIRED_LANDMARKS_INCOMPLETE');
    }

    const rewards = route.routeType === 'Tutorial'
      ? TUTORIAL_COMPLETION_REWARDS
      : { roadCoins: 0, travelTokens: 0, souvenirStamps: 0 };
    const walletTransactions: WalletTransaction[] = [];
    if (rewards.roadCoins > 0) {
      walletTransactions.push(
        await this.grantWallet({
          playerId,
          currency: 'ROAD_COINS',
          amount: rewards.roadCoins,
          reason: 'ROUTE_COMPLETE_REWARD',
          sourceType: 'ROUTE_COMPLETION',
          sourceId: trip.tripId,
          idempotencyKey: `${input.idempotencyKey}:road_coins`,
        }),
      );
    }
    if (rewards.travelTokens > 0) {
      walletTransactions.push(
        await this.grantWallet({
          playerId,
          currency: 'TRAVEL_TOKENS',
          amount: rewards.travelTokens,
          reason: 'ROUTE_COMPLETE_REWARD',
          sourceType: 'ROUTE_COMPLETION',
          sourceId: trip.tripId,
          idempotencyKey: `${input.idempotencyKey}:travel_tokens`,
        }),
      );
    }
    if (rewards.souvenirStamps > 0) {
      walletTransactions.push(
        await this.grantWallet({
          playerId,
          currency: 'SOUVENIR_STAMPS',
          amount: rewards.souvenirStamps,
          reason: 'ROUTE_COMPLETE_REWARD',
          sourceType: 'ROUTE_COMPLETION',
          sourceId: trip.tripId,
          idempotencyKey: `${input.idempotencyKey}:souvenir_stamps`,
        }),
      );
    }

    const now = new Date().toISOString();
    trip.status = 'COMPLETED';
    trip.currentDistanceKm = route.totalDistanceKm;
    trip.completedAt = now;
    trip.forcedStopReason = null;
    trip.lastSimulatedAt = now;
    this.unlockVehicle(playerId, trip.playerVehicleId, trip.tripId);
    if (route.routeType === 'Tutorial') {
      this.transitionTutorialState(playerId, 'FULL_SYSTEM_UNLOCKED');
    }

    this.analyticsEvents.push({
      playerId,
      eventName: 'route_completed',
      sourceType: 'TRIP',
      sourceId: trip.tripId,
      eventPayload: {
        route_id: route.routeId,
        route_key: route.routeKey,
        total_distance_km: route.totalDistanceKm,
        road_coins: rewards.roadCoins,
        travel_tokens: rewards.travelTokens,
        souvenir_stamps: rewards.souvenirStamps,
      },
      occurredAt: now,
    });
    this.recordQuestEvent(playerId, 'ROUTE_COMPLETED', 1);

    const profile = this.findPlayerById(playerId) ?? state.profile;
    const result: CompleteRouteResult = {
      trip: this.tripWithRoute(trip),
      profile: { ...profile },
      completionRewards: rewards,
      walletBalances: await this.getWalletBalances(playerId),
      walletTransactions,
    };

    this.completeRouteResultByPlayerAndIdempotencyKey.set(resultKey, this.cloneCompleteRouteResult(result));
    this.touchPlayerLastSeen(playerId);
    return result;
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
    if (input.action === 'REFUEL') {
      this.recordQuestEvent(playerId, 'VEHICLE_REFUELED', 1);
    }

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
    this.analyticsEvents.push({
      playerId: input.playerId,
      eventName: 'wallet_currency_changed',
      sourceType: input.sourceType,
      sourceId: input.sourceId ?? input.idempotencyKey,
      eventPayload: {
        currency: input.currency,
        amount: signedAmount,
        balance_before: balanceBefore,
        balance_after: balanceAfter,
        reason: input.reason,
        source_type: input.sourceType,
        source_id: input.sourceId ?? null,
        idempotency_key: input.idempotencyKey,
      },
      occurredAt: transaction.createdAt,
    });
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
    if (simulation.forcedStopReason === 'LANDMARK_REQUIRED') {
      this.analyticsEvents.push({
        playerId: profile.playerId,
        eventName: 'stopped_at_landmark',
        sourceType: 'TRIP',
        sourceId: trip.tripId,
        eventPayload: {
          landmark_id: simulation.landmarkId,
          distance_km: simulation.finalDistanceKm,
        },
        occurredAt: report.generatedAt,
      });
    }
    if (simulation.forcedStopReason === 'LOW_FUEL') {
      this.analyticsEvents.push({
        playerId: profile.playerId,
        eventName: 'stopped_low_fuel',
        sourceType: 'TRIP',
        sourceId: trip.tripId,
        eventPayload: {
          distance_km: simulation.finalDistanceKm,
          fuel_used: simulation.fuelUsed,
        },
        occurredAt: report.generatedAt,
      });
    }
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
      route: route ? this.routeWithDetails(this.routeWithPlayerUnlock(route, trip.playerId)) : undefined,
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

  private buildDailyLoginStatus(playerId: string): DailyLoginStatus {
    const now = new Date();
    const periodKey = this.periodKeyFor(now);
    const weekKey = this.weekKeyFor(now);
    const existingClaim = this.dailyLoginClaims.find(
      (claim) => claim.playerId === playerId && claim.periodKey === periodKey,
    );
    const dayIndex = existingClaim?.dayIndex ?? this.dailyLoginDayIndex(playerId, weekKey);
    return {
      periodKey,
      weekKey,
      dayIndex,
      alreadyClaimed: Boolean(existingClaim),
      claimedAt: existingClaim?.claimedAt ?? null,
      rewards: existingClaim?.rewards ?? this.dailyLoginRewardsFor(playerId, weekKey, dayIndex),
    };
  }

  private dailyLoginDayIndex(playerId: string, weekKey: string): number {
    const claimsThisWeek = this.dailyLoginClaims.filter(
      (claim) => claim.playerId === playerId && claim.weekKey === weekKey,
    );
    return Math.min(7, claimsThisWeek.length + 1);
  }

  private dailyLoginRewardsFor(playerId: string, weekKey: string, dayIndex: number): CurrencyReward[] {
    const rewardTable: Record<number, CurrencyReward[]> = {
      1: [
        { currency: 'STAMP_FRAGMENTS', amount: 2 },
        { currency: 'ROAD_COINS', amount: 50 },
      ],
      2: [
        { currency: 'STAMP_FRAGMENTS', amount: 2 },
        { currency: 'TRAVEL_TOKENS', amount: 1 },
      ],
      3: [
        { currency: 'STAMP_FRAGMENTS', amount: 3 },
        { currency: 'ROAD_COINS', amount: 75 },
      ],
      4: [
        { currency: 'STAMP_FRAGMENTS', amount: 3 },
        { currency: 'TRAVEL_TOKENS', amount: 1 },
      ],
      5: [
        { currency: 'STAMP_FRAGMENTS', amount: 4 },
        { currency: 'ROAD_COINS', amount: 100 },
      ],
      6: [
        { currency: 'STAMP_FRAGMENTS', amount: 4 },
        { currency: 'TRAVEL_TOKENS', amount: 1 },
      ],
      7: [
        { currency: 'SOUVENIR_STAMPS', amount: 1 },
        { currency: 'ROAD_COINS', amount: 150 },
      ],
    };
    const rewards = [...(rewardTable[dayIndex] ?? rewardTable[7])];
    const hasWeeklyStamp = this.dailyLoginClaims.some(
      (claim) =>
        claim.playerId === playerId &&
        claim.weekKey === weekKey &&
        claim.rewards.some((reward) => reward.currency === 'SOUVENIR_STAMPS'),
    );
    return hasWeeklyStamp
      ? rewards.filter((reward) => reward.currency !== 'SOUVENIR_STAMPS')
      : rewards;
  }

  private buildDailyQuests(playerId: string, periodKey: string): DailyQuest[] {
    return DAILY_QUEST_DEFINITIONS
      .slice()
      .sort((left, right) => left.sortOrder - right.sortOrder)
      .map((definition) => this.buildDailyQuest(playerId, periodKey, definition));
  }

  private buildDailyQuest(playerId: string, periodKey: string, definition: DailyQuestDefinition): DailyQuest {
    const progress = this.questProgressByPlayerQuestPeriod.get(this.questProgressKey(playerId, definition.questId, periodKey));
    const claimed = this.questClaims.some(
      (claim) => claim.playerId === playerId && claim.questId === definition.questId && claim.periodKey === periodKey,
    );
    const progressValue = progress?.progressValue ?? 0;
    return {
      questId: definition.questId,
      questKey: definition.questKey,
      title: definition.title,
      eventName: definition.eventName,
      periodKey,
      targetValue: definition.targetValue,
      progressValue,
      completed: progressValue >= definition.targetValue,
      claimed,
      reward: definition.reward,
    };
  }

  private recordQuestEvent(playerId: string, eventName: QuestEventName, amount: number): void {
    const periodKey = this.periodKeyFor(new Date());
    const definitions = DAILY_QUEST_DEFINITIONS.filter((definition) => definition.eventName === eventName);
    for (const definition of definitions) {
      const key = this.questProgressKey(playerId, definition.questId, periodKey);
      const existing = this.questProgressByPlayerQuestPeriod.get(key);
      const progressValue = (existing?.progressValue ?? 0) + amount;
      const completedAt = existing?.completedAt ?? (progressValue >= definition.targetValue ? new Date().toISOString() : null);
      this.questProgressByPlayerQuestPeriod.set(key, {
        playerId,
        questId: definition.questId,
        periodKey,
        progressValue,
        completedAt,
        updatedAt: new Date().toISOString(),
      });
    }
  }

  private questProgressKey(playerId: string, questId: string, periodKey: string): string {
    return `${playerId}:${questId}:${periodKey}`;
  }

  private periodKeyFor(date: Date): string {
    return date.toISOString().slice(0, 10);
  }

  private weekKeyFor(date: Date): string {
    const utcDate = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    const dayNumber = utcDate.getUTCDay() || 7;
    utcDate.setUTCDate(utcDate.getUTCDate() + 4 - dayNumber);
    const yearStart = new Date(Date.UTC(utcDate.getUTCFullYear(), 0, 1));
    const weekNumber = Math.ceil(((utcDate.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
    return `${utcDate.getUTCFullYear()}-W${String(weekNumber).padStart(2, '0')}`;
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

  private cloneCompleteRouteResult(result: CompleteRouteResult): CompleteRouteResult {
    return JSON.parse(JSON.stringify(result)) as CompleteRouteResult;
  }

  private cloneRouteUnlockResult(result: RouteUnlockResult): RouteUnlockResult {
    return JSON.parse(JSON.stringify(result)) as RouteUnlockResult;
  }

  private cloneDailyLoginResult(result: ClaimDailyLoginResult): ClaimDailyLoginResult {
    return JSON.parse(JSON.stringify(result)) as ClaimDailyLoginResult;
  }

  private cloneDailyQuestClaimResult(result: ClaimDailyQuestResult): ClaimDailyQuestResult {
    return JSON.parse(JSON.stringify(result)) as ClaimDailyQuestResult;
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
