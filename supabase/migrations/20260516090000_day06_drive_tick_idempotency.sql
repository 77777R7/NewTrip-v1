create table public.analytics_events (
  event_id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(player_id) on delete cascade,
  event_name text not null,
  source_type text,
  source_id text,
  event_payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

create index idx_analytics_events_player_time
  on public.analytics_events(player_id, occurred_at desc);

create index idx_analytics_events_name_time
  on public.analytics_events(event_name, occurred_at desc);

create table public.trip_drive_ticks (
  tick_id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(player_id) on delete cascade,
  trip_id uuid not null references public.player_trips(trip_id) on delete cascade,
  idempotency_key text not null,
  client_tick_seq integer not null default 0,
  mode text not null check (mode in ('HOLD_TO_DRIVE', 'AUTO_DRIVING', 'HOLD_TO_BOOST')),
  duration_seconds integer not null check (duration_seconds >= 0),
  distance_gain_km numeric(12,6) not null check (distance_gain_km >= 0),
  final_distance_km numeric(12,6) not null check (final_distance_km >= 0),
  forced_stop_reason text check (forced_stop_reason is null or forced_stop_reason in (
    'LOW_FUEL',
    'LANDMARK_REQUIRED',
    'ROUTE_END',
    'VEHICLE_BROKEN',
    'CONFIG_MISSING',
    'RISK_LIMITED'
  )),
  rewards jsonb not null default '{}'::jsonb,
  result_payload jsonb not null,
  created_at timestamptz not null default now(),
  unique (player_id, idempotency_key)
);

create index idx_trip_drive_ticks_trip_created
  on public.trip_drive_ticks(trip_id, created_at desc);

create index idx_trip_drive_ticks_player_created
  on public.trip_drive_ticks(player_id, created_at desc);

alter table public.analytics_events enable row level security;
alter table public.trip_drive_ticks enable row level security;
