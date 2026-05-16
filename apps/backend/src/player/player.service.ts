import { Inject, Injectable } from '@nestjs/common';
import { AuthIdentity, GAME_DATA_STORE, GameDataStore, PlayerProfile, PlayerState } from '../database/game-data-store';

@Injectable()
export class PlayerService {
  constructor(@Inject(GAME_DATA_STORE) private readonly gameDataStore: GameDataStore) {}

  getProfile(identity: AuthIdentity): Promise<PlayerProfile> {
    return this.gameDataStore.getOrCreatePlayerProfile(identity);
  }

  getState(identity: AuthIdentity): Promise<PlayerState> {
    return this.gameDataStore.getOrCreatePlayerState(identity);
  }
}
