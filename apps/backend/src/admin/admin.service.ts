import { Inject, Injectable } from '@nestjs/common';
import {
  AnalyticsEvent,
  AuthIdentity,
  GAME_DATA_STORE,
  GameDataStore,
  SuspiciousEvent,
} from '../database/game-data-store';

@Injectable()
export class AdminService {
  constructor(@Inject(GAME_DATA_STORE) private readonly gameDataStore: GameDataStore) {}

  getAnalyticsEvents(identity: AuthIdentity, limit?: number): Promise<AnalyticsEvent[]> {
    return this.gameDataStore.getAnalyticsEvents(identity, limit);
  }

  getSuspiciousEvents(identity: AuthIdentity, limit?: number): Promise<SuspiciousEvent[]> {
    return this.gameDataStore.getSuspiciousEvents(identity, limit);
  }
}
