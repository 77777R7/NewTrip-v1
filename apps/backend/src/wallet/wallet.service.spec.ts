import { Test } from '@nestjs/testing';
import { GAME_DATA_STORE } from '../database/game-data-store';
import { InMemoryGameDataStore } from '../database/in-memory-game-data-store';
import { WalletService } from './wallet.service';

describe('WalletService', () => {
  let store: InMemoryGameDataStore;
  let walletService: WalletService;
  let playerId: string;

  beforeEach(async () => {
    store = new InMemoryGameDataStore();
    const state = await store.getOrCreatePlayerState({
      authProvider: 'anonymous',
      externalId: 'wallet-test-player',
    });
    playerId = state.profile.playerId;

    const moduleRef = await Test.createTestingModule({
      providers: [
        WalletService,
        {
          provide: GAME_DATA_STORE,
          useValue: store,
        },
      ],
    }).compile();

    walletService = moduleRef.get(WalletService);
  });

  it('grants currency once for the same idempotency key', async () => {
    const firstGrant = await walletService.grant({
      playerId,
      currency: 'ROAD_COINS',
      amount: 500,
      reason: 'NEW_PLAYER_INITIAL_GRANT',
      sourceType: 'PLAYER_INIT',
      idempotencyKey: 'grant_once',
    });

    const retryGrant = await walletService.grant({
      playerId,
      currency: 'ROAD_COINS',
      amount: 500,
      reason: 'NEW_PLAYER_INITIAL_GRANT',
      sourceType: 'PLAYER_INIT',
      idempotencyKey: 'grant_once',
    });

    const balances = await walletService.getBalances(playerId);

    expect(firstGrant.transactionId).toBe(retryGrant.transactionId);
    expect(balances.find((balance) => balance.currency === 'ROAD_COINS')?.balance).toBe(500);
  });

  it('rejects spend when the player does not have enough balance', async () => {
    await expect(
      walletService.spend({
        playerId,
        currency: 'ROAD_COINS',
        amount: 1,
        reason: 'TEST_SPEND',
        sourceType: 'TEST',
        idempotencyKey: 'spend_without_balance',
      }),
    ).rejects.toThrow('INSUFFICIENT_FUNDS');
  });
});
