import { Controller, Get, Query, Req } from '@nestjs/common';
import { Request } from 'express';
import { getRequestAuthIdentity } from '../auth/request-auth';
import { AdminService } from './admin.service';

@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('analytics-events')
  getAnalyticsEvents(@Req() request: Request, @Query('limit') limit?: string) {
    return this.adminService.getAnalyticsEvents(getRequestAuthIdentity(request), this.parseLimit(limit));
  }

  @Get('suspicious-events')
  getSuspiciousEvents(@Req() request: Request, @Query('limit') limit?: string) {
    return this.adminService.getSuspiciousEvents(getRequestAuthIdentity(request), this.parseLimit(limit));
  }

  private parseLimit(limit?: string): number | undefined {
    if (!limit) {
      return undefined;
    }

    const parsed = Number(limit);
    return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : undefined;
  }
}
