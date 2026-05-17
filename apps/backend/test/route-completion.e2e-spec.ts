import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request = require('supertest');
import { AppModule } from '../src/app.module';

const TUTORIAL_ROUTE_KEY = 'tutorial_big_sur_hwy1_001';
const SHORT_ROUTE_KEY = 'short_coast_to_town_001';
const BIXBY_BRIDGE_LANDMARK_ID = '00000000-0000-4000-8000-000000000501';

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

function balanceOf(walletBalances: Array<{ currency: string; balance: number }>, currency: string): number {
  return walletBalances.find((balance) => balance.currency === currency)?.balance ?? 0;
}

describe('Route completion and route unlock flow', () => {
  let app: INestApplication;

  jest.setTimeout(30000);

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
        route_id: TUTORIAL_ROUTE_KEY,
        player_vehicle_id: state.body.vehicles[0].playerVehicleId,
        idempotency_key: `${authId}:start_tutorial`,
      })
      .expect(201);
  }

  async function claimPendingOfflineReport(authId: string, idempotencyKey: string) {
    const state = await request(app.getHttpServer())
      .get('/player/state')
      .set('x-newtrip-auth-id', authId)
      .expect(200);

    expect(state.body.pendingOfflineReport).toBeTruthy();

    return request(app.getHttpServer())
      .post('/trip/claim-offline-report')
      .set('x-newtrip-auth-id', authId)
      .send({
        report_id: state.body.pendingOfflineReport.reportId,
        idempotency_key: idempotencyKey,
      })
      .expect(201);
  }

  it('completes the Big Sur tutorial route, grants one Stamp once, unlocks Short Route, and charges only Trip Prep Fee on start', async () => {
    const authId = 'day10-route-completion';
    useServerTime('2026-05-17T00:00:00.000Z');
    const started = await startTutorialTrip(authId);

    expect(started.body.route.routeKey).toBe(TUTORIAL_ROUTE_KEY);
    expect(started.body.route).toEqual(
      expect.objectContaining({
        name: 'Big Sur Sunset Drive',
        region: 'California Highway 1',
        startNode: 'Carmel Highlands',
        destinationNode: 'San Carpoforo Creek Approach',
        totalDistanceKm: 100,
      }),
    );

    setServerTime('2026-05-17T02:00:00.000Z');
    const firstReportClaim = await claimPendingOfflineReport(authId, 'day10_claim_landmark_report');
    expect(firstReportClaim.body.report).toEqual(
      expect.objectContaining({
        tripId: started.body.tripId,
        forcedStopReason: 'LANDMARK_REQUIRED',
      }),
    );

    const completedLandmark = await request(app.getHttpServer())
      .post('/trip/complete-landmark')
      .set('x-newtrip-auth-id', authId)
      .send({
        trip_id: started.body.tripId,
        landmark_id: BIXBY_BRIDGE_LANDMARK_ID,
        action: 'TAKE_PHOTO',
        idempotency_key: 'day10_complete_bixby_bridge',
      })
      .expect(201);

    expect(completedLandmark.body.photo).toEqual(
      expect.objectContaining({
        landmarkId: BIXBY_BRIDGE_LANDMARK_ID,
        photoCardKey: 'photo_bixby_bridge_v1',
        isFirstPhoto: true,
      }),
    );

    setServerTime('2026-05-17T10:00:00.000Z');
    const endReportClaim = await claimPendingOfflineReport(authId, 'day10_claim_route_end_report');
    expect(endReportClaim.body.report).toEqual(
      expect.objectContaining({
        tripId: started.body.tripId,
        forcedStopReason: 'ROUTE_END',
      }),
    );

    const completedRoute = await request(app.getHttpServer())
      .post('/trip/complete-route')
      .set('x-newtrip-auth-id', authId)
      .send({
        trip_id: started.body.tripId,
        idempotency_key: 'day10_complete_route_once',
      })
      .expect(201);

    expect(completedRoute.body.trip).toEqual(
      expect.objectContaining({
        tripId: started.body.tripId,
        status: 'COMPLETED',
        currentDistanceKm: 100,
        forcedStopReason: null,
      }),
    );
    expect(completedRoute.body.profile.tutorialState).toBe('FULL_SYSTEM_UNLOCKED');
    expect(completedRoute.body.walletTransactions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          currency: 'ROAD_COINS',
          amount: 150,
          reason: 'ROUTE_COMPLETE_REWARD',
          sourceType: 'ROUTE_COMPLETION',
        }),
        expect.objectContaining({
          currency: 'TRAVEL_TOKENS',
          amount: 1,
          reason: 'ROUTE_COMPLETE_REWARD',
          sourceType: 'ROUTE_COMPLETION',
        }),
        expect.objectContaining({
          currency: 'SOUVENIR_STAMPS',
          amount: 1,
          reason: 'ROUTE_COMPLETE_REWARD',
          sourceType: 'ROUTE_COMPLETION',
        }),
      ]),
    );
    expect(balanceOf(completedRoute.body.walletBalances, 'SOUVENIR_STAMPS')).toBe(1);

    const completionRetry = await request(app.getHttpServer())
      .post('/trip/complete-route')
      .set('x-newtrip-auth-id', authId)
      .send({
        trip_id: started.body.tripId,
        idempotency_key: 'day10_complete_route_once',
      })
      .expect(201);
    expect(balanceOf(completionRetry.body.walletBalances, 'SOUVENIR_STAMPS')).toBe(1);

    const unlocked = await request(app.getHttpServer())
      .post('/routes/unlock')
      .set('x-newtrip-auth-id', authId)
      .send({
        route_id: SHORT_ROUTE_KEY,
        idempotency_key: 'day10_unlock_short_route',
      })
      .expect(201);

    expect(unlocked.body).toEqual(
      expect.objectContaining({
        costStamps: 1,
      }),
    );
    expect(unlocked.body.route).toEqual(
      expect.objectContaining({
        routeKey: SHORT_ROUTE_KEY,
        routeType: 'Short',
        isUnlocked: true,
        tripPrepFeeCoins: 70,
      }),
    );
    expect(unlocked.body.walletTransactions).toEqual([
      expect.objectContaining({
        currency: 'SOUVENIR_STAMPS',
        amount: -1,
        reason: 'ROUTE_UNLOCK',
        sourceType: 'ROUTE_UNLOCK',
      }),
    ]);
    expect(balanceOf(unlocked.body.walletBalances, 'SOUVENIR_STAMPS')).toBe(0);

    const unlockRetry = await request(app.getHttpServer())
      .post('/routes/unlock')
      .set('x-newtrip-auth-id', authId)
      .send({
        route_id: SHORT_ROUTE_KEY,
        idempotency_key: 'day10_unlock_short_route',
      })
      .expect(201);
    expect(balanceOf(unlockRetry.body.walletBalances, 'SOUVENIR_STAMPS')).toBe(0);

    const coinsBeforeShortStart = balanceOf(unlockRetry.body.walletBalances, 'ROAD_COINS');
    const shortStarted = await request(app.getHttpServer())
      .post('/routes/start')
      .set('x-newtrip-auth-id', authId)
      .send({
        route_id: SHORT_ROUTE_KEY,
        idempotency_key: 'day10_start_short_route',
      })
      .expect(201);

    expect(shortStarted.body.route).toEqual(
      expect.objectContaining({
        routeKey: SHORT_ROUTE_KEY,
        isUnlocked: true,
      }),
    );

    const finalState = await request(app.getHttpServer())
      .get('/player/state')
      .set('x-newtrip-auth-id', authId)
      .expect(200);
    expect(balanceOf(finalState.body.walletBalances, 'ROAD_COINS')).toBe(coinsBeforeShortStart - 70);
    expect(balanceOf(finalState.body.walletBalances, 'SOUVENIR_STAMPS')).toBe(0);
  });

  it('rejects route completion before the route end', async () => {
    const authId = 'day10-complete-too-early';
    useServerTime('2026-05-17T00:00:00.000Z');
    const started = await startTutorialTrip(authId);

    await request(app.getHttpServer())
      .post('/trip/complete-route')
      .set('x-newtrip-auth-id', authId)
      .send({
        trip_id: started.body.tripId,
        idempotency_key: 'day10_complete_too_early',
      })
      .expect(409);
  });
});
