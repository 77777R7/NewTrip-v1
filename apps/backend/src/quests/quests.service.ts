import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  AuthIdentity,
  ClaimDailyQuestInput,
  ClaimDailyQuestResult,
  DailyQuestListResult,
  GAME_DATA_STORE,
  GameDataStore,
} from '../database/game-data-store';

@Injectable()
export class QuestsService {
  constructor(@Inject(GAME_DATA_STORE) private readonly gameDataStore: GameDataStore) {}

  getDailyQuests(identity: AuthIdentity): Promise<DailyQuestListResult> {
    return this.gameDataStore.getDailyQuests(identity);
  }

  async claimDailyQuest(identity: AuthIdentity, input: ClaimDailyQuestInput): Promise<ClaimDailyQuestResult> {
    if (!input.questKey) {
      throw new BadRequestException('QUEST_KEY_REQUIRED');
    }
    if (!input.idempotencyKey) {
      throw new BadRequestException('IDEMPOTENCY_KEY_REQUIRED');
    }

    try {
      return await this.gameDataStore.claimDailyQuest(identity, input);
    } catch (error) {
      if (!(error instanceof Error)) {
        throw error;
      }
      if (error.message === 'QUEST_NOT_FOUND') {
        throw new NotFoundException(error.message);
      }
      if (['QUEST_INCOMPLETE', 'QUEST_ALREADY_CLAIMED'].includes(error.message)) {
        throw new ConflictException(error.message);
      }
      throw error;
    }
  }
}
