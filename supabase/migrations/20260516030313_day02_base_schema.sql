create extension if not exists "pgcrypto";

create table public.config_versions (
  config_version_id uuid primary key default gen_random_uuid(),
  version_number integer not null unique,
  status text not null check (status in ('DRAFT', 'VALIDATED', 'LIVE', 'DEPRECATED', 'ROLLED_BACK')),
  checksum text not null,
  notes text,
  created_by text not null,
  created_at timestamptz not null default now(),
  published_by text,
  published_at timestamptz,
  deprecated_at timestamptz,
  rollback_from uuid references public.config_versions(config_version_id),
  validation_report jsonb not null default '{}'::jsonb
);

create unique index uq_one_live_config_version
  on public.config_versions(status)
  where status = 'LIVE';

create table public.players (
  player_id uuid primary key default gen_random_uuid(),
  auth_provider text not null,
  external_id text not null,
  display_name text,
  timezone text not null default 'UTC',
  tutorial_state text not null default 'NOT_STARTED' check (tutorial_state in (
    'NOT_STARTED',
    'ROUTE_SELECTED',
    'HOLD_TO_DRIVE_REQUIRED',
    'AUTO_DRIVING_UNLOCKED',
    'FIRST_LANDMARK_REACHED',
    'PHOTO_TAKEN',
    'ROUTE_COMPLETED',
    'FULL_SYSTEM_UNLOCKED'
  )),
  current_vehicle_id uuid,
  risk_status text not null default 'NORMAL' check (risk_status in ('NORMAL', 'WATCH', 'RESTRICTED', 'BANNED')),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (auth_provider, external_id)
);

create index idx_players_risk_status on public.players(risk_status);
create index idx_players_last_seen_at on public.players(last_seen_at);

create table public.wallet_balances (
  player_id uuid not null references public.players(player_id) on delete cascade,
  currency text not null check (currency in (
    'ROAD_COINS',
    'TRAVEL_TOKENS',
    'SOUVENIR_STAMPS',
    'STAMP_FRAGMENTS',
    'BLUEPRINTS'
  )),
  balance bigint not null default 0 check (balance >= 0),
  updated_at timestamptz not null default now(),
  primary key (player_id, currency)
);

create table public.wallet_transactions (
  transaction_id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(player_id) on delete cascade,
  currency text not null check (currency in (
    'ROAD_COINS',
    'TRAVEL_TOKENS',
    'SOUVENIR_STAMPS',
    'STAMP_FRAGMENTS',
    'BLUEPRINTS'
  )),
  amount bigint not null,
  balance_before bigint not null check (balance_before >= 0),
  balance_after bigint not null check (balance_after >= 0),
  reason text not null,
  source_type text not null,
  source_id text,
  idempotency_key text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (player_id, idempotency_key),
  check (balance_after = balance_before + amount)
);

create index idx_wallet_tx_player_created on public.wallet_transactions(player_id, created_at desc);
create index idx_wallet_tx_source on public.wallet_transactions(source_type, source_id);

create table public.vehicle_definitions (
  vehicle_def_id uuid primary key default gen_random_uuid(),
  config_version_id uuid not null references public.config_versions(config_version_id),
  vehicle_key text not null,
  display_name text not null,
  rarity text not null check (rarity in ('Common', 'Rare', 'Epic', 'Legendary')),
  base_speed_kmph numeric(8,2) not null check (base_speed_kmph > 0),
  fuel_capacity numeric(8,2) not null check (fuel_capacity > 0),
  fuel_consumption_per_km numeric(8,4) not null check (fuel_consumption_per_km > 0),
  durability numeric(8,2) not null default 100 check (durability between 0 and 100),
  durability_loss_per_km numeric(8,4) not null check (durability_loss_per_km >= 0),
  cleanliness_loss_per_km numeric(8,4) not null check (cleanliness_loss_per_km >= 0),
  offline_efficiency numeric(5,3) not null check (offline_efficiency between 0 and 1),
  weather_resistance numeric(5,3) not null check (weather_resistance between 0 and 1),
  default_skin_id text,
  upgrade_curve_key text,
  metadata jsonb not null default '{}'::jsonb,
  unique (config_version_id, vehicle_key)
);

create table public.player_vehicles (
  player_vehicle_id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(player_id) on delete cascade,
  vehicle_def_id uuid not null references public.vehicle_definitions(vehicle_def_id),
  current_fuel numeric(8,2) not null check (current_fuel >= 0),
  current_durability numeric(8,2) not null default 100 check (current_durability between 0 and 100),
  current_cleanliness numeric(8,2) not null default 100 check (current_cleanliness between 0 and 100),
  selected_skin_id text,
  upgrade_level integer not null default 1 check (upgrade_level >= 1),
  total_distance_km numeric(12,3) not null default 0 check (total_distance_km >= 0),
  is_selected boolean not null default false,
  locked_in_trip_id uuid,
  version integer not null default 1 check (version >= 1),
  acquired_at timestamptz not null default now()
);

create index idx_player_vehicles_player on public.player_vehicles(player_id);
create unique index uq_selected_vehicle_per_player
  on public.player_vehicles(player_id)
  where is_selected = true;

alter table public.players
  add constraint fk_players_current_vehicle
  foreign key (current_vehicle_id)
  references public.player_vehicles(player_vehicle_id);

create table public.weather_profiles (
  weather_profile_id uuid primary key default gen_random_uuid(),
  config_version_id uuid not null references public.config_versions(config_version_id),
  weather_profile_key text not null,
  seed_salt text not null,
  refresh_distance_km numeric(8,2) not null default 25 check (refresh_distance_km > 0),
  weights jsonb not null,
  effects jsonb not null,
  is_active boolean not null default true,
  unique (config_version_id, weather_profile_key)
);

