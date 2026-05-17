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

describe('Trip drive tick endpoint', () => {
  let app: INestApplication;

  jest.setTimeout(20000);

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

  it('advances online distance, consumes vehicle state, and grants immediate rewards', async () => {
    const authId = 'day6-drive-tick-basic';
    useServerTime('2026-05-16T00:00:00.000Z');
    const started = await startTutorialTrip(authId);

    setServerTime('2026-05-16T00:00:15.000Z');
    const tick = await request(app.getHttpServer())
      .post('/trip/drive-tick')
      .set('x-newtrip-auth-id', authId)
      .send({
        trip_id: started.body.tripId,
        mode: 'HOLD_TO_DRIVE',
        client_tick_seq: 1,
        idempotency_key: 'drive_basic_1',
      })
      .expect(201);

    expect(tick.body).toEqual(
      expect.objectContaining({
        durationSeconds: 15,
        distanceGainKm: 0.3,
        forcedStopReason: null,
        rewards: expect.objectContaining({
          roadCoins: 3,
          travelTokens: 0,
          tokenMeterKm: 0.3,
        }),
      }),
    );
    expect(tick.body.trip).toEqual(
      expect.objectContaining({
        tripId: started.body.tripId,
        status: 'ACTIVE',
        currentDistanceKm: 0.3,
        onlineTokenMeterKm: 0.3,
      }),
    );
    expect(tick.body.vehicle.currentFuel).toBeLessThan(45);
    expect(tick.body.vehicle.currentCleanliness).toBeLessThan(100);
    expect(tick.body.vehicle.currentDurability).toBeLessThan(100);
    expect(tick.body.walletBalances).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ currency: 'ROAD_COINS', balance: 3 }),
        expect.objectContaining({ currency: 'TRAVEL_TOKENS', balance: 0 }),
      ]),
    );
    expect(tick.body.walletTransactions).toEqual([
      expect.objectContaining({
        currency: 'ROAD_COINS',
        amount: 3,
        reason: 'ONLINE_DRIVE_REWARD',
        sourceType: 'TRIP_DRIVE_TICK',
      }),
    ]);
  });

  it('does not advance distance or pay rewards twice for the same idempotency key', async () => {
    const authId = 'day6-drive-tick-idempotent';
    useServerTime('2026-05-16T01:00:00.000Z');
    const started = await startTutorialTrip(authId);

    setServerTime('2026-05-16T01:00:15.000Z');
    const firstTick = await request(app.getHttpServer())
      .post('/trip/drive-tick')
      .set('x-newtrip-auth-id', authId)
      .send({
        trip_id: started.body.tripId,
        mode: 'HOLD_TO_DRIVE',
        client_tick_seq: 1,
        idempotency_key: 'drive_idempotent_1',
      })
      .expect(201);

    setServerTime('2026-05-16T01:00:45.000Z');
    const retryTick = await request(app.getHttpServer())
      .post('/trip/drive-tick')
      .set('x-newtrip-auth-id', authId)
      .send({
        trip_id: started.body.tripId,
        mode: 'HOLD_TO_DRIVE',
        client_tick_seq: 1,
        idempotency_key: 'drive_idempotent_1',
      })
      .expect(201);

    const current = await request(app.getHttpServer())
      .get('/trip/current')
      .set('x-newtrip-auth-id', authId)
      .expect(200);
    const state = await request(app.getHttpServer())
      .get('/player/state')
      .set('x-newtrip-auth-id', authId)
      .expect(200);

    expect(retryTick.body).toEqual(firstTick.body);
    expect(current.body.currentDistanceKm).toBe(0.3);
    expect(state.body.walletBalances).toEqual(
      expect.arrayContaining([expect.objectContaining({ currency: 'ROAD_COINS', balance: 3 })]),
    );
  });

  it('clamps long client gaps to the maximum online tick duration', async () => {
    const authId = 'day6-drive-tick-clamp';
    useServerTime('2026-05-16T02:00:00.000Z');
    const started = await startTutorialTrip(authId);

    setServerTime('2026-05-16T02:01:00.000Z');
    const tick = await request(app.getHttpServer())
      .post('/trip/drive-tick')
      .set('x-newtrip-auth-id', authId)
      .send({
        trip_id: started.body.tripId,
        mode: 'HOLD_TO_DRIVE',
        client_tick_seq: 1,
        idempotency_key: 'drive_clamp_1',
      })
      .expect(201);

    expect(tick.body.durationSeconds).toBe(15);
    expect(tick.body.distanceGainKm).toBe(0.3);
    expect(tick.body.trip.currentDistanceKm).toBe(0.3);
  });

  it('rejects drive modes that the tutorial has not unlocked yet', async () => {
    const authId = 'day6-drive-tick-mode-locked';
    useServerTime('2026-05-16T02:30:00.000Z');
    const started = await startTutorialTrip(authId);

    setServerTime('2026-05-16T02:30:15.000Z');
    await request(app.getHttpServer())
      .post('/trip/drive-tick')
      .set('x-newtrip-auth-id', authId)
      .send({
        trip_id: started.body.tripId,
        mode: 'AUTO_DRIVING',
        client_tick_seq: 1,
        idempotency_key: 'drive_mode_locked_1',
      })
      .expect(409);
  });

  it('stops at the first required landmark and blocks additional drive ticks', async () => {
    const authId = 'day6-drive-tick-landmark';
    const startMs = Date.parse('2026-05-16T03:00:00.000Z');
    useServerTime(new Date(startMs).toISOString());
    const started = await startTutorialTrip(authId);

    let lastTick: request.Response | null = null;
    for (let tickSeq = 1; tickSeq <= 150; tickSeq += 1) {
      setServerTime(new Date(startMs + tickSeq * 15_000).toISOString());
      lastTick = await request(app.getHttpServer())
        .post('/trip/drive-tick')
        .set('x-newtrip-auth-id', authId)
        .send({
          trip_id: started.body.tripId,
          mode: 'HOLD_TO_DRIVE',
          client_tick_seq: tickSeq,
          idempotency_key: `drive_landmark_${tickSeq}`,
        })
        .expect(201);

      if (lastTick.body.trip.status === 'FORCED_STOP') {
        break;
      }
    }

    expect(lastTick).not.toBeNull();
    expect(lastTick?.body).toEqual(
      expect.objectContaining({
        finalDistanceKm: 40,
        forcedStopReason: 'LANDMARK_REQUIRED',
        landmarkId: '00000000-0000-4000-8000-000000000501',
      }),
    );
    expect(lastTick?.body.trip).toEqual(
      expect.objectContaining({
        status: 'FORCED_STOP',
        currentDistanceKm: 40,
        forcedStopReason: 'LANDMARK_REQUIRED',
      }),
    );

    setServerTime(new Date(startMs + 151 * 15_000).toISOString());
    await request(app.getHttpServer())
      .post('/trip/drive-tick')
      .set('x-newtrip-auth-id', authId)
      .send({
        trip_id: started.body.tripId,
        mode: 'HOLD_TO_DRIVE',
        client_tick_seq: 151,
        idempotency_key: 'drive_after_landmark_stop',
      })
      .expect(409);
  });
});
