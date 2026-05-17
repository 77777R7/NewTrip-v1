import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  AuthIdentity,
  CompleteLandmarkInput,
  CompleteLandmarkResult,
  DriveTickInput,
  DriveTickResult,
  GAME_DATA_STORE,
  GameDataStore,
  Trip,
} from '../database/game-data-store';

@Injectable()
export class TripService {
  constructor(@Inject(GAME_DATA_STORE) private readonly gameDataStore: GameDataStore) {}

  getCurrentTrip(identity: AuthIdentity): Promise<Trip | null> {
    return this.gameDataStore.getCurrentTrip(identity);
  }

  async driveTick(identity: AuthIdentity, input: DriveTickInput): Promise<DriveTickResult> {
    try {
      if (!input.tripId) {
        throw new Error('TRIP_ID_REQUIRED');
      }
      if (!['HOLD_TO_DRIVE', 'AUTO_DRIVING', 'HOLD_TO_BOOST'].includes(input.mode)) {
        throw new Error('INVALID_DRIVE_MODE');
      }
      if (!input.idempotencyKey) {
        throw new Error('IDEMPOTENCY_KEY_REQUIRED');
      }

      return await this.gameDataStore.driveTick(identity, input);
    } catch (error) {
      throw this.toHttpError(error);
    }
  }

  async completeLandmark(identity: AuthIdentity, input: CompleteLandmarkInput): Promise<CompleteLandmarkResult> {
    try {
      if (!input.tripId) {
        throw new Error('TRIP_ID_REQUIRED');
      }
      if (!input.landmarkId) {
        throw new Error('LANDMARK_ID_REQUIRED');
      }
      if (input.action !== 'TAKE_PHOTO') {
        throw new Error('INVALID_LANDMARK_ACTION');
      }
      if (!input.idempotencyKey) {
        throw new Error('IDEMPOTENCY_KEY_REQUIRED');
      }

      return await this.gameDataStore.completeLandmark(identity, input);
    } catch (error) {
      throw this.toHttpError(error);
    }
  }

  private toHttpError(error: unknown): Error {
    if (!(error instanceof Error)) {
      return new Error('Trip operation failed');
    }

    if (
      [
        'TRIP_ID_REQUIRED',
        'INVALID_DRIVE_MODE',
        'LANDMARK_ID_REQUIRED',
        'INVALID_LANDMARK_ACTION',
        'IDEMPOTENCY_KEY_REQUIRED',
      ].includes(error.message)
    ) {
      return new BadRequestException(error.message);
    }

    if (['TRIP_NOT_FOUND', 'VEHICLE_NOT_FOUND', 'ROUTE_NOT_FOUND', 'LANDMARK_NOT_FOUND'].includes(error.message)) {
      return new NotFoundException(error.message);
    }

    if (['TRIP_NOT_ACTIVE', 'MODE_LOCKED', 'LANDMARK_STOP_REQUIRED', 'LANDMARK_ALREADY_COMPLETED'].includes(error.message)) {
      return new ConflictException(error.message);
    }

    return error;
  }
}
