import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request = require('supertest');
import { AppModule } from '../src/app.module';

describe('Route and trip endpoints', () => {
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

  it('returns only the Tutorial Route for a tutorial-incomplete player', async () => {
    const response = await request(app.getHttpServer())
      .get('/routes/available')
      .set('x-newtrip-auth-id', 'day4-routes-available')
      .expect(200);

    expect(response.body).toHaveLength(1);
    expect(response.body[0]).toEqual(
      expect.objectContaining({
        routeKey: 'tutorial_coast_001',
        routeType: 'Tutorial',
        tripPrepFeeCoins: 0,
        unlockCostStamps: 0,
        isUnlocked: true,
      }),
    );
  });

  it('returns route detail with segments and landmarks', async () => {
    const response = await request(app.getHttpServer())
      .get('/routes/00000000-0000-4000-8000-000000000301')
      .set('x-newtrip-auth-id', 'day4-route-detail')
      .expect(200);

    expect(response.body.routeKey).toBe('tutorial_coast_001');
    expect(response.body.segments).toHaveLength(3);
    expect(response.body.landmarks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          landmarkKey: 'first_lighthouse',
          distanceKm: 40,
          requiredStop: true,
        }),
      ]),
    );
  });

  it('starts a Tutorial trip, exposes current trip, and prevents a second active trip', async () => {
    const authId = 'day4-start-trip';
    const state = await request(app.getHttpServer())
      .get('/player/state')
      .set('x-newtrip-auth-id', authId)
      .expect(200);

    const started = await request(app.getHttpServer())
      .post('/routes/start')
      .set('x-newtrip-auth-id', authId)
      .send({
        route_id: '00000000-0000-4000-8000-000000000301',
        player_vehicle_id: state.body.vehicles[0].playerVehicleId,
        idempotency_key: 'start_tutorial_once',
      })
      .expect(201);

    expect(started.body).toEqual(
      expect.objectContaining({
        routeId: '00000000-0000-4000-8000-000000000301',
        routeConfigVersion: '00000000-0000-4000-8000-000000000001',
        playerVehicleId: state.body.vehicles[0].playerVehicleId,
        status: 'ACTIVE',
        currentDistanceKm: 0,
      }),
    );

    const current = await request(app.getHttpServer())
      .get('/trip/current')
      .set('x-newtrip-auth-id', authId)
      .expect(200);

    expect(current.body.tripId).toBe(started.body.tripId);

    await request(app.getHttpServer())
      .post('/routes/start')
      .set('x-newtrip-auth-id', authId)
      .send({
        route_id: '00000000-0000-4000-8000-000000000301',
        player_vehicle_id: state.body.vehicles[0].playerVehicleId,
        idempotency_key: 'second_start_should_fail',
      })
      .expect(409);
  });

  it('returns the same trip when start is retried with the same idempotency key', async () => {
    const authId = 'day4-start-idempotent';

    const first = await request(app.getHttpServer())
      .post('/routes/start')
      .set('x-newtrip-auth-id', authId)
      .send({
        route_id: 'tutorial_coast_001',
        idempotency_key: 'same_start_key',
      })
      .expect(201);

    const retry = await request(app.getHttpServer())
      .post('/routes/start')
      .set('x-newtrip-auth-id', authId)
      .send({
        route_id: 'tutorial_coast_001',
        idempotency_key: 'same_start_key',
      })
      .expect(201);

    expect(retry.body.tripId).toBe(first.body.tripId);
  });

  it('abandons the active trip and clears current trip', async () => {
    const authId = 'day4-abandon-trip';
    await request(app.getHttpServer())
      .get('/player/state')
      .set('x-newtrip-auth-id', authId)
      .expect(200);

    const started = await request(app.getHttpServer())
      .post('/routes/start')
      .set('x-newtrip-auth-id', authId)
      .send({
        route_id: 'tutorial_coast_001',
        idempotency_key: 'start_before_abandon',
      })
      .expect(201);

    const abandoned = await request(app.getHttpServer())
      .post('/routes/abandon')
      .set('x-newtrip-auth-id', authId)
      .send({
        trip_id: started.body.tripId,
        idempotency_key: 'abandon_once',
      })
      .expect(201);

    expect(abandoned.body.status).toBe('ABANDONED');

    const retry = await request(app.getHttpServer())
      .post('/routes/abandon')
      .set('x-newtrip-auth-id', authId)
      .send({
        trip_id: started.body.tripId,
        idempotency_key: 'abandon_once',
      })
      .expect(201);

    expect(retry.body.tripId).toBe(started.body.tripId);
    expect(retry.body.status).toBe('ABANDONED');

    const current = await request(app.getHttpServer())
      .get('/trip/current')
      .set('x-newtrip-auth-id', authId)
      .expect(200);

    expect(current.body).toEqual({});
  });
});
