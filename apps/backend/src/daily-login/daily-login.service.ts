import { BadRequestException, ConflictException, Inject, Injectable } from '@nestjs/common';
import {
  AuthIdentity,
  ClaimDailyLoginInput,
  ClaimDailyLoginResult,
  DailyLoginStatus,
  GAME_DATA_STORE,
  GameDataStore,
} from '../database/game-data-store';

@Injectable()
export class DailyLoginService {
  constructor(@Inject(GAME_DATA_STORE) private readonly gameDataStore: GameDataStore) {}

  getDailyLogin(identity: AuthIdentity): Promise<DailyLoginStatus> {
    return this.gameDataStore.getDailyLogin(identity);
  }

  async claimDailyLogin(identity: AuthIdentity, input: ClaimDailyLoginInput): Promise<ClaimDailyLoginResult> {
    if (!input.idempotencyKey) {
      throw new BadRequestException('IDEMPOTENCY_KEY_REQUIRED');
    }

    try {
      return await this.gameDataStore.claimDailyLogin(identity, input);
    } catch (error) {
      if (error instanceof Error && error.message === 'DAILY_LOGIN_ALREADY_CLAIMED') {
        throw new ConflictException(error.message);
      }
      throw error;
    }
  }
}
