import { Body, Controller, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import { getRequestAuthIdentity } from '../auth/request-auth';
import { DebugService } from './debug.service';

type SimulateOfflineBody = {
  hours?: number;
};

type PrimeDriveTickBody = {
  seconds?: number;
};

@Controller('debug')
export class DebugController {
  constructor(private readonly debugService: DebugService) {}

  @Post('simulate-offline')
  simulateOffline(@Req() request: Request, @Body() body: SimulateOfflineBody) {
    return this.debugService.simulateOffline(getRequestAuthIdentity(request), {
      hours: body.hours ?? 2,
    });
  }

  @Post('prime-drive-tick')
  primeDriveTick(@Req() request: Request, @Body() body: PrimeDriveTickBody) {
    return this.debugService.primeDriveTick(getRequestAuthIdentity(request), {
      seconds: body.seconds ?? 15,
    });
  }
}
