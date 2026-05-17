import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import { getRequestAuthIdentity } from '../auth/request-auth';
import { TripService } from './trip.service';

type DriveTickBody = {
  tripId?: string;
  trip_id?: string;
  mode?: 'HOLD_TO_DRIVE' | 'AUTO_DRIVING' | 'HOLD_TO_BOOST';
  clientTickSeq?: number;
  client_tick_seq?: number;
  idempotencyKey?: string;
  idempotency_key?: string;
};

type CompleteLandmarkBody = {
  tripId?: string;
  trip_id?: string;
  landmarkId?: string;
  landmark_id?: string;
  action?: 'TAKE_PHOTO';
  idempotencyKey?: string;
  idempotency_key?: string;
};

type ClaimOfflineReportBody = {
  reportId?: string;
  report_id?: string;
  idempotencyKey?: string;
  idempotency_key?: string;
};

type CompleteRouteBody = {
  tripId?: string;
  trip_id?: string;
  idempotencyKey?: string;
  idempotency_key?: string;
};

@Controller('trip')
export class TripController {
  constructor(private readonly tripService: TripService) {}

  @Get('current')
  getCurrent(@Req() request: Request) {
    return this.tripService.getCurrentTrip(getRequestAuthIdentity(request));
  }

  @Post('drive-tick')
  driveTick(@Req() request: Request, @Body() body: DriveTickBody) {
    return this.tripService.driveTick(getRequestAuthIdentity(request), {
      tripId: body.tripId ?? body.trip_id ?? '',
      mode: body.mode ?? 'HOLD_TO_DRIVE',
      clientTickSeq: body.clientTickSeq ?? body.client_tick_seq ?? 0,
      idempotencyKey: body.idempotencyKey ?? body.idempotency_key ?? '',
    });
  }

  @Post('complete-landmark')
  completeLandmark(@Req() request: Request, @Body() body: CompleteLandmarkBody) {
    return this.tripService.completeLandmark(getRequestAuthIdentity(request), {
      tripId: body.tripId ?? body.trip_id ?? '',
      landmarkId: body.landmarkId ?? body.landmark_id ?? '',
      action: body.action ?? 'TAKE_PHOTO',
      idempotencyKey: body.idempotencyKey ?? body.idempotency_key ?? '',
    });
  }

  @Post('claim-offline-report')
  claimOfflineReport(@Req() request: Request, @Body() body: ClaimOfflineReportBody) {
    return this.tripService.claimOfflineReport(getRequestAuthIdentity(request), {
      reportId: body.reportId ?? body.report_id ?? '',
      idempotencyKey: body.idempotencyKey ?? body.idempotency_key ?? '',
    });
  }

  @Post('complete-route')
  completeRoute(@Req() request: Request, @Body() body: CompleteRouteBody) {
    return this.tripService.completeRoute(getRequestAuthIdentity(request), {
      tripId: body.tripId ?? body.trip_id ?? '',
      idempotencyKey: body.idempotencyKey ?? body.idempotency_key ?? '',
    });
  }
}
