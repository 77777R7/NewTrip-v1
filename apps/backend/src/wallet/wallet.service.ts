import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import {
  Currency,
  GAME_DATA_STORE,
  GameDataStore,
  WalletBalance,
  WalletMutationInput,
  WalletTransaction,
} from '../database/game-data-store';

@Injectable()
export class WalletService {
  constructor(@Inject(GAME_DATA_STORE) private readonly gameDataStore: GameDataStore) {}

  getBalances(playerId: string): Promise<WalletBalance[]> {
    return this.gameDataStore.getWalletBalances(playerId);
  }

  async grant(input: WalletMutationInput & { currency: Currency }): Promise<WalletTransaction> {
    try {
      return await this.gameDataStore.grantWallet(input);
    } catch (error) {
      throw this.toHttpError(error);
    }
  }

  async spend(input: WalletMutationInput & { currency: Currency }): Promise<WalletTransaction> {
    try {
      return await this.gameDataStore.spendWallet(input);
    } catch (error) {
      throw this.toHttpError(error);
    }
  }

  private toHttpError(error: unknown): Error {
    if (error instanceof Error && error.message === 'INSUFFICIENT_FUNDS') {
      return new BadRequestException('INSUFFICIENT_FUNDS');
    }
    return error instanceof Error ? error : new Error('Wallet operation failed');
  }
}
