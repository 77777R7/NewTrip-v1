import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request = require('supertest');
import { AppModule } from '../src/app.module';

const FIRST_LANDMARK_ID = '00000000-0000-4000-8000-000000000501';

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

describe('Tutorial landmark and photo flow', () => {
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
        route_id: 'tutorial_big_sur_hwy1_001',
        player_vehicle_id: state.body.vehicles[0].playerVehicleId,
        idempotency_key: `${authId}:start`,
      })
      .expect(201);
  }

  async function driveHoldTick(authId: string, tripId: string, tickSeq: number, atMs: number) {
    setServerTime(new Date(atMs).toISOString());
    return request(app.getHttpServer())
      .post('/trip/drive-tick')
      .set('x-newtrip-auth-id', authId)
      .send({
        trip_id: tripId,
        mode: 'HOLD_TO_DRIVE',
        client_tick_seq: tickSeq,
        idempotency_key: `day7_drive_${tickSeq}`,
      })
      .expect(201);
  }

  it('unlocks Auto Driving, stops at the first landmark, and completes the first photo', async () => {
    const authId = 'day7-tutorial-photo';
    const startMs = Date.parse('2026-05-17T00:00:00.000Z');
    useServerTime(new Date(startMs).toISOString());
    const started = await startTutorialTrip(authId);

    const startedState = await request(app.getHttpServer())
      .get('/player/state')
      .set('x-newtrip-auth-id', authId)
      .expect(200);
    expect(startedState.body.profile.tutorialState).toBe('ROUTE_SELECTED');

    await driveHoldTick(authId, started.body.tripId, 1, startMs + 15_000);

    const firstTickState = await request(app.getHttpServer())
      .get('/player/state')
      .set('x-newtrip-auth-id', authId)
      .expect(200);
    expect(firstTickState.body.profile.tutorialState).toBe('HOLD_TO_DRIVE_REQUIRED');

    for (let tickSeq = 2; tickSeq <= 4; tickSeq += 1) {
      await driveHoldTick(authId, started.body.tripId, tickSeq, startMs + tickSeq * 15_000);
    }

    const autoUnlockedState = await request(app.getHttpServer())
      .get('/player/state')
      .set('x-newtrip-auth-id', authId)
      .expect(200);
    expect(autoUnlockedState.body.profile.tutorialState).toBe('AUTO_DRIVING_UNLOCKED');

    setServerTime(new Date(startMs + 5 * 15_000).toISOString());
    await request(app.getHttpServer())
      .post('/trip/drive-tick')
      .set('x-newtrip-auth-id', authId)
      .send({
        trip_id: started.body.tripId,
        mode: 'AUTO_DRIVING',
        client_tick_seq: 5,
        idempotency_key: 'day7_auto_after_unlock',
      })
      .expect(201);

    let landmarkTick: request.Response | null = null;
    for (let tickSeq = 6; tickSeq <= 155; tickSeq += 1) {
      landmarkTick = await driveHoldTick(authId, started.body.tripId, tickSeq, startMs + tickSeq * 15_000);
      if (landmarkTick.body.trip.status === 'FORCED_STOP') {
        break;
      }
    }

    expect(landmarkTick).not.toBeNull();
    expect(landmarkTick?.body).toEqual(
      expect.objectContaining({
        finalDistanceKm: 40,
        forcedStopReason: 'LANDMARK_REQUIRED',
        landmarkId: FIRST_LANDMARK_ID,
      }),
    );

    const landmarkState = await request(app.getHttpServer())
      .get('/player/state')
      .set('x-newtrip-auth-id', authId)
      .expect(200);
    expect(landmarkState.body.profile.tutorialState).toBe('FIRST_LANDMARK_REACHED');

    setServerTime(new Date(startMs + 156 * 15_000).toISOString());
    const completed = await request(app.getHttpServer())
      .post('/trip/complete-landmark')
      .set('x-newtrip-auth-id', authId)
      .send({
        trip_id: started.body.tripId,
        landmark_id: FIRST_LANDMARK_ID,
        action: 'TAKE_PHOTO',
        idempotency_key: 'day7_complete_landmark_once',
      })
      .expect(201);

    expect(completed.body.trip).toEqual(
      expect.objectContaining({
        tripId: started.body.tripId,
        status: 'ACTIVE',
        currentDistanceKm: 40,
        forcedStopReason: null,
      }),
    );
    expect(completed.body.photo).toEqual(
      expect.objectContaining({
        landmarkId: FIRST_LANDMARK_ID,
        photoCardKey: 'photo_bixby_bridge_v1',
        isFirstPhoto: true,
      }),
    );
    expect(completed.body.photo.qualityScore).toBeGreaterThanOrEqual(0);
    expect(completed.body.photo.qualityScore).toBeLessThanOrEqual(100);
    expect(completed.body.walletTransactions).toEqual([
      expect.objectContaining({
        currency: 'ROAD_COINS',
        amount: 80,
        reason: 'PHOTO_FIRST_REWARD',
        sourceType: 'LANDMARK_PHOTO',
      }),
    ]);
    expect(completed.body.profile.tutorialState).toBe('PHOTO_TAKEN');

    const roadCoinsAfterPhoto = completed.body.walletBalances.find(
      (balance: { currency: string }) => balance.currency === 'ROAD_COINS',
    ).balance;

    const retry = await request(app.getHttpServer())
      .post('/trip/complete-landmark')
      .set('x-newtrip-auth-id', authId)
      .send({
        trip_id: started.body.tripId,
        landmark_id: FIRST_LANDMARK_ID,
        action: 'TAKE_PHOTO',
        idempotency_key: 'day7_complete_landmark_once',
      })
      .expect(201);

    expect(retry.body.photo.photoId).toBe(completed.body.photo.photoId);
    expect(
      retry.body.walletBalances.find((balance: { currency: string }) => balance.currency === 'ROAD_COINS').balance,
    ).toBe(roadCoinsAfterPhoto);
  });
});