create table public.route_definitions (
  route_id uuid primary key default gen_random_uuid(),
  config_version_id uuid not null references public.config_versions(config_version_id),
  route_key text not null,
  name text not null,
  region text not null,
  start_node text not null,
  destination_node text not null,
  route_type text not null check (route_type in ('Tutorial', 'Short', 'Medium', 'Long', 'Epic')),
  total_distance_km numeric(10,2) not null check (total_distance_km > 0),
  difficulty integer not null check (difficulty between 1 and 5),
  unlock_cost_stamps integer not null default 0 check (unlock_cost_stamps >= 0),
  trip_prep_fee_coins integer not null default 0 check (trip_prep_fee_coins >= 0),
  reward_multiplier numeric(6,3) not null default 1.0 check (reward_multiplier > 0),
  weather_profile_id uuid not null references public.weather_profiles(weather_profile_id),
  day_night_profile jsonb not null default '{}'::jsonb,
  background_pack_id text not null,
  is_active boolean not null default true,
  is_deprecated boolean not null default false,
  created_at timestamptz not null default now(),
  unique (config_version_id, route_key)
);

create index idx_routes_config_type on public.route_definitions(config_version_id, route_type);

create table public.route_segments (
  segment_id uuid primary key default gen_random_uuid(),
  route_id uuid not null references public.route_definitions(route_id) on delete cascade,
  segment_index integer not null,
  start_km numeric(10,2) not null check (start_km >= 0),
  end_km numeric(10,2) not null,
  terrain_type text not null,
  biome text,
  background_id text,
  speed_multiplier numeric(6,3) not null default 1.0 check (speed_multiplier > 0),
  fuel_multiplier numeric(6,3) not null default 1.0 check (fuel_multiplier > 0),
  cleanliness_multiplier numeric(6,3) not null default 1.0 check (cleanliness_multiplier > 0),
  durability_multiplier numeric(6,3) not null default 1.0 check (durability_multiplier > 0),
  metadata jsonb not null default '{}'::jsonb,
  unique (route_id, segment_index),
  check (end_km > start_km)
);

create index idx_segments_route_range on public.route_segments(route_id, start_km, end_km);

create table public.landmarks (
  landmark_id uuid primary key default gen_random_uuid(),
  route_id uuid not null references public.route_definitions(route_id) on delete cascade,
  config_version_id uuid not null references public.config_versions(config_version_id),
  landmark_key text not null,
  name text not null,
  distance_km numeric(10,2) not null check (distance_km >= 0),
  rarity text not null check (rarity in ('Common', 'Rare', 'Epic', 'Legendary')),
  required_stop boolean not null default true,
  base_photo_coins integer not null default 80 check (base_photo_coins >= 0),
  photo_card_key text not null,
  album_group_id text,
  metadata jsonb not null default '{}'::jsonb,
  unique (route_id, landmark_key)
);

create index idx_landmarks_route_distance on public.landmarks(route_id, distance_km);

create table public.player_unlocked_routes (
  player_id uuid not null references public.players(player_id) on delete cascade,
  route_id uuid not null references public.route_definitions(route_id),
  unlocked_by text not null,
  cost_stamps integer not null default 0 check (cost_stamps >= 0),
  unlocked_at timestamptz not null default now(),
  primary key (player_id, route_id)
);

create table public.player_trips (
  trip_id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(player_id) on delete cascade,
  route_id uuid not null references public.route_definitions(route_id),
  route_config_version uuid not null references public.config_versions(config_version_id),
  player_vehicle_id uuid not null references public.player_vehicles(player_vehicle_id),
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'PAUSED', 'FORCED_STOP', 'COMPLETED', 'ABANDONED')),
  current_distance_km numeric(12,3) not null default 0 check (current_distance_km >= 0),
  elapsed_real_seconds bigint not null default 0 check (elapsed_real_seconds >= 0),
  online_token_meter_km numeric(12,3) not null default 0 check (online_token_meter_km >= 0),
  offline_token_meter_km numeric(12,3) not null default 0 check (offline_token_meter_km >= 0),
  last_simulated_at timestamptz not null default now(),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  forced_stop_reason text check (forced_stop_reason is null or forced_stop_reason in (
    'LOW_FUEL',
    'LANDMARK_REQUIRED',
    'ROUTE_END',
    'VEHICLE_BROKEN',
    'CONFIG_MISSING',
    'RISK_LIMITED'
  )),
  metadata jsonb not null default '{}'::jsonb
);

create index idx_trips_player_status on public.player_trips(player_id, status);
create unique index uq_one_running_trip_per_player
  on public.player_trips(player_id)
  where status in ('ACTIVE', 'PAUSED', 'FORCED_STOP');

alter table public.player_vehicles
  add constraint fk_player_vehicles_locked_trip
  foreign key (locked_in_trip_id)
  references public.player_trips(trip_id);

alter table public.config_versions enable row level security;
alter table public.players enable row level security;
alter table public.wallet_balances enable row level security;
alter table public.wallet_transactions enable row level security;
alter table public.vehicle_definitions enable row level security;
alter table public.player_vehicles enable row level security;
alter table public.weather_profiles enable row level security;
alter table public.route_definitions enable row level security;
alter table public.route_segments enable row level security;
alter table public.landmarks enable row level security;
alter table public.player_unlocked_routes enable row level security;
alter table public.player_trips enable row level security;
