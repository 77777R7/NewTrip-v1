import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { VehicleController } from './vehicle.controller';
import { VehicleService } from './vehicle.service';

@Module({
  imports: [DatabaseModule],
  controllers: [VehicleController],
  providers: [VehicleService],
})
export class VehicleModule {}
