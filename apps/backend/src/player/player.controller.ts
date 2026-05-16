import { Controller, Get, Req } from '@nestjs/common';
import { Request } from 'express';
import { getRequestAuthIdentity } from '../auth/request-auth';
import { PlayerService } from './player.service';

@Controller('player')
export class PlayerController {
  constructor(private readonly playerService: PlayerService) {}

  @Get('profile')
  getProfile(@Req() request: Request) {
    return this.playerService.getProfile(getRequestAuthIdentity(request));
  }

  @Get('state')
  getState(@Req() request: Request) {
    return this.playerService.getState(getRequestAuthIdentity(request));
  }
}
