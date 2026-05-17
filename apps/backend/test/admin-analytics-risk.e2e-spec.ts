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

describe('Admin analytics and risk event tracing', () => {
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
        idempotency_key: `${authId}:start_tutorial`,
      })
      .expect(201);
  }

  it('records core analytics events for tutorial start, wallet changes, auto unlock, and landmark stops', async () => {
    const authId = 'day12-analytics-core';
    const startMs = Date.parse('2026-05-19T00:00:00.000Z');
    useServerTime(new Date(startMs).toISOString());
    const started = await startTutorialTrip(authId);

    for (let tickSeq = 1; tickSeq <= 150; tickSeq += 1) {
      setServerTime(new Date(startMs + tickSeq * 15_000).toISOString());
      const tick = await request(app.getHttpServer())
        .post('/trip/drive-tick')
        .set('x-newtrip-auth-id', authId)
        .send({
          trip_id: started.body.tripId,
          mode: 'HOLD_TO_DRIVE',
          client_tick_seq: tickSeq,
          idempotency_key: `day12_analytics_drive_${tickSeq}`,
        })
        .expect(201);

      if (tick.body.trip.status === 'FORCED_STOP') {
        break;
      }
    }

    const events = await request(app.getHttpServer())
      .get('/admin/analytics-events?limit=500')
      .set('x-newtrip-auth-id', authId)
      .expect(200);
    const eventNames = events.body.map((event: { eventName: string }) => event.eventName);

    expect(eventNames).toEqual(expect.arrayContaining([
      'tutorial_start',
      'drive_tick',
      'wallet_currency_changed',
      'auto_driving_unlocked',
      'stopped_at_landmark',
    ]));
    expect(events.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          eventName: 'wallet_currency_changed',
          eventPayload: expect.objectContaining({
            currency: 'ROAD_COINS',
            reason: 'ONLINE_DRIVE_REWARD',
          }),
        }),
        expect.objectContaining({
          eventName: 'stopped_at_landmark',
          eventPayload: expect.objectContaining({
            distance_km: 40,
          }),
        }),
      ]),
    );
  });

  it('records suspicious events for locked modes, clamped ticks, and duplicate reward claims', async () => {
    const authId = 'day12-risk-core';
    const startMs = Date.parse('2026-05-19T03:00:00.000Z');
    useServerTime(new Date(startMs).toISOString());
    const started = await startTutorialTrip(authId);

    setServerTime(new Date(startMs + 15_000).toISOString());
    await request(app.getHttpServer())
      .post('/trip/drive-tick')
      .set('x-newtrip-auth-id', authId)
      .send({
        trip_id: started.body.tripId,
        mode: 'AUTO_DRIVING',
        client_tick_seq: 1,
        idempotency_key: 'day12_locked_auto',
      })
      .expect(409);

    setServerTime(new Date(startMs + 75_000).toISOString());
    await request(app.getHttpServer())
      .post('/trip/drive-tick')
      .set('x-newtrip-auth-id', authId)
      .send({
        trip_id: started.body.tripId,
        mode: 'HOLD_TO_DRIVE',
        client_tick_seq: 2,
        idempotency_key: 'day12_clamped_tick',
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/daily-login/claim')
      .set('x-newtrip-auth-id', authId)
      .send({ idempotency_key: 'day12_daily_once' })
      .expect(201);
    await request(app.getHttpServer())
      .post('/daily-login/claim')
      .set('x-newtrip-auth-id', authId)
      .send({ idempotency_key: 'day12_daily_duplicate' })
      .expect(409);

    const events = await request(app.getHttpServer())
      .get('/admin/suspicious-events')
      .set('x-newtrip-auth-id', authId)
      .expect(200);
    const riskTypes = events.body.map((event: { riskType: string }) => event.riskType);

    expect(riskTypes).toEqual(expect.arrayContaining([
      'INVALID_MODE',
      'TICK_RATE_LIMITED',
      'REWARD_DUPLICATE_ATTEMPT',
    ]));
    expect(events.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          riskType: 'INVALID_MODE',
          actionTaken: 'REJECT',
          sourceEndpoint: 'POST /trip/drive-tick',
        }),
        expect.objectContaining({
          riskType: 'TICK_RATE_LIMITED',
          actionTaken: 'CLAMP_AND_LOG',
          serverSnapshot: expect.objectContaining({
            effective_duration_seconds: 15,
          }),
        }),
      ]),
    );
  });
});
