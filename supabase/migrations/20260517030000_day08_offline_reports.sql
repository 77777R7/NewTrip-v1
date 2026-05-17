create table public.offline_reports (
  report_id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(player_id) on delete cascade,
  trip_id uuid not null references public.player_trips(trip_id) on delete cascade,
  generated_at timestamptz not null default now(),
  offline_seconds bigint not null check (offline_seconds >= 0),
  distance_travelled_km numeric(12,3) not null check (distance_travelled_km >= 0),
  road_coins_pending integer not null default 0 check (road_coins_pending >= 0),
  travel_tokens_pending integer not null default 0 check (travel_tokens_pending >= 0),
  fuel_used numeric(10,3) not null default 0 check (fuel_used >= 0),
  cleanliness_loss numeric(10,3) not null default 0 check (cleanliness_loss >= 0),
  durability_loss numeric(10,3) not null default 0 check (durability_loss >= 0),
  weather_summary jsonb not null default '{}'::jsonb,
  landmark_reached jsonb,
  forced_stop_reason text check (forced_stop_reason is null or forced_stop_reason in (
    'LOW_FUEL',
    'LANDMARK_REQUIRED',
    'ROUTE_END',
    'VEHICLE_BROKEN',
    'CONFIG_MISSING',
    'RISK_LIMITED'
  )),
  claimed boolean not null default false,
  claimed_at timestamptz,
  claim_idempotency_key text,
  metadata jsonb not null default '{}'::jsonb
);

create index idx_offline_reports_player_claimed
  on public.offline_reports(player_id, claimed, generated_at desc);

create index idx_offline_reports_trip
  on public.offline_reports(trip_id, generated_at desc);

create unique index uq_offline_claim_key
  on public.offline_reports(player_id, claim_idempotency_key)
  where claim_idempotency_key is not null;

create unique index uq_one_pending_report_per_trip
  on public.offline_reports(player_id, trip_id)
  where claimed = false;

alter table public.offline_reports enable row level security;
