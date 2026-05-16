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

export interface GameDataStore {
  getOrCreatePlayerState(identity: AuthIdentity): Promise<PlayerState>;
  getOrCreatePlayerProfile(identity: AuthIdentity): Promise<PlayerProfile>;
  getWalletBalances(playerId: string): Promise<WalletBalance[]>;
  grantWallet(input: WalletMutationInput): Promise<WalletTransaction>;
  spendWallet(input: WalletMutationInput): Promise<WalletTransaction>;
}
