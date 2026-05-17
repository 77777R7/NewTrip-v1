import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import { getRequestAuthIdentity } from '../auth/request-auth';
import { DailyLoginService } from './daily-login.service';

type ClaimDailyLoginBody = {
  idempotencyKey?: string;
  idempotency_key?: string;
};

@Controller('daily-login')
export class DailyLoginController {
  constructor(private readonly dailyLoginService: DailyLoginService) {}

  @Get()
  getDailyLogin(@Req() request: Request) {
    return this.dailyLoginService.getDailyLogin(getRequestAuthIdentity(request));
  }

  @Post('claim')
  claimDailyLogin(@Req() request: Request, @Body() body: ClaimDailyLoginBody) {
    return this.dailyLoginService.claimDailyLogin(getRequestAuthIdentity(request), {
      idempotencyKey: body.idempotencyKey ?? body.idempotency_key ?? '',
    });
  }
}
