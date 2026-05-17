import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  AuthIdentity,
  GAME_DATA_STORE,
  GameDataStore,
  VehicleMaintenanceResult,
} from '../database/game-data-store';

type VehicleMaintenanceRequest = {
  playerVehicleId?: string;
  idempotencyKey: string;
};

@Injectable()
export class VehicleService {
  constructor(@Inject(GAME_DATA_STORE) private readonly gameDataStore: GameDataStore) {}

  refuel(identity: AuthIdentity, input: VehicleMaintenanceRequest): Promise<VehicleMaintenanceResult> {
    return this.maintain(identity, 'REFUEL', input);
  }

  clean(identity: AuthIdentity, input: VehicleMaintenanceRequest): Promise<VehicleMaintenanceResult> {
    return this.maintain(identity, 'CLEAN', input);
  }

  repair(identity: AuthIdentity, input: VehicleMaintenanceRequest): Promise<VehicleMaintenanceResult> {
    return this.maintain(identity, 'REPAIR', input);
  }

  private async maintain(
    identity: AuthIdentity,
    action: 'REFUEL' | 'CLEAN' | 'REPAIR',
    input: VehicleMaintenanceRequest,
  ): Promise<VehicleMaintenanceResult> {
    if (!input.idempotencyKey) {
      throw new BadRequestException('idempotency_key is required');
    }

    try {
      return await this.gameDataStore.maintainVehicle(identity, {
        action,
        playerVehicleId: input.playerVehicleId,
        idempotencyKey: input.idempotencyKey,
      });
    } catch (error) {
      if (!(error instanceof Error)) {
        throw error;
      }
      if (error.message === 'VEHICLE_NOT_FOUND') {
        throw new NotFoundException(error.message);
      }
      if (error.message === 'INSUFFICIENT_FUNDS') {
        throw new ConflictException(error.message);
      }
      if (['FULL_FUEL', 'FULL_CLEANLINESS', 'FULL_DURABILITY'].includes(error.message)) {
        throw new ConflictException(error.message);
      }
      throw error;
    }
  }
}
