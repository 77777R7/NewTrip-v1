import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request = require('supertest');
import { AppModule } from '../src/app.module';

describe('Player endpoints', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('initializes a new player with default wallet balances and vehicle', async () => {
    const response = await request(app.getHttpServer())
      .get('/player/state')
      .set('x-newtrip-auth-id', 'e2e-player-1')
      .expect(200);

    expect(response.body.profile.tutorialState).toBe('NOT_STARTED');
    expect(response.body.walletBalances).toHaveLength(5);
    expect(response.body.walletBalances).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ currency: 'ROAD_COINS', balance: 0 }),
        expect.objectContaining({ currency: 'TRAVEL_TOKENS', balance: 0 }),
        expect.objectContaining({ currency: 'SOUVENIR_STAMPS', balance: 0 }),
        expect.objectContaining({ currency: 'STAMP_FRAGMENTS', balance: 0 }),
        expect.objectContaining({ currency: 'BLUEPRINTS', balance: 0 }),
      ]),
    );
    expect(response.body.vehicles).toHaveLength(1);
    expect(response.body.vehicles[0]).toEqual(
      expect.objectContaining({
        vehicleKey: 'van_common_001',
        currentFuel: 45,
        currentDurability: 100,
        currentCleanliness: 100,
        isSelected: true,
      }),
    );
    expect(response.body.profile.currentVehicleId).toBe(response.body.vehicles[0].playerVehicleId);
  });

  it('does not duplicate the default vehicle on repeated state requests', async () => {
    const first = await request(app.getHttpServer())
      .get('/player/state')
      .set('x-newtrip-auth-id', 'e2e-player-repeat')
      .expect(200);

    const second = await request(app.getHttpServer())
      .get('/player/state')
      .set('x-newtrip-auth-id', 'e2e-player-repeat')
      .expect(200);

    expect(second.body.profile.playerId).toBe(first.body.profile.playerId);
    expect(second.body.vehicles).toHaveLength(1);
    expect(second.body.vehicles[0].playerVehicleId).toBe(first.body.vehicles[0].playerVehicleId);
  });
});
