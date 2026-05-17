import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request = require('supertest');
import { AppModule } from '../src/app.module';

function useServerTime(isoTimestamp: string): void {
  jest.useFakeTimers({
    now: new Date(isoTimestamp),
    doNotFake: [
      'clearImmediate',
      'clearInterval',
      'clearTimeout',
      'nextTick',
      'setImmediate',
      'setInterval',
      'setTimeout',
    ],
  });
}

function setServerTime(isoTimestamp: string): void {
  jest.setSystemTime(new Date(isoTimestamp));
}

describe('Vehicle maintenance endpoints', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  afterAll(async () => {
    await app.close();
  });

  async function startTutorialTrip(authId: string) {
    const state = await request(app.getHttpServer())
      .get('/player/state')
      .set('x-newtrip-auth-id', authId)
      .expect(200);

    return request(app.getHttpServer())
      .post('/routes/start')
      .set('x-newtrip-auth-id', authId)
      .send({
        route_id: 'tutorial_big_sur_hwy1_001',
        player_vehicle_id: state.body.vehicles[0].playerVehicleId,
        idempotency_key: `${authId}:start`,
      })
      .expect(201);
  }

  async function claimOfflineReport(authId: string) {
    setServerTime('2026-05-18T02:00:00.000Z');
    const returnedState = await request(app.getHttpServer())
      .get('/player/state')
      .set('x-newtrip-auth-id', authId)
      .expect(200);

    await request(app.getHttpServer())
      .post('/trip/claim-offline-report')
      .set('x-newtrip-auth-id', authId)
      .send({
        report_id: returnedState.body.pendingOfflineReport.reportId,
        idempotency_key: `${authId}:claim-offline`,
      })
      .expect(201);

    return returnedState.body.vehicles[0];
  }

  it('refuels, cleans, repairs, spends Road Coins, and retries refuel idempotently', async () => {
    const authId = 'day9-maintenance-happy';
    useServerTime('2026-05-18T00:00:00.000Z');
    await startTutorialTrip(authId);
    const damagedVehicle = await claimOfflineReport(authId);

    expect(damagedVehicle.currentFuel).toBeLessThan(45);
    expect(damagedVehicle.currentCleanliness).toBeLessThan(100);
    expect(damagedVehicle.currentDurability).toBeLessThan(100);

    const refueled = await request(app.getHttpServer())
      .post('/vehicle/refuel')
      .set('x-newtrip-auth-id', authId)
      .send({
        player_vehicle_id: damagedVehicle.playerVehicleId,
        idempotency_key: 'refuel_once',
      })
      .expect(201);

    expect(refueled.body).toEqual(
      expect.objectContaining({
        action: 'REFUEL',
        costRoadCoins: 6,
        restoredAmount: 2.7,
      }),
    );
    expect(refueled.body.vehicle.currentFuel).toBe(45);
    expect(refueled.body.walletBalances).toEqual(
      expect.arrayContaining([expect.objectContaining({ currency: 'ROAD_COINS', balance: 154 })]),
    );
    expect(refueled.body.walletTransactions).toEqual([
      expect.objectContaining({
        currency: 'ROAD_COINS',
        amount: -6,
        reason: 'VEHICLE_REFUEL',
        sourceType: 'VEHICLE_MAINTENANCE',
      }),
    ]);

    const refuelRetry = await request(app.getHttpServer())
      .post('/vehicle/refuel')
      .set('x-newtrip-auth-id', authId)
      .send({
        player_vehicle_id: damagedVehicle.playerVehicleId,
        idempotency_key: 'refuel_once',
      })
      .expect(201);
    expect(refuelRetry.body).toEqual(refueled.body);

    const cleaned = await request(app.getHttpServer())
      .post('/vehicle/clean')
      .set('x-newtrip-auth-id', authId)
      .send({
        player_vehicle_id: damagedVehicle.playerVehicleId,
        idempotency_key: 'clean_once',
      })
      .expect(201);
    expect(cleaned.body.costRoadCoins).toBe(17);
    expect(cleaned.body.vehicle.currentCleanliness).toBe(100);

    const repaired = await request(app.getHttpServer())
      .post('/vehicle/repair')
      .set('x-newtrip-auth-id', authId)
      .send({
        player_vehicle_id: damagedVehicle.playerVehicleId,
        idempotency_key: 'repair_once',
      })
      .expect(201);
    expect(repaired.body.costRoadCoins).toBe(26);
    expect(repaired.body.vehicle.currentDurability).toBe(100);
    expect(repaired.body.walletBalances).toEqual(
      expect.arrayContaining([expect.objectContaining({ currency: 'ROAD_COINS', balance: 111 })]),
    );
  });

  it('blocks full-stat maintenance and insufficient Road Coins', async () => {
    const fullAuthId = 'day9-maintenance-full';
    const fullState = await request(app.getHttpServer())
      .get('/player/state')
      .set('x-newtrip-auth-id', fullAuthId)
      .expect(200);

    await request(app.getHttpServer())
      .post('/vehicle/refuel')
      .set('x-newtrip-auth-id', fullAuthId)
      .send({
        player_vehicle_id: fullState.body.vehicles[0].playerVehicleId,
        idempotency_key: 'full_refuel',
      })
      .expect(409);
    await request(app.getHttpServer())
      .post('/vehicle/clean')
      .set('x-newtrip-auth-id', fullAuthId)
      .send({
        player_vehicle_id: fullState.body.vehicles[0].playerVehicleId,
        idempotency_key: 'full_clean',
      })
      .expect(409);
    await request(app.getHttpServer())
      .post('/vehicle/repair')
      .set('x-newtrip-auth-id', fullAuthId)
      .send({
        player_vehicle_id: fullState.body.vehicles[0].playerVehicleId,
        idempotency_key: 'full_repair',
      })
      .expect(409);

    const poorAuthId = 'day9-maintenance-poor';
    useServerTime('2026-05-18T03:00:00.000Z');
    const started = await startTutorialTrip(poorAuthId);
    setServerTime('2026-05-18T03:00:15.000Z');
    await request(app.getHttpServer())
      .post('/trip/drive-tick')
      .set('x-newtrip-auth-id', poorAuthId)
      .send({
        trip_id: started.body.tripId,
        mode: 'HOLD_TO_DRIVE',
        client_tick_seq: 1,
        idempotency_key: 'poor_drive',
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/vehicle/clean')
      .set('x-newtrip-auth-id', poorAuthId)
      .send({
        player_vehicle_id: started.body.playerVehicleId,
        idempotency_key: 'poor_clean',
      })
      .expect(409);
  });
});
