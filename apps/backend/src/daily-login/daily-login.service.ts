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
        await this.recordSuspiciousBestEffort(identity, {
          riskType: 'REWARD_DUPLICATE_ATTEMPT',
          severity: 3,
          sourceEndpoint: 'POST /daily-login/claim',
          requestPayload: {
            idempotency_key: input.idempotencyKey,
          },
          serverSnapshot: {
            reason: 'DAILY_LOGIN_ALREADY_CLAIMED',
          },
          actionTaken: 'REJECT',
        });
        throw new ConflictException(error.message);
      }
      throw error;
    }
  }

  private async recordSuspiciousBestEffort(
    identity: AuthIdentity,
    input: Parameters<GameDataStore['recordSuspiciousEvent']>[1],
  ): Promise<void> {
    try {
      await this.gameDataStore.recordSuspiciousEvent(identity, input);
    } catch {
      // Risk logging should not mask the original duplicate-claim response.
    }
  }
}
