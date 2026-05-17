create table if not exists public.suspicious_events (
  suspicious_event_id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(player_id) on delete cascade,
  risk_type text not null check (risk_type in (
    'INVALID_MODE',
    'TICK_RATE_LIMITED',
    'REWARD_DUPLICATE_ATTEMPT',
    'SPEED_LIMIT_EXCEEDED'
  )),
  severity integer not null default 1 check (severity between 1 and 5),
  source_endpoint text,
  trip_id uuid references public.player_trips(trip_id) on delete set null,
  request_payload jsonb not null default '{}'::jsonb,
  server_snapshot jsonb not null default '{}'::jsonb,
  action_taken text not null default 'LOG_ONLY',
  created_at timestamptz not null default now()
);

create index if not exists idx_suspicious_events_player_risk_time
  on public.suspicious_events(player_id, risk_type, created_at desc);

create index if not exists idx_suspicious_events_trip_time
  on public.suspicious_events(trip_id, created_at desc)
  where trip_id is not null;

create index if not exists idx_suspicious_events_risk_time
  on public.suspicious_events(risk_type, created_at desc);

alter table public.suspicious_events enable row level security;
