import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { DebugController } from './debug.controller';
import { DebugService } from './debug.service';

@Module({
  imports: [DatabaseModule],
  controllers: [DebugController],
  providers: [DebugService],
})
export class DebugModule {}
