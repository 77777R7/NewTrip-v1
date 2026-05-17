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

describe('Offline Travel Report flow', () => {
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
        route_id: 'tutorial_coast_001',
        player_vehicle_id: state.body.vehicles[0].playerVehicleId,
        idempotency_key: `${authId}:start`,
      })
      .expect(201);
  }

  it('generates one pending report on return and pays rewards only when claimed', async () => {
    const authId = 'day8-offline-report';
    useServerTime('2026-05-17T00:00:00.000Z');
    const started = await startTutorialTrip(authId);

    setServerTime('2026-05-17T02:00:00.000Z');
    const returnedState = await request(app.getHttpServer())
      .get('/player/state')
      .set('x-newtrip-auth-id', authId)
      .expect(200);

    expect(returnedState.body.pendingOfflineReport).toEqual(
      expect.objectContaining({
        tripId: started.body.tripId,
        claimed: false,
        offlineSeconds: 7200,
        distanceTravelledKm: 40,
        roadCoinsPending: 160,
        travelTokensPending: 2,
        forcedStopReason: 'LANDMARK_REQUIRED',
      }),
    );
    expect(returnedState.body.pendingOfflineReport.fuelUsed).toBeGreaterThan(0);
    expect(returnedState.body.pendingOfflineReport.cleanlinessLoss).toBeGreaterThan(0);
    expect(returnedState.body.pendingOfflineReport.durabilityLoss).toBeGreaterThan(0);
    expect(returnedState.body.pendingOfflineReport.landmarkReached).toEqual(
      expect.objectContaining({
        landmarkId: '00000000-0000-4000-8000-000000000501',
      }),
    );
    expect(returnedState.body.walletBalances).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ currency: 'ROAD_COINS', balance: 0 }),
        expect.objectContaining({ currency: 'TRAVEL_TOKENS', balance: 0 }),
      ]),
    );

    const currentTrip = await request(app.getHttpServer())
      .get('/trip/current')
      .set('x-newtrip-auth-id', authId)
      .expect(200);
    expect(currentTrip.body).toEqual(
      expect.objectContaining({
        tripId: started.body.tripId,
        status: 'FORCED_STOP',
        currentDistanceKm: 40,
        forcedStopReason: 'LANDMARK_REQUIRED',
      }),
    );

    const repeatedState = await request(app.getHttpServer())
      .get('/player/state')
      .set('x-newtrip-auth-id', authId)
      .expect(200);
    expect(repeatedState.body.pendingOfflineReport.reportId).toBe(returnedState.body.pendingOfflineReport.reportId);

    const claimed = await request(app.getHttpServer())
      .post('/trip/claim-offline-report')
      .set('x-newtrip-auth-id', authId)
      .send({
        report_id: returnedState.body.pendingOfflineReport.reportId,
        idempotency_key: 'claim_offline_once',
      })
      .expect(201);

    expect(claimed.body.report).toEqual(
      expect.objectContaining({
        reportId: returnedState.body.pendingOfflineReport.reportId,
        claimed: true,
      }),
    );
    expect(claimed.body.walletBalances).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ currency: 'ROAD_COINS', balance: 160 }),
        expect.objectContaining({ currency: 'TRAVEL_TOKENS', balance: 2 }),
      ]),
    );
    expect(claimed.body.walletTransactions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          currency: 'ROAD_COINS',
          amount: 160,
          reason: 'OFFLINE_REPORT_CLAIM',
          sourceType: 'OFFLINE_REPORT',
        }),
        expect.objectContaining({
          currency: 'TRAVEL_TOKENS',
          amount: 2,
          reason: 'OFFLINE_REPORT_CLAIM',
          sourceType: 'OFFLINE_REPORT',
        }),
      ]),
    );

    const retry = await request(app.getHttpServer())
      .post('/trip/claim-offline-report')
      .set('x-newtrip-auth-id', authId)
      .send({
        report_id: returnedState.body.pendingOfflineReport.reportId,
        idempotency_key: 'claim_offline_once',
      })
      .expect(201);
    expect(retry.body.walletBalances).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ currency: 'ROAD_COINS', balance: 160 }),
        expect.objectContaining({ currency: 'TRAVEL_TOKENS', balance: 2 }),
      ]),
    );
  });
});
