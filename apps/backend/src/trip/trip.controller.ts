import { Controller, Get, Req } from '@nestjs/common';
import { Request } from 'express';
import { getRequestAuthIdentity } from '../auth/request-auth';
import { TripService } from './trip.service';

@Controller('trip')
export class TripController {
  constructor(private readonly tripService: TripService) {}

  @Get('current')
  getCurrent(@Req() request: Request) {
    return this.tripService.getCurrentTrip(getRequestAuthIdentity(request));
  }
}
