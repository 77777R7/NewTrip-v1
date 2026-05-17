import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  AuthIdentity,
  ClaimOfflineReportInput,
  ClaimOfflineReportResult,
  CompleteLandmarkInput,
  CompleteLandmarkResult,
  CompleteRouteInput,
  CompleteRouteResult,
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
        await this.recordSuspiciousBestEffort(identity, {
          riskType: 'INVALID_MODE',
          severity: 2,
          sourceEndpoint: 'POST /trip/drive-tick',
          tripId: input.tripId,
          requestPayload: {
            mode: input.mode,
            client_tick_seq: input.clientTickSeq,
            idempotency_key: input.idempotencyKey,
          },
          serverSnapshot: {
            reason: 'INVALID_DRIVE_MODE',
          },
          actionTaken: 'REJECT',
        });
        throw new Error('INVALID_DRIVE_MODE');
      }
      if (!input.idempotencyKey) {
        throw new Error('IDEMPOTENCY_KEY_REQUIRED');
      }

      return await this.gameDataStore.driveTick(identity, input);
    } catch (error) {
      if (error instanceof Error && error.message === 'MODE_LOCKED') {
        await this.recordSuspiciousBestEffort(identity, {
          riskType: 'INVALID_MODE',
          severity: 2,
          sourceEndpoint: 'POST /trip/drive-tick',
          tripId: input.tripId,
          requestPayload: {
            mode: input.mode,
            client_tick_seq: input.clientTickSeq,
            idempotency_key: input.idempotencyKey,
          },
          serverSnapshot: {
            reason: 'MODE_LOCKED',
          },
          actionTaken: 'REJECT',
        });
      }
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

  async claimOfflineReport(identity: AuthIdentity, input: ClaimOfflineReportInput): Promise<ClaimOfflineReportResult> {
    try {
      if (!input.reportId) {
        throw new Error('REPORT_ID_REQUIRED');
      }
      if (!input.idempotencyKey) {
        throw new Error('IDEMPOTENCY_KEY_REQUIRED');
      }

      return await this.gameDataStore.claimOfflineReport(identity, input);
    } catch (error) {
      if (error instanceof Error && error.message === 'REPORT_ALREADY_CLAIMED') {
        await this.recordSuspiciousBestEffort(identity, {
          riskType: 'REWARD_DUPLICATE_ATTEMPT',
          severity: 3,
          sourceEndpoint: 'POST /trip/claim-offline-report',
          requestPayload: {
            report_id: input.reportId,
            idempotency_key: input.idempotencyKey,
          },
          serverSnapshot: {
            reason: 'REPORT_ALREADY_CLAIMED',
          },
          actionTaken: 'REJECT',
        });
      }
      throw this.toHttpError(error);
    }
  }

  async completeRoute(identity: AuthIdentity, input: CompleteRouteInput): Promise<CompleteRouteResult> {
    try {
      if (!input.tripId) {
        throw new Error('TRIP_ID_REQUIRED');
      }
      if (!input.idempotencyKey) {
        throw new Error('IDEMPOTENCY_KEY_REQUIRED');
      }

      return await this.gameDataStore.completeRoute(identity, input);
    } catch (error) {
      if (error instanceof Error && error.message === 'ROUTE_ALREADY_COMPLETED') {
        await this.recordSuspiciousBestEffort(identity, {
          riskType: 'REWARD_DUPLICATE_ATTEMPT',
          severity: 3,
          sourceEndpoint: 'POST /trip/complete-route',
          tripId: input.tripId,
          requestPayload: {
            trip_id: input.tripId,
            idempotency_key: input.idempotencyKey,
          },
          serverSnapshot: {
            reason: 'ROUTE_ALREADY_COMPLETED',
          },
          actionTaken: 'REJECT',
        });
      }
      throw this.toHttpError(error);
    }
  }

  private async recordSuspiciousBestEffort(
    identity: AuthIdentity,
    input: Parameters<GameDataStore['recordSuspiciousEvent']>[1],
  ): Promise<void> {
    try {
      await this.gameDataStore.recordSuspiciousEvent(identity, input);
    } catch {
      // Suspicious-event logging should never mask the gameplay error being returned.
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
        'REPORT_ID_REQUIRED',
        'IDEMPOTENCY_KEY_REQUIRED',
      ].includes(error.message)
    ) {
      return new BadRequestException(error.message);
    }

    if (
      ['TRIP_NOT_FOUND', 'VEHICLE_NOT_FOUND', 'ROUTE_NOT_FOUND', 'LANDMARK_NOT_FOUND', 'REPORT_NOT_FOUND'].includes(error.message)
    ) {
      return new NotFoundException(error.message);
    }

    if (
      [
        'TRIP_NOT_ACTIVE',
        'MODE_LOCKED',
        'LANDMARK_STOP_REQUIRED',
        'LANDMARK_ALREADY_COMPLETED',
        'REPORT_ALREADY_CLAIMED',
        'ROUTE_NOT_COMPLETE',
        'REQUIRED_LANDMARKS_INCOMPLETE',
        'ROUTE_ALREADY_COMPLETED',
      ].includes(error.message)
    ) {
      return new ConflictException(error.message);
    }

    return error;
  }
}
