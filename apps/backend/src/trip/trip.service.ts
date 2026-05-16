import { Inject, Injectable } from '@nestjs/common';
import { AuthIdentity, GAME_DATA_STORE, GameDataStore, Trip } from '../database/game-data-store';

@Injectable()
export class TripService {
  constructor(@Inject(GAME_DATA_STORE) private readonly gameDataStore: GameDataStore) {}

  getCurrentTrip(identity: AuthIdentity): Promise<Trip | null> {
    return this.gameDataStore.getCurrentTrip(identity);
  }
}
