import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import { getRequestAuthIdentity } from '../auth/request-auth';
import { RoutesService } from './routes.service';

type StartRouteBody = {
  routeId?: string;
  route_id?: string;
  playerVehicleId?: string;
  player_vehicle_id?: string;
  idempotencyKey?: string;
  idempotency_key?: string;
};

type AbandonRouteBody = {
  tripId?: string;
  trip_id?: string;
  idempotencyKey?: string;
  idempotency_key?: string;
};

type UnlockRouteBody = {
  routeId?: string;
  route_id?: string;
  idempotencyKey?: string;
  idempotency_key?: string;
};

@Controller('routes')
export class RoutesController {
  constructor(private readonly routesService: RoutesService) {}

  @Get('available')
  getAvailable(@Req() request: Request) {
    return this.routesService.getAvailableRoutes(getRequestAuthIdentity(request));
  }

  @Get(':routeId')
  getRoute(@Req() request: Request, @Param('routeId') routeId: string) {
    return this.routesService.getRoute(getRequestAuthIdentity(request), routeId);
  }

  @Post('start')
  start(@Req() request: Request, @Body() body: StartRouteBody) {
    return this.routesService.start(getRequestAuthIdentity(request), {
      routeId: body.routeId ?? body.route_id ?? '',
      playerVehicleId: body.playerVehicleId ?? body.player_vehicle_id,
      idempotencyKey: body.idempotencyKey ?? body.idempotency_key ?? `start:${body.routeId ?? body.route_id ?? ''}`,
    });
  }

  @Post('abandon')
  abandon(@Req() request: Request, @Body() body: AbandonRouteBody) {
    return this.routesService.abandon(getRequestAuthIdentity(request), {
      tripId: body.tripId ?? body.trip_id,
      idempotencyKey: body.idempotencyKey ?? body.idempotency_key ?? `abandon:${body.tripId ?? body.trip_id ?? 'current'}`,
    });
  }

  @Post('unlock')
  unlock(@Req() request: Request, @Body() body: UnlockRouteBody) {
    const routeId = body.routeId ?? body.route_id ?? '';
    return this.routesService.unlock(getRequestAuthIdentity(request), {
      routeId,
      idempotencyKey: body.idempotencyKey ?? body.idempotency_key ?? `unlock:${routeId}`,
    });
  }
}
