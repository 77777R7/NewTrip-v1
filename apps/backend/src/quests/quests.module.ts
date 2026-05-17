import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { QuestsController } from './quests.controller';
import { QuestsService } from './quests.service';

@Module({
  imports: [DatabaseModule],
  controllers: [QuestsController],
  providers: [QuestsService],
})
export class QuestsModule {}
