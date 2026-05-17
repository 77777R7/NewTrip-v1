import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import { getRequestAuthIdentity } from '../auth/request-auth';
import { QuestsService } from './quests.service';

type ClaimQuestBody = {
  questKey?: string;
  quest_key?: string;
  idempotencyKey?: string;
  idempotency_key?: string;
};

@Controller('quests')
export class QuestsController {
  constructor(private readonly questsService: QuestsService) {}

  @Get('daily')
  getDailyQuests(@Req() request: Request) {
    return this.questsService.getDailyQuests(getRequestAuthIdentity(request));
  }

  @Post('claim')
  claimQuest(@Req() request: Request, @Body() body: ClaimQuestBody) {
    return this.questsService.claimDailyQuest(getRequestAuthIdentity(request), {
      questKey: body.questKey ?? body.quest_key ?? '',
      idempotencyKey: body.idempotencyKey ?? body.idempotency_key ?? '',
    });
  }
}
