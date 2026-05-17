create table if not exists public.daily_login_claims (
  claim_id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(player_id) on delete cascade,
  period_key text not null,
  week_key text not null,
  day_index integer not null check (day_index between 1 and 7),
  idempotency_key text not null,
  rewards jsonb not null,
  result_payload jsonb not null,
  claimed_at timestamptz not null default now(),
  unique (player_id, period_key),
  unique (player_id, idempotency_key)
);

create index if not exists idx_daily_login_claims_player_week
  on public.daily_login_claims(player_id, week_key);

create table if not exists public.quest_definitions (
  quest_def_id uuid primary key default gen_random_uuid(),
  quest_key text not null unique,
  title text not null,
  event_name text not null check (event_name in (
    'DRIVE_DISTANCE_ONLINE',
    'OFFLINE_REPORT_CLAIMED',
    'VEHICLE_REFUELED',
    'PHOTO_TAKEN',
    'ROUTE_COMPLETED'
  )),
  target_value numeric(12,3) not null check (target_value > 0),
  reward_currency text not null check (reward_currency in (
    'ROAD_COINS',
    'TRAVEL_TOKENS',
    'SOUVENIR_STAMPS',
    'STAMP_FRAGMENTS',
    'BLUEPRINTS'
  )),
  reward_amount integer not null check (reward_amount > 0),
  period_type text not null default 'DAILY' check (period_type = 'DAILY'),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_quest_definitions_event_active
  on public.quest_definitions(event_name)
  where is_active = true;

create table if not exists public.player_quest_progress (
  progress_id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(player_id) on delete cascade,
  quest_def_id uuid not null references public.quest_definitions(quest_def_id) on delete cascade,
  period_key text not null,
  progress_value numeric(12,3) not null default 0 check (progress_value >= 0),
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (player_id, quest_def_id, period_key)
);

create index if not exists idx_player_quest_progress_quest
  on public.player_quest_progress(quest_def_id);

create index if not exists idx_player_quest_progress_player_period
  on public.player_quest_progress(player_id, period_key);

create table if not exists public.quest_claims (
  claim_id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(player_id) on delete cascade,
  quest_def_id uuid not null references public.quest_definitions(quest_def_id) on delete cascade,
  period_key text not null,
  idempotency_key text not null,
  reward_transaction_id uuid not null references public.wallet_transactions(transaction_id),
  result_payload jsonb not null,
  claimed_at timestamptz not null default now(),
  unique (player_id, idempotency_key),
  unique (player_id, quest_def_id, period_key)
);

create index if not exists idx_quest_claims_quest
  on public.quest_claims(quest_def_id);

create index if not exists idx_quest_claims_reward_tx
  on public.quest_claims(reward_transaction_id);

alter table public.daily_login_claims enable row level security;
alter table public.quest_definitions enable row level security;
alter table public.player_quest_progress enable row level security;
alter table public.quest_claims enable row level security;

insert into public.quest_definitions (
  quest_def_id,
  quest_key,
  title,
  event_name,
  target_value,
  reward_currency,
  reward_amount,
  sort_order,
  metadata
) values
  (
    '00000000-0000-4000-8000-000000000701',
    'drive_online_distance',
    'Drive online',
    'DRIVE_DISTANCE_ONLINE',
    0.25,
    'ROAD_COINS',
    40,
    1,
    '{"v1_day": 11}'::jsonb
  ),
  (
    '00000000-0000-4000-8000-000000000702',
    'claim_offline_report',
    'Claim a Travel Report',
    'OFFLINE_REPORT_CLAIMED',
    1,
    'TRAVEL_TOKENS',
    1,
    2,
    '{"v1_day": 11}'::jsonb
  ),
  (
    '00000000-0000-4000-8000-000000000703',
    'refuel_vehicle',
    'Refuel vehicle',
    'VEHICLE_REFUELED',
    1,
    'ROAD_COINS',
    30,
    3,
    '{"v1_day": 11}'::jsonb
  ),
  (
    '00000000-0000-4000-8000-000000000704',
    'take_photo',
    'Take a photo',
    'PHOTO_TAKEN',
    1,
    'ROAD_COINS',
    50,
    4,
    '{"v1_day": 11}'::jsonb
  ),
  (
    '00000000-0000-4000-8000-000000000705',
    'complete_route',
    'Complete a route',
    'ROUTE_COMPLETED',
    1,
    'STAMP_FRAGMENTS',
    2,
    5,
    '{"v1_day": 11}'::jsonb
  )
on conflict (quest_key) do update set
  title = excluded.title,
  event_name = excluded.event_name,
  target_value = excluded.target_value,
  reward_currency = excluded.reward_currency,
  reward_amount = excluded.reward_amount,
  sort_order = excluded.sort_order,
  is_active = true,
  metadata = excluded.metadata,
  updated_at = now();
