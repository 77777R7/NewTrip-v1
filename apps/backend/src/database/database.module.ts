import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GAME_DATA_STORE } from './game-data-store';
import { InMemoryGameDataStore } from './in-memory-game-data-store';
import { PostgresGameDataStore } from './postgres-game-data-store';

@Module({
  providers: [
    {
      provide: GAME_DATA_STORE,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        if (configService.get<string>('DATABASE_URL')) {
          return new PostgresGameDataStore(configService);
        }
        return new InMemoryGameDataStore();
      },
    },
  ],
  exports: [GAME_DATA_STORE],
})
export class DatabaseModule {}
