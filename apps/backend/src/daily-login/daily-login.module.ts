import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { DailyLoginController } from './daily-login.controller';
import { DailyLoginService } from './daily-login.service';

@Module({
  imports: [DatabaseModule],
  controllers: [DailyLoginController],
  providers: [DailyLoginService],
})
export class DailyLoginModule {}
