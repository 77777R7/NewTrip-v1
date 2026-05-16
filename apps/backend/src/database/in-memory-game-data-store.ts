import { randomUUID } from 'node:crypto';
import {
  AuthIdentity,
  CURRENCIES,
  Currency,
  GameDataStore,
  PlayerProfile,
  PlayerState,
  PlayerVehicle,
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

export class InMemoryGameDataStore implements GameDataStore {
  private readonly playersByIdentity = new Map<string, InternalPlayer>();
  private readonly balancesByPlayer = new Map<string, Map<Currency, number>>();
  private readonly vehiclesByPlayer = new Map<string, PlayerVehicle[]>();
  private readonly transactionsByPlayerAndKey = new Map<string, WalletTransaction>();

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
