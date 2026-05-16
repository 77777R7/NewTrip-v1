import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { TripController } from './trip.controller';
import { TripService } from './trip.service';

@Module({
  imports: [DatabaseModule],
  controllers: [TripController],
  providers: [TripService],
  exports: [TripService],
})
export class TripModule {}
