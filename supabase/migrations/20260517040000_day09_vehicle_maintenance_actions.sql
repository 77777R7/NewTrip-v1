create table public.vehicle_maintenance_actions (
  maintenance_id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(player_id) on delete cascade,
  player_vehicle_id uuid not null references public.player_vehicles(player_vehicle_id) on delete cascade,
  action text not null check (action in ('REFUEL', 'CLEAN', 'REPAIR')),
  idempotency_key text not null,
  cost_road_coins integer not null check (cost_road_coins > 0),
  restored_amount numeric(10,3) not null check (restored_amount > 0),
  wallet_transaction_id uuid not null references public.wallet_transactions(transaction_id),
  result_payload jsonb not null,
  created_at timestamptz not null default now(),
  unique (player_id, idempotency_key)
);

create index idx_vehicle_maintenance_player_created
  on public.vehicle_maintenance_actions(player_id, created_at desc);

create index idx_vehicle_maintenance_vehicle_created
  on public.vehicle_maintenance_actions(player_vehicle_id, created_at desc);

create index idx_vehicle_maintenance_wallet_tx
  on public.vehicle_maintenance_actions(wallet_transaction_id);

alter table public.vehicle_maintenance_actions enable row level security;
