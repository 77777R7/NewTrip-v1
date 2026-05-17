import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request = require('supertest');
import { AppModule } from '../src/app.module';

const TUTORIAL_ROUTE_KEY = 'tutorial_big_sur_hwy1_001';
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

function questByKey(quests: Array<{ questKey: string }>, questKey: string) {
  return quests.find((quest) => quest.questKey === questKey);
}

describe('Daily login and daily quests', () => {
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

  it('claims daily login once per day and grants the Day 7 weekly Stamp only once', async () => {
    const authId = 'day11-daily-login';
    useServerTime('2026-05-18T09:00:00.000Z');

    const preview = await request(app.getHttpServer())
      .get('/daily-login')
      .set('x-newtrip-auth-id', authId)
      .expect(200);
    expect(preview.body).toEqual(
      expect.objectContaining({
        periodKey: '2026-05-18',
        weekKey: '2026-W21',
        alreadyClaimed: false,
        dayIndex: 1,
      }),
    );

    const day1 = await request(app.getHttpServer())
      .post('/daily-login/claim')
      .set('x-newtrip-auth-id', authId)
      .send({ idempotency_key: 'daily_day_1' })
      .expect(201);
    expect(day1.body).toEqual(
      expect.objectContaining({
        periodKey: '2026-05-18',
        dayIndex: 1,
        alreadyClaimed: true,
      }),
    );
    expect(day1.body.walletTransactions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          currency: 'STAMP_FRAGMENTS',
          amount: 2,
          reason: 'DAILY_LOGIN_REWARD',
          sourceType: 'DAILY_LOGIN',
        }),
        expect.objectContaining({
          currency: 'ROAD_COINS',
          amount: 50,
          reason: 'DAILY_LOGIN_REWARD',
          sourceType: 'DAILY_LOGIN',
        }),
      ]),
    );

    const retryDay1 = await request(app.getHttpServer())
      .post('/daily-login/claim')
      .set('x-newtrip-auth-id', authId)
      .send({ idempotency_key: 'daily_day_1' })
      .expect(201);
    expect(balanceOf(retryDay1.body.walletBalances, 'STAMP_FRAGMENTS')).toBe(2);
    expect(balanceOf(retryDay1.body.walletBalances, 'ROAD_COINS')).toBe(50);

    await request(app.getHttpServer())
      .post('/daily-login/claim')
      .set('x-newtrip-auth-id', authId)
      .send({ idempotency_key: 'daily_day_1_duplicate' })
      .expect(409);

    for (let day = 2; day <= 7; day += 1) {
      setServerTime(`2026-05-${17 + day}T09:00:00.000Z`);
      await request(app.getHttpServer())
        .post('/daily-login/claim')
        .set('x-newtrip-auth-id', authId)
        .send({ idempotency_key: `daily_day_${day}` })
        .expect(201);
    }

    const finalState = await request(app.getHttpServer())
      .get('/player/state')
      .set('x-newtrip-auth-id', authId)
      .expect(200);
    expect(balanceOf(finalState.body.walletBalances, 'SOUVENIR_STAMPS')).toBe(1);

    await request(app.getHttpServer())
      .post('/daily-login/claim')
      .set('x-newtrip-auth-id', authId)
      .send({ idempotency_key: 'daily_day_7_duplicate' })
      .expect(409);

    const afterDuplicate = await request(app.getHttpServer())
      .get('/player/state')
      .set('x-newtrip-auth-id', authId)
      .expect(200);
    expect(balanceOf(afterDuplicate.body.walletBalances, 'SOUVENIR_STAMPS')).toBe(1);
  });

  it('updates daily quest progress from travel events and pays each quest reward once', async () => {
    const authId = 'day11-quest-events';
    useServerTime('2026-05-18T00:00:00.000Z');
    const started = await startTutorialTrip(authId);

    setServerTime('2026-05-18T00:00:15.000Z');
    const driveTick = await request(app.getHttpServer())
      .post('/trip/drive-tick')
      .set('x-newtrip-auth-id', authId)
      .send({
        trip_id: started.body.tripId,
        mode: 'HOLD_TO_DRIVE',
        client_tick_seq: 1,
        idempotency_key: 'day11_drive_tick',
      })
      .expect(201);
    expect(driveTick.body.distanceGainKm).toBeGreaterThan(0);

    let quests = await request(app.getHttpServer())
      .get('/quests/daily')
      .set('x-newtrip-auth-id', authId)
      .expect(200);
    expect(questByKey(quests.body.quests, 'drive_online_distance')).toEqual(
      expect.objectContaining({
        eventName: 'DRIVE_DISTANCE_ONLINE',
        completed: true,
        claimed: false,
      }),
    );

    const claimedDriveQuest = await request(app.getHttpServer())
      .post('/quests/claim')
      .set('x-newtrip-auth-id', authId)
      .send({
        quest_key: 'drive_online_distance',
        idempotency_key: 'claim_drive_quest',
      })
      .expect(201);
    expect(claimedDriveQuest.body.walletTransactions).toEqual([
      expect.objectContaining({
        currency: 'ROAD_COINS',
        amount: 40,
        reason: 'QUEST_REWARD',
        sourceType: 'DAILY_QUEST',
      }),
    ]);

    const retryDriveQuest = await request(app.getHttpServer())
      .post('/quests/claim')
      .set('x-newtrip-auth-id', authId)
      .send({
        quest_key: 'drive_online_distance',
        idempotency_key: 'claim_drive_quest',
      })
      .expect(201);
    expect(retryDriveQuest.body.walletTransactions).toHaveLength(1);

    await request(app.getHttpServer())
      .post('/vehicle/refuel')
      .set('x-newtrip-auth-id', authId)
      .send({ idempotency_key: 'day11_refuel' })
      .expect(201);

    setServerTime('2026-05-18T02:00:00.000Z');
    await claimPendingOfflineReport(authId, 'day11_claim_landmark_report');

    await request(app.getHttpServer())
      .post('/trip/complete-landmark')
      .set('x-newtrip-auth-id', authId)
      .send({
        trip_id: started.body.tripId,
        landmark_id: BIXBY_BRIDGE_LANDMARK_ID,
        action: 'TAKE_PHOTO',
        idempotency_key: 'day11_complete_bixby_bridge',
      })
      .expect(201);

    setServerTime('2026-05-18T10:00:00.000Z');
    await claimPendingOfflineReport(authId, 'day11_claim_route_end_report');

    await request(app.getHttpServer())
      .post('/trip/complete-route')
      .set('x-newtrip-auth-id', authId)
      .send({
        trip_id: started.body.tripId,
        idempotency_key: 'day11_complete_route',
      })
      .expect(201);

    quests = await request(app.getHttpServer())
      .get('/quests/daily')
      .set('x-newtrip-auth-id', authId)
      .expect(200);

    expect(questByKey(quests.body.quests, 'claim_offline_report')).toEqual(
      expect.objectContaining({ eventName: 'OFFLINE_REPORT_CLAIMED', completed: true }),
    );
    expect(questByKey(quests.body.quests, 'refuel_vehicle')).toEqual(
      expect.objectContaining({ eventName: 'VEHICLE_REFUELED', completed: true }),
    );
    expect(questByKey(quests.body.quests, 'take_photo')).toEqual(
      expect.objectContaining({ eventName: 'PHOTO_TAKEN', completed: true }),
    );
    expect(questByKey(quests.body.quests, 'complete_route')).toEqual(
      expect.objectContaining({ eventName: 'ROUTE_COMPLETED', completed: true }),
    );

    const claimedRouteQuest = await request(app.getHttpServer())
      .post('/quests/claim')
      .set('x-newtrip-auth-id', authId)
      .send({
        quest_key: 'complete_route',
        idempotency_key: 'claim_route_quest',
      })
      .expect(201);
    expect(claimedRouteQuest.body.walletTransactions).toEqual([
      expect.objectContaining({
        currency: 'STAMP_FRAGMENTS',
        amount: 2,
        reason: 'QUEST_REWARD',
        sourceType: 'DAILY_QUEST',
      }),
    ]);

    await request(app.getHttpServer())
      .post('/quests/claim')
      .set('x-newtrip-auth-id', authId)
      .send({
        quest_key: 'complete_route',
        idempotency_key: 'claim_route_quest_again',
      })
      .expect(409);
  });

  it('rejects claiming an incomplete daily quest', async () => {
    const authId = 'day11-incomplete-quest';
    useServerTime('2026-05-18T09:00:00.000Z');

    await request(app.getHttpServer())
      .post('/quests/claim')
      .set('x-newtrip-auth-id', authId)
      .send({
        quest_key: 'take_photo',
        idempotency_key: 'claim_incomplete_photo_quest',
      })
      .expect(409);
  });
});
