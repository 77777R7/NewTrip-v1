import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { PlayerModule } from './player/player.module';
import { RoutesModule } from './routes/routes.module';
import { TripModule } from './trip/trip.module';
import { WalletModule } from './wallet/wallet.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    DatabaseModule,
    HealthModule,
    WalletModule,
    PlayerModule,
    RoutesModule,
    TripModule,
  ],
})
export class AppModule {}
