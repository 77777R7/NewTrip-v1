import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable } from '@nestjs/common';
import {
  AuthIdentity,
  DebugPrimeDriveTickInput,
  DebugPrimeDriveTickResult,
  DebugSimulateOfflineInput,
  DebugSimulateOfflineResult,
  GAME_DATA_STORE,
  GameDataStore,
} from '../database/game-data-store';

@Injectable()
export class DebugService {
  constructor(@Inject(GAME_DATA_STORE) private readonly gameDataStore: GameDataStore) {}

  simulateOffline(
    identity: AuthIdentity,
    input: DebugSimulateOfflineInput,
  ): Promise<DebugSimulateOfflineResult> {
    if (process.env.NODE_ENV === 'production') {
      throw new ForbiddenException('DEBUG_ENDPOINT_DISABLED');
    }

    if (!Number.isFinite(input.hours) || input.hours <= 0 || input.hours > 24) {
      throw new BadRequestException('DEBUG_OFFLINE_HOURS_INVALID');
    }

    return this.gameDataStore.debugSimulateOffline(identity, input);
  }

  primeDriveTick(
    identity: AuthIdentity,
    input: DebugPrimeDriveTickInput,
  ): Promise<DebugPrimeDriveTickResult> {
    if (process.env.NODE_ENV === 'production') {
      throw new ForbiddenException('DEBUG_ENDPOINT_DISABLED');
    }

    if (!Number.isFinite(input.seconds) || input.seconds <= 0 || input.seconds > 60) {
      throw new BadRequestException('DEBUG_DRIVE_TICK_SECONDS_INVALID');
    }

    return this.gameDataStore.debugPrimeDriveTick(identity, input).catch((error) => {
      if (error instanceof Error && error.message === 'ACTIVE_TRIP_NOT_FOUND') {
        throw new ConflictException(error.message);
      }
      throw error;
    });
  }
}
