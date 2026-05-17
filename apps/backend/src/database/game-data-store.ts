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
  lastSeenAt: string;
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
  baseSpeedKmph: number;
  fuelCapacity: number;
  fuelConsumptionPerKm: number;
  durabilityLossPerKm: number;
  cleanlinessLossPerKm: number;
  offlineEfficiency: number;
  weatherResistance: number;
  currentFuel: number;
  currentDurability: number;
  currentCleanliness: number;
  selectedSkinId: string | null;
  upgradeLevel: number;
  isSelected: boolean;
};

export type VehicleMaintenanceAction = 'REFUEL' | 'CLEAN' | 'REPAIR';

export type PlayerState = {
  profile: PlayerProfile;
  walletBalances: WalletBalance[];
  vehicles: PlayerVehicle[];
  pendingOfflineReport: OfflineReport | null;
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

export type CurrencyReward = {
  currency: Currency;
  amount: number;
};

export type DailyLoginStatus = {
  periodKey: string;
  weekKey: string;
  dayIndex: number;
  alreadyClaimed: boolean;
  claimedAt: string | null;
  rewards: CurrencyReward[];
};

export type ClaimDailyLoginInput = {
  idempotencyKey: string;
};

export type ClaimDailyLoginResult = DailyLoginStatus & {
  walletBalances: WalletBalance[];
  walletTransactions: WalletTransaction[];
};

export type QuestEventName =
  | 'DRIVE_DISTANCE_ONLINE'
  | 'OFFLINE_REPORT_CLAIMED'
  | 'VEHICLE_REFUELED'
  | 'PHOTO_TAKEN'
  | 'ROUTE_COMPLETED';

export type DailyQuest = {
  questId: string;
  questKey: string;
  title: string;
  eventName: QuestEventName;
  periodKey: string;
  targetValue: number;
  progressValue: number;
  completed: boolean;
  claimed: boolean;
  reward: CurrencyReward;
};

export type DailyQuestListResult = {
  periodKey: string;
  quests: DailyQuest[];
};

export type ClaimDailyQuestInput = {
  questKey: string;
  idempotencyKey: string;
};

export type ClaimDailyQuestResult = {
  quest: DailyQuest;
  walletBalances: WalletBalance[];
  walletTransactions: WalletTransaction[];
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

export type UnlockRouteInput = {
  routeId: string;
  idempotencyKey: string;
};

export type RouteUnlockResult = {
  route: RouteDefinition;
  costStamps: number;
  walletBalances: WalletBalance[];
  walletTransactions: WalletTransaction[];
};

export type DriveTickInput = {
  tripId: string;
  mode: 'HOLD_TO_DRIVE' | 'AUTO_DRIVING' | 'HOLD_TO_BOOST';
  clientTickSeq: number;
  idempotencyKey: string;
};

export type DriveTickResult = {
  trip: Trip;
  vehicle: PlayerVehicle;
  durationSeconds: number;
  rawDistanceGainKm: number;
  distanceGainKm: number;
  finalDistanceKm: number;
  forcedStopReason: string | null;
  landmarkId?: string;
  fuelUsed: number;
  cleanlinessLoss: number;
  durabilityLoss: number;
  rewards: {
    roadCoins: number;
    travelTokens: number;
    tokenMeterKm: number;
  };
  walletBalances: WalletBalance[];
  walletTransactions: WalletTransaction[];
};

export type PlayerPhoto = {
  photoId: string;
  playerId: string;
  tripId: string;
  landmarkId: string;
  photoCardKey: string;
  qualityScore: number;
  weather: string;
  dayPhase: string;
  cleanlinessAtShot: number;
  isFirstPhoto: boolean;
  rewardTxId: string | null;
  takenAt: string;
};

export type CompleteLandmarkInput = {
  tripId: string;
  landmarkId: string;
  action: 'TAKE_PHOTO';
  idempotencyKey: string;
};

export type CompleteLandmarkResult = {
  trip: Trip;
  profile: PlayerProfile;
  photo: PlayerPhoto;
  walletBalances: WalletBalance[];
  walletTransactions: WalletTransaction[];
};

export type OfflineReport = {
  reportId: string;
  playerId: string;
  tripId: string;
  generatedAt: string;
  offlineSeconds: number;
  distanceTravelledKm: number;
  roadCoinsPending: number;
  travelTokensPending: number;
  fuelUsed: number;
  cleanlinessLoss: number;
  durabilityLoss: number;
  weatherSummary: Record<string, unknown>;
  landmarkReached: Record<string, unknown> | null;
  forcedStopReason: string | null;
  claimed: boolean;
  claimedAt: string | null;
  claimIdempotencyKey: string | null;
};

export type ClaimOfflineReportInput = {
  reportId: string;
  idempotencyKey: string;
};

export type ClaimOfflineReportResult = {
  report: OfflineReport;
  walletBalances: WalletBalance[];
  walletTransactions: WalletTransaction[];
};

export type CompleteRouteInput = {
  tripId: string;
  idempotencyKey: string;
};

export type CompleteRouteResult = {
  trip: Trip;
  profile: PlayerProfile;
  completionRewards: {
    roadCoins: number;
    travelTokens: number;
    souvenirStamps: number;
  };
  walletBalances: WalletBalance[];
  walletTransactions: WalletTransaction[];
};

export type VehicleMaintenanceInput = {
  action: VehicleMaintenanceAction;
  playerVehicleId?: string;
  idempotencyKey: string;
};

export type VehicleMaintenanceResult = {
  action: VehicleMaintenanceAction;
  vehicle: PlayerVehicle;
  costRoadCoins: number;
  restoredAmount: number;
  walletBalances: WalletBalance[];
  walletTransactions: WalletTransaction[];
};

export interface GameDataStore {
  getOrCreatePlayerState(identity: AuthIdentity): Promise<PlayerState>;
  getOrCreatePlayerProfile(identity: AuthIdentity): Promise<PlayerProfile>;
  getWalletBalances(playerId: string): Promise<WalletBalance[]>;
  grantWallet(input: WalletMutationInput): Promise<WalletTransaction>;
  spendWallet(input: WalletMutationInput): Promise<WalletTransaction>;
  getDailyLogin(identity: AuthIdentity): Promise<DailyLoginStatus>;
  claimDailyLogin(identity: AuthIdentity, input: ClaimDailyLoginInput): Promise<ClaimDailyLoginResult>;
  getDailyQuests(identity: AuthIdentity): Promise<DailyQuestListResult>;
  claimDailyQuest(identity: AuthIdentity, input: ClaimDailyQuestInput): Promise<ClaimDailyQuestResult>;
  getAvailableRoutes(identity: AuthIdentity): Promise<RouteDefinition[]>;
  getRoute(identity: AuthIdentity, routeId: string): Promise<RouteDefinition | null>;
  unlockRoute(identity: AuthIdentity, input: UnlockRouteInput): Promise<RouteUnlockResult>;
  getCurrentTrip(identity: AuthIdentity): Promise<Trip | null>;
  startTrip(identity: AuthIdentity, input: StartTripInput): Promise<Trip>;
  abandonTrip(identity: AuthIdentity, input: AbandonTripInput): Promise<Trip>;
  driveTick(identity: AuthIdentity, input: DriveTickInput): Promise<DriveTickResult>;
  completeLandmark(identity: AuthIdentity, input: CompleteLandmarkInput): Promise<CompleteLandmarkResult>;
  claimOfflineReport(identity: AuthIdentity, input: ClaimOfflineReportInput): Promise<ClaimOfflineReportResult>;
  completeRoute(identity: AuthIdentity, input: CompleteRouteInput): Promise<CompleteRouteResult>;
  maintainVehicle(identity: AuthIdentity, input: VehicleMaintenanceInput): Promise<VehicleMaintenanceResult>;
}
