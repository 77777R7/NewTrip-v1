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

describe('Debug demo helpers', () => {
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

  it('simulates offline time and returns a pending Travel Report without waiting in real time', async () => {
    const authId = 'day13-debug-offline';
    useServerTime('2026-05-20T00:00:00.000Z');
    const started = await startTutorialTrip(authId);

    const simulated = await request(app.getHttpServer())
      .post('/debug/simulate-offline')
      .set('x-newtrip-auth-id', authId)
      .send({ hours: 2 })
      .expect(201);

    expect(simulated.body.simulatedOfflineHours).toBe(2);
    expect(simulated.body.pendingOfflineReport).toEqual(
      expect.objectContaining({
        tripId: started.body.tripId,
        claimed: false,
        offlineSeconds: 7200,
        distanceTravelledKm: 40,
        forcedStopReason: 'LANDMARK_REQUIRED',
      }),
    );
  });

  it('primes a normal online drive tick so the debug client can advance immediately', async () => {
    const authId = 'day13-debug-prime-drive';
    useServerTime('2026-05-20T03:00:00.000Z');
    const started = await startTutorialTrip(authId);

    await request(app.getHttpServer())
      .post('/debug/prime-drive-tick')
      .set('x-newtrip-auth-id', authId)
      .send({ seconds: 15 })
      .expect(201);

    const tick = await request(app.getHttpServer())
      .post('/trip/drive-tick')
      .set('x-newtrip-auth-id', authId)
      .send({
        trip_id: started.body.tripId,
        mode: 'HOLD_TO_DRIVE',
        client_tick_seq: 1,
        idempotency_key: 'debug_prime_drive_tick',
      })
      .expect(201);

    expect(tick.body).toEqual(
      expect.objectContaining({
        durationSeconds: 15,
        distanceGainKm: 0.3,
      }),
    );
  });

  it('blocks drive tick priming in production mode', async () => {
    const previousNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    try {
      await request(app.getHttpServer())
        .post('/debug/prime-drive-tick')
        .set('x-newtrip-auth-id', 'day13-debug-prime-production')
        .send({ seconds: 15 })
        .expect(403);
    } finally {
      if (previousNodeEnv === undefined) {
        delete process.env.NODE_ENV;
      } else {
        process.env.NODE_ENV = previousNodeEnv;
      }
    }
  });

  it('blocks debug offline simulation in production mode', async () => {
    const previousNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    try {
      await request(app.getHttpServer())
        .post('/debug/simulate-offline')
        .set('x-newtrip-auth-id', 'day13-debug-production')
        .send({ hours: 2 })
        .expect(403);
    } finally {
      if (previousNodeEnv === undefined) {
        delete process.env.NODE_ENV;
      } else {
        process.env.NODE_ENV = previousNodeEnv;
      }
    }
  });
});
