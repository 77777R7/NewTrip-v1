export const GAME_DATA_STORE = Symbol('GAME_DATA_STORE');

export const CURRENCIES = [
  'ROAD_COINS',
  'TRAVEL_TOKENS',
  'SOUVENIR_STAMPS',
  'STAMP_FRAGMENTS',
  'BLUEPRINTS',
] as const;

export type Currency = (typeof CURRENCIES)[number];

export type AuthIdentity = {
  authProvider: string;
  externalId: string;
  displayName?: string;
  timezone?: string;
};

export type PlayerProfile = {
  playerId: string;
  authProvider: string;
  externalId: string;
  displayName: string | null;
  timezone: string;
  tutorialState: string;
  currentVehicleId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type WalletBalance = {
  currency: Currency;
  balance: number;
};

export type PlayerVehicle = {
  playerVehicleId: string;
  vehicleDefId: string;
  vehicleKey: string;
  displayName: string;
  currentFuel: number;
  currentDurability: number;
  currentCleanliness: number;
  selectedSkinId: string | null;
  upgradeLevel: number;
  isSelected: boolean;
};

export type PlayerState = {
  profile: PlayerProfile;
  walletBalances: WalletBalance[];
  vehicles: PlayerVehicle[];
};

export type WalletTransaction = {
  transactionId: string;
  playerId: string;
  currency: Currency;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  reason: string;
  sourceType: string;
  sourceId: string | null;
  idempotencyKey: string;
  createdAt: string;
};

export type WalletMutationInput = {
  playerId: string;
  currency: Currency;
  amount: number;
  reason: string;
  sourceType: string;
  sourceId?: string;
  idempotencyKey: string;
};

export type RouteSegment = {
  segmentId: string;
  segmentIndex: number;
  startKm: number;
  endKm: number;
  terrainType: string;
  speedMultiplier: number;
  fuelMultiplier: number;
  cleanlinessMultiplier: number;
  durabilityMultiplier: number;
};

export type Landmark = {
  landmarkId: string;
  landmarkKey: string;
  name: string;
  distanceKm: number;
  requiredStop: boolean;
  rarity: string;
  basePhotoCoins: number;
  photoCardKey: string;
};

export type RouteDefinition = {
  routeId: string;
  configVersionId: string;
  routeKey: string;
  name: string;
  region: string;
  startNode: string;
  destinationNode: string;
  routeType: 'Tutorial' | 'Short' | 'Medium' | 'Long' | 'Epic';
  totalDistanceKm: number;
  difficulty: number;
  unlockCostStamps: number;
  tripPrepFeeCoins: number;
  rewardMultiplier: number;
  backgroundPackId: string;
  isUnlocked: boolean;
  segments?: RouteSegment[];
  landmarks?: Landmark[];
};

export type Trip = {
  tripId: string;
  playerId: string;
  routeId: string;
  routeConfigVersion: string;
  playerVehicleId: string;
  status: 'ACTIVE' | 'PAUSED' | 'FORCED_STOP' | 'COMPLETED' | 'ABANDONED';
  currentDistanceKm: number;
  elapsedRealSeconds: number;
  onlineTokenMeterKm: number;
  offlineTokenMeterKm: number;
  lastSimulatedAt: string;
  startedAt: string;
  completedAt: string | null;
  forcedStopReason: string | null;
  route?: RouteDefinition;
};

export type StartTripInput = {
  routeId: string;
  playerVehicleId?: string;
  idempotencyKey: string;
};

export type AbandonTripInput = {
  tripId?: string;
  idempotencyKey: string;
};

export interface GameDataStore {
  getOrCreatePlayerState(identity: AuthIdentity): Promise<PlayerState>;
  getOrCreatePlayerProfile(identity: AuthIdentity): Promise<PlayerProfile>;
  getWalletBalances(playerId: string): Promise<WalletBalance[]>;
  grantWallet(input: WalletMutationInput): Promise<WalletTransaction>;
  spendWallet(input: WalletMutationInput): Promise<WalletTransaction>;
  getAvailableRoutes(identity: AuthIdentity): Promise<RouteDefinition[]>;
  getRoute(identity: AuthIdentity, routeId: string): Promise<RouteDefinition | null>;
  getCurrentTrip(identity: AuthIdentity): Promise<Trip | null>;
  startTrip(identity: AuthIdentity, input: StartTripInput): Promise<Trip>;
  abandonTrip(identity: AuthIdentity, input: AbandonTripInput): Promise<Trip>;
}
