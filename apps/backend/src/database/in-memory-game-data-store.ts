import { randomUUID } from 'node:crypto';
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

type InternalPlayer = PlayerProfile;

const DEFAULT_VEHICLE_DEF = {
  vehicleDefId: '00000000-0000-4000-8000-000000000101',
  vehicleKey: 'van_common_001',
  displayName: 'Blue Travel Van',
  fuelCapacity: 45,
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

  async getOrCreatePlayerState(identity: AuthIdentity): Promise<PlayerState> {
    const profile = await this.getOrCreatePlayerProfile(identity);
    this.ensurePlayerDefaults(profile.playerId);

    return {
      profile,
      walletBalances: await this.getWalletBalances(profile.playerId),
      vehicles: [...(this.vehiclesByPlayer.get(profile.playerId) ?? [])],
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
    this.transitionTutorialState(playerId, 'ROUTE_SELECTED');
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
      if (player.playerId === playerId && player.tutorialState === 'NOT_STARTED') {
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
}
