import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  AuthIdentity,
  GAME_DATA_STORE,
  GameDataStore,
  RouteDefinition,
  RouteUnlockResult,
  StartTripInput,
  Trip,
  UnlockRouteInput,
} from '../database/game-data-store';

@Injectable()
export class RoutesService {
  constructor(@Inject(GAME_DATA_STORE) private readonly gameDataStore: GameDataStore) {}

  getAvailableRoutes(identity: AuthIdentity): Promise<RouteDefinition[]> {
    return this.gameDataStore.getAvailableRoutes(identity);
  }

  async getRoute(identity: AuthIdentity, routeId: string): Promise<RouteDefinition> {
    const route = await this.gameDataStore.getRoute(identity, routeId);
    if (!route) {
      throw new NotFoundException('ROUTE_NOT_FOUND');
    }
    return route;
  }

  async start(identity: AuthIdentity, input: StartTripInput): Promise<Trip> {
    try {
      return await this.gameDataStore.startTrip(identity, input);
    } catch (error) {
      throw this.toHttpError(error);
    }
  }

  async abandon(identity: AuthIdentity, input: { tripId?: string; idempotencyKey: string }): Promise<Trip> {
    try {
      return await this.gameDataStore.abandonTrip(identity, input);
    } catch (error) {
      throw this.toHttpError(error);
    }
  }

  async unlock(identity: AuthIdentity, input: UnlockRouteInput): Promise<RouteUnlockResult> {
    try {
      if (!input.routeId) {
        throw new Error('ROUTE_ID_REQUIRED');
      }
      if (!input.idempotencyKey) {
        throw new Error('IDEMPOTENCY_KEY_REQUIRED');
      }
      return await this.gameDataStore.unlockRoute(identity, input);
    } catch (error) {
      throw this.toHttpError(error);
    }
  }

  private toHttpError(error: unknown): Error {
    if (!(error instanceof Error)) {
      return new Error('Route operation failed');
    }

    if (['ROUTE_NOT_FOUND', 'VEHICLE_NOT_FOUND', 'ACTIVE_TRIP_NOT_FOUND'].includes(error.message)) {
      return new NotFoundException(error.message);
    }

    if (['ROUTE_ID_REQUIRED', 'IDEMPOTENCY_KEY_REQUIRED'].includes(error.message)) {
      return new BadRequestException(error.message);
    }

    if (['ACTIVE_TRIP_EXISTS', 'ROUTE_LOCKED', 'INSUFFICIENT_FUNDS'].includes(error.message)) {
      return new ConflictException(error.message);
    }

    return error;
  }
}
