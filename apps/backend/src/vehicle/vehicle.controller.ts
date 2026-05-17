import { Body, Controller, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import { getRequestAuthIdentity } from '../auth/request-auth';
import { VehicleService } from './vehicle.service';

type VehicleMaintenanceBody = {
  playerVehicleId?: string;
  player_vehicle_id?: string;
  idempotencyKey?: string;
  idempotency_key?: string;
};

@Controller('vehicle')
export class VehicleController {
  constructor(private readonly vehicleService: VehicleService) {}

  @Post('refuel')
  refuel(@Req() request: Request, @Body() body: VehicleMaintenanceBody) {
    return this.vehicleService.refuel(getRequestAuthIdentity(request), {
      playerVehicleId: body.playerVehicleId ?? body.player_vehicle_id,
      idempotencyKey: body.idempotencyKey ?? body.idempotency_key ?? '',
    });
  }

  @Post('clean')
  clean(@Req() request: Request, @Body() body: VehicleMaintenanceBody) {
    return this.vehicleService.clean(getRequestAuthIdentity(request), {
      playerVehicleId: body.playerVehicleId ?? body.player_vehicle_id,
      idempotencyKey: body.idempotencyKey ?? body.idempotency_key ?? '',
    });
  }

  @Post('repair')
  repair(@Req() request: Request, @Body() body: VehicleMaintenanceBody) {
    return this.vehicleService.repair(getRequestAuthIdentity(request), {
      playerVehicleId: body.playerVehicleId ?? body.player_vehicle_id,
      idempotencyKey: body.idempotencyKey ?? body.idempotency_key ?? '',
    });
  }
}
