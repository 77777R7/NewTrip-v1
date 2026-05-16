import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool, PoolClient, QueryResultRow } from 'pg';
import {
  AuthIdentity,
  CURRENCIES,
  Currency,
  GameDataStore,
  PlayerProfile,
  PlayerState,
  PlayerVehicle,
  WalletBalance,
  WalletMutationInput,
  WalletTransaction,
} from './game-data-store';

@Injectable()
export class PostgresGameDataStore implements GameDataStore, OnModuleDestroy {
  private readonly pool: Pool;

  constructor(configService: ConfigService) {
    const connectionString = configService.get<string>('DATABASE_URL');
    if (!connectionString) {
      throw new Error('DATABASE_URL is required for PostgresGameDataStore');
    }

    this.pool = new Pool({
      connectionString,
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }

  async getOrCreatePlayerState(identity: AuthIdentity): Promise<PlayerState> {
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      const profile = await this.getOrCreatePlayerProfileInTransaction(client, identity);
      await this.ensurePlayerDefaultsInTransaction(client, profile.playerId);
      const state = await this.loadPlayerStateInTransaction(client, profile.playerId);
      await client.query('commit');
      return state;
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
  }

  async getOrCreatePlayerProfile(identity: AuthIdentity): Promise<PlayerProfile> {
    const state = await this.getOrCreatePlayerState(identity);
    return state.profile;
  }

  async getWalletBalances(playerId: string): Promise<WalletBalance[]> {
    const result = await this.pool.query(
      `
        select currency, balance
        from public.wallet_balances
        where player_id = $1
        order by array_position($2::text[], currency)
      `,
      [playerId, CURRENCIES],
    );

    return result.rows.map((row) => this.toWalletBalance(row));
  }

  async grantWallet(input: WalletMutationInput): Promise<WalletTransaction> {
    if (input.amount <= 0) {
      throw new Error('Grant amount must be positive');
    }
    return this.mutateWallet(input, input.amount);
  }

  async spendWallet(input: WalletMutationInput): Promise<WalletTransaction> {
    if (input.amount <= 0) {
      throw new Error('Spend amount must be positive');
    }
    return this.mutateWallet(input, -input.amount);
  }

  private async mutateWallet(input: WalletMutationInput, signedAmount: number): Promise<WalletTransaction> {
    const client = await this.pool.connect();
    try {
      await client.query('begin');

      const existingTx = await client.query(
        `
          select *
          from public.wallet_transactions
          where player_id = $1 and idempotency_key = $2
        `,
        [input.playerId, input.idempotencyKey],
      );
      if (existingTx.rowCount) {
        await client.query('commit');
        return this.toWalletTransaction(existingTx.rows[0]);
      }

      await client.query(
        `
          insert into public.wallet_balances (player_id, currency, balance)
          values ($1, $2, 0)
          on conflict (player_id, currency) do nothing
        `,
        [input.playerId, input.currency],
      );

      const balanceResult = await client.query(
        `
          select balance
          from public.wallet_balances
          where player_id = $1 and currency = $2
          for update
        `,
        [input.playerId, input.currency],
      );
      const balanceBefore = Number(balanceResult.rows[0].balance);
      const balanceAfter = balanceBefore + signedAmount;

      if (balanceAfter < 0) {
        throw new Error('INSUFFICIENT_FUNDS');
      }

      await client.query(
        `
          update public.wallet_balances
          set balance = $3, updated_at = now()
          where player_id = $1 and currency = $2
        `,
        [input.playerId, input.currency, balanceAfter],
      );

      const transactionResult = await client.query(
        `
          insert into public.wallet_transactions (
            player_id,
            currency,
            amount,
            balance_before,
            balance_after,
            reason,
            source_type,
            source_id,
            idempotency_key,
            metadata
          )
          values ($1, $2, $3, $4, $5, $6, $7, $8, $9, '{}'::jsonb)
          returning *
        `,
        [
          input.playerId,
          input.currency,
          signedAmount,
          balanceBefore,
          balanceAfter,
          input.reason,
          input.sourceType,
          input.sourceId ?? null,
          input.idempotencyKey,
        ],
      );

      await client.query('commit');
      return this.toWalletTransaction(transactionResult.rows[0]);
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
  }

  private async getOrCreatePlayerProfileInTransaction(
    client: PoolClient,
    identity: AuthIdentity,
  ): Promise<PlayerProfile> {
    const existing = await client.query(
      `
        select *
        from public.players
        where auth_provider = $1 and external_id = $2
        for update
      `,
      [identity.authProvider, identity.externalId],
    );

    if (existing.rowCount) {
      return this.toPlayerProfile(existing.rows[0]);
    }

    const inserted = await client.query(
      `
        insert into public.players (auth_provider, external_id, display_name, timezone)
        values ($1, $2, $3, $4)
        returning *
      `,
      [identity.authProvider, identity.externalId, identity.displayName ?? null, identity.timezone ?? 'UTC'],
    );

    return this.toPlayerProfile(inserted.rows[0]);
  }

  private async ensurePlayerDefaultsInTransaction(client: PoolClient, playerId: string): Promise<void> {
    for (const currency of CURRENCIES) {
      await client.query(
        `
          insert into public.wallet_balances (player_id, currency, balance)
          values ($1, $2, 0)
          on conflict (player_id, currency) do nothing
        `,
        [playerId, currency],
      );
    }

    const vehicleCount = await client.query(
      `
        select count(*)::int as count
        from public.player_vehicles
        where player_id = $1
      `,
      [playerId],
    );

    if (Number(vehicleCount.rows[0].count) > 0) {
      return;
    }

    const defaultVehicleDef = await client.query(
      `
        select vd.*
        from public.vehicle_definitions vd
        join public.config_versions cv on cv.config_version_id = vd.config_version_id
        where cv.status = 'LIVE' and vd.vehicle_key = 'van_common_001'
        limit 1
      `,
    );

    if (!defaultVehicleDef.rowCount) {
      throw new Error('DEFAULT_VEHICLE_NOT_FOUND');
    }

    const vehicleDef = defaultVehicleDef.rows[0];
    const insertedVehicle = await client.query(
      `
        insert into public.player_vehicles (
          player_id,
          vehicle_def_id,
          current_fuel,
          current_durability,
          current_cleanliness,
          selected_skin_id,
          upgrade_level,
          is_selected
        )
        values ($1, $2, $3, 100, 100, $4, 1, true)
        returning *
      `,
      [playerId, vehicleDef.vehicle_def_id, vehicleDef.fuel_capacity, vehicleDef.default_skin_id],
    );

    await client.query(
      `
        update public.players
        set current_vehicle_id = $2, updated_at = now()
        where player_id = $1 and current_vehicle_id is null
      `,
      [playerId, insertedVehicle.rows[0].player_vehicle_id],
    );
  }

  private async loadPlayerStateInTransaction(client: PoolClient, playerId: string): Promise<PlayerState> {
    const profileResult = await client.query('select * from public.players where player_id = $1', [playerId]);
    const balancesResult = await client.query(
      `
        select currency, balance
        from public.wallet_balances
        where player_id = $1
        order by array_position($2::text[], currency)
      `,
      [playerId, CURRENCIES],
    );
    const vehiclesResult = await client.query(
      `
        select
          pv.*,
          vd.vehicle_key,
          vd.display_name
        from public.player_vehicles pv
        join public.vehicle_definitions vd on vd.vehicle_def_id = pv.vehicle_def_id
        where pv.player_id = $1
        order by pv.acquired_at asc
      `,
      [playerId],
    );

    return {
      profile: this.toPlayerProfile(profileResult.rows[0]),
      walletBalances: balancesResult.rows.map((row) => this.toWalletBalance(row)),
      vehicles: vehiclesResult.rows.map((row) => this.toPlayerVehicle(row)),
    };
  }

  private toPlayerProfile(row: QueryResultRow): PlayerProfile {
    return {
      playerId: row.player_id,
      authProvider: row.auth_provider,
      externalId: row.external_id,
      displayName: row.display_name,
      timezone: row.timezone,
      tutorialState: row.tutorial_state,
      currentVehicleId: row.current_vehicle_id,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };
  }

  private toWalletBalance(row: QueryResultRow): WalletBalance {
    return {
      currency: row.currency as Currency,
      balance: Number(row.balance),
    };
  }

  private toPlayerVehicle(row: QueryResultRow): PlayerVehicle {
    return {
      playerVehicleId: row.player_vehicle_id,
      vehicleDefId: row.vehicle_def_id,
      vehicleKey: row.vehicle_key,
      displayName: row.display_name,
      currentFuel: Number(row.current_fuel),
      currentDurability: Number(row.current_durability),
      currentCleanliness: Number(row.current_cleanliness),
      selectedSkinId: row.selected_skin_id,
      upgradeLevel: Number(row.upgrade_level),
      isSelected: Boolean(row.is_selected),
    };
  }

  private toWalletTransaction(row: QueryResultRow): WalletTransaction {
    return {
      transactionId: row.transaction_id,
      playerId: row.player_id,
      currency: row.currency as Currency,
      amount: Number(row.amount),
      balanceBefore: Number(row.balance_before),
      balanceAfter: Number(row.balance_after),
      reason: row.reason,
      sourceType: row.source_type,
      sourceId: row.source_id,
      idempotencyKey: row.idempotency_key,
      createdAt: row.created_at.toISOString(),
    };
  }
}
