-- Travel Simulator V1 PostgreSQL schema reference.
-- Source: Travel_Simulator_V1_Final_Technical_Report_ZH_Clean.pdf
-- This is a reference schema for implementation planning. Production migrations
-- should split order, extensions, constraints, and backfills deliberately.

CREATE TABLE config_versions (
  config_version_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_number INT NOT NULL UNIQUE,
  status TEXT NOT NULL CHECK (status IN ('DRAFT','VALIDATED','LIVE','DEPRECATED','ROLLED_BACK')),
  checksum TEXT NOT NULL,
  notes TEXT,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_by TEXT,
  published_at TIMESTAMPTZ,
  deprecated_at TIMESTAMPTZ,
  rollback_from UUID REFERENCES config_versions(config_version_id),
  validation_report JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE players (
  player_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_provider TEXT NOT NULL,
  external_id TEXT NOT NULL,
  display_name TEXT,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  tutorial_state TEXT NOT NULL DEFAULT 'NOT_STARTED',
  current_vehicle_id UUID,
  risk_status TEXT NOT NULL DEFAULT 'NORMAL',
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(auth_provider, external_id)
);

CREATE INDEX idx_players_risk_status ON players(risk_status);
CREATE INDEX idx_players_last_seen_at ON players(last_seen_at);

CREATE TABLE wallet_balances (
  player_id UUID NOT NULL REFERENCES players(player_id),
  currency TEXT NOT NULL CHECK (currency IN (
    'ROAD_COINS',
    'TRAVEL_TOKENS',
    'SOUVENIR_STAMPS',
    'STAMP_FRAGMENTS',
    'BLUEPRINTS'
  )),
  balance BIGINT NOT NULL DEFAULT 0 CHECK (balance >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY(player_id, currency)
);

CREATE TABLE wallet_transactions (
  transaction_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES players(player_id),
  currency TEXT NOT NULL,
  amount BIGINT NOT NULL,
  balance_before BIGINT NOT NULL CHECK (balance_before >= 0),
  balance_after BIGINT NOT NULL CHECK (balance_after >= 0),
  reason TEXT NOT NULL,
  source_type TEXT NOT NULL,
  source_id TEXT,
  idempotency_key TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(player_id, idempotency_key)
);

CREATE INDEX idx_wallet_tx_player_created ON wallet_transactions(player_id, created_at DESC);
CREATE INDEX idx_wallet_tx_source ON wallet_transactions(source_type, source_id);

CREATE TABLE player_inventory (
  player_id UUID NOT NULL REFERENCES players(player_id),
  item_type TEXT NOT NULL,
  item_id TEXT NOT NULL,
  quantity BIGINT NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY(player_id, item_type, item_id)
);

CREATE INDEX idx_inventory_player_type ON player_inventory(player_id, item_type);

CREATE TABLE vehicle_definitions (
  vehicle_def_id UUID PRIMARY KEY,
  config_version_id UUID NOT NULL REFERENCES config_versions(config_version_id),
  vehicle_key TEXT NOT NULL,
  display_name TEXT NOT NULL,
  rarity TEXT NOT NULL CHECK (rarity IN ('Common','Rare','Epic','Legendary')),
  base_speed_kmph NUMERIC(8,2) NOT NULL,
  fuel_capacity NUMERIC(8,2) NOT NULL,
  fuel_consumption_per_km NUMERIC(8,4) NOT NULL,
  durability NUMERIC(8,2) NOT NULL DEFAULT 100,
  durability_loss_per_km NUMERIC(8,4) NOT NULL,
  cleanliness_loss_per_km NUMERIC(8,4) NOT NULL,
  offline_efficiency NUMERIC(5,3) NOT NULL CHECK (offline_efficiency BETWEEN 0 AND 1),
  weather_resistance NUMERIC(5,3) NOT NULL CHECK (weather_resistance BETWEEN 0 AND 1),
  default_skin_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE(config_version_id, vehicle_key)
);

CREATE TABLE player_vehicles (
  player_vehicle_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES players(player_id),
  vehicle_def_id UUID NOT NULL REFERENCES vehicle_definitions(vehicle_def_id),
  current_fuel NUMERIC(8,2) NOT NULL,
  current_durability NUMERIC(8,2) NOT NULL,
  current_cleanliness NUMERIC(8,2) NOT NULL DEFAULT 100,
  selected_skin_id TEXT,
  upgrade_level INT NOT NULL DEFAULT 1,
  total_distance_km NUMERIC(12,3) NOT NULL DEFAULT 0,
  is_selected BOOLEAN NOT NULL DEFAULT FALSE,
  locked_in_trip_id UUID,
  version INT NOT NULL DEFAULT 1,
  acquired_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_player_vehicles_player ON player_vehicles(player_id);
CREATE UNIQUE INDEX uq_selected_vehicle_per_player ON player_vehicles(player_id) WHERE is_selected = TRUE;

CREATE TABLE weather_profiles (
  weather_profile_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_version_id UUID NOT NULL REFERENCES config_versions(config_version_id),
  seed_salt TEXT NOT NULL,
  refresh_distance_km NUMERIC(8,2) NOT NULL DEFAULT 25 CHECK (refresh_distance_km > 0),
  weights JSONB NOT NULL,
  effects JSONB NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE route_definitions (
  route_id UUID PRIMARY KEY,
  config_version_id UUID NOT NULL REFERENCES config_versions(config_version_id),
  route_key TEXT NOT NULL,
  name TEXT NOT NULL,
  region TEXT NOT NULL,
  start_node TEXT NOT NULL,
  destination_node TEXT NOT NULL,
  route_type TEXT NOT NULL CHECK (route_type IN ('Tutorial','Short','Medium','Long','Epic')),
  total_distance_km NUMERIC(10,2) NOT NULL CHECK (total_distance_km > 0),
  difficulty INT NOT NULL CHECK (difficulty BETWEEN 1 AND 5),
  unlock_cost_stamps INT NOT NULL DEFAULT 0,
  trip_prep_fee_coins INT NOT NULL DEFAULT 0,
  reward_multiplier NUMERIC(6,3) NOT NULL DEFAULT 1.0,
  weather_profile_id UUID REFERENCES weather_profiles(weather_profile_id),
  day_night_profile JSONB NOT NULL DEFAULT '{}'::jsonb,
  background_pack_id TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_deprecated BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(config_version_id, route_key)
);

CREATE TABLE route_segments (
  segment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id UUID NOT NULL REFERENCES route_definitions(route_id) ON DELETE CASCADE,
  segment_index INT NOT NULL,
  start_km NUMERIC(10,2) NOT NULL,
  end_km NUMERIC(10,2) NOT NULL,
  terrain_type TEXT NOT NULL,
  biome TEXT,
  background_id TEXT,
  speed_multiplier NUMERIC(6,3) NOT NULL DEFAULT 1.0,
  fuel_multiplier NUMERIC(6,3) NOT NULL DEFAULT 1.0,
  cleanliness_multiplier NUMERIC(6,3) NOT NULL DEFAULT 1.0,
  durability_multiplier NUMERIC(6,3) NOT NULL DEFAULT 1.0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE(route_id, segment_index),
  CHECK(end_km > start_km)
);

CREATE INDEX idx_segments_route_range ON route_segments(route_id, start_km, end_km);

CREATE TABLE landmarks (
  landmark_id UUID PRIMARY KEY,
  route_id UUID NOT NULL REFERENCES route_definitions(route_id),
  config_version_id UUID NOT NULL REFERENCES config_versions(config_version_id),
  name TEXT NOT NULL,
  distance_km NUMERIC(10,2) NOT NULL CHECK (distance_km >= 0),
  rarity TEXT NOT NULL CHECK (rarity IN ('Common','Rare','Epic','Legendary')),
  required_stop BOOLEAN NOT NULL DEFAULT TRUE,
  base_photo_coins INT NOT NULL DEFAULT 80,
  photo_card_key TEXT NOT NULL,
  album_group_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX idx_landmarks_route_distance ON landmarks(route_id, distance_km);

CREATE TABLE player_unlocked_routes (
  player_id UUID NOT NULL REFERENCES players(player_id),
  route_id UUID NOT NULL REFERENCES route_definitions(route_id),
  unlocked_by TEXT NOT NULL,
  cost_stamps INT NOT NULL DEFAULT 0,
  unlocked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY(player_id, route_id)
);

CREATE TABLE player_trips (
  trip_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES players(player_id),
  route_id UUID NOT NULL REFERENCES route_definitions(route_id),
  route_config_version UUID NOT NULL REFERENCES config_versions(config_version_id),
  player_vehicle_id UUID NOT NULL REFERENCES player_vehicles(player_vehicle_id),
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','PAUSED','FORCED_STOP','COMPLETED','ABANDONED')),
  current_distance_km NUMERIC(12,3) NOT NULL DEFAULT 0,
  elapsed_real_seconds BIGINT NOT NULL DEFAULT 0,
  online_token_meter_km NUMERIC(12,3) NOT NULL DEFAULT 0,
  offline_token_meter_km NUMERIC(12,3) NOT NULL DEFAULT 0,
  last_simulated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  forced_stop_reason TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX idx_trips_player_status ON player_trips(player_id, status);

CREATE TABLE offline_reports (
  report_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES players(player_id),
  trip_id UUID NOT NULL REFERENCES player_trips(trip_id),
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  offline_seconds BIGINT NOT NULL,
  distance_travelled_km NUMERIC(12,3) NOT NULL,
  road_coins_pending INT NOT NULL DEFAULT 0,
  travel_tokens_pending INT NOT NULL DEFAULT 0,
  fuel_used NUMERIC(10,3) NOT NULL DEFAULT 0,
  cleanliness_loss NUMERIC(10,3) NOT NULL DEFAULT 0,
  durability_loss NUMERIC(10,3) NOT NULL DEFAULT 0,
  weather_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  landmark_reached JSONB,
  forced_stop_reason TEXT,
  claimed BOOLEAN NOT NULL DEFAULT FALSE,
  claimed_at TIMESTAMPTZ,
  claim_idempotency_key TEXT
);

CREATE INDEX idx_offline_reports_player_claimed ON offline_reports(player_id, claimed, generated_at DESC);
CREATE UNIQUE INDEX uq_offline_claim_key ON offline_reports(player_id, claim_idempotency_key) WHERE claim_idempotency_key IS NOT NULL;
CREATE UNIQUE INDEX uq_one_pending_report_per_trip ON offline_reports(player_id, trip_id) WHERE claimed = FALSE;

CREATE TABLE player_photos (
  photo_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES players(player_id),
  trip_id UUID NOT NULL REFERENCES player_trips(trip_id),
  landmark_id UUID NOT NULL REFERENCES landmarks(landmark_id),
  photo_card_key TEXT NOT NULL,
  quality_score INT NOT NULL CHECK (quality_score BETWEEN 0 AND 100),
  weather TEXT NOT NULL,
  day_phase TEXT NOT NULL,
  cleanliness_at_shot NUMERIC(5,2) NOT NULL,
  is_first_photo BOOLEAN NOT NULL,
  reward_tx_id UUID REFERENCES wallet_transactions(transaction_id),
  taken_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE UNIQUE INDEX uq_first_photo_per_landmark ON player_photos(player_id, landmark_id) WHERE is_first_photo = TRUE;

CREATE TABLE daily_login_state (
  player_id UUID NOT NULL REFERENCES players(player_id),
  period_key TEXT NOT NULL,
  cycle_day INT NOT NULL CHECK (cycle_day BETWEEN 1 AND 7),
  claimed BOOLEAN NOT NULL DEFAULT FALSE,
  reward_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  claimed_at TIMESTAMPTZ,
  idempotency_key TEXT,
  PRIMARY KEY(player_id, period_key)
);

CREATE UNIQUE INDEX uq_daily_login_idem ON daily_login_state(player_id, idempotency_key) WHERE idempotency_key IS NOT NULL;

CREATE TABLE quest_definitions (
  quest_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_version_id UUID NOT NULL REFERENCES config_versions(config_version_id),
  quest_key TEXT NOT NULL,
  quest_type TEXT NOT NULL CHECK (quest_type IN ('Daily','Weekly')),
  period_scope TEXT NOT NULL CHECK (period_scope IN ('DAY','WEEK')),
  event_name TEXT NOT NULL,
  target_value NUMERIC(12,3) NOT NULL,
  reward JSONB NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE(config_version_id, quest_key)
);

CREATE TABLE player_quest_progress (
  progress_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES players(player_id),
  quest_id UUID NOT NULL REFERENCES quest_definitions(quest_id),
  period_key TEXT NOT NULL,
  current_value NUMERIC(12,3) NOT NULL DEFAULT 0,
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  claimed BOOLEAN NOT NULL DEFAULT FALSE,
  claimed_at TIMESTAMPTZ,
  idempotency_key TEXT,
  UNIQUE(player_id, quest_id, period_key)
);

CREATE TABLE gacha_banners (
  banner_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_version_id UUID NOT NULL REFERENCES config_versions(config_version_id),
  banner_key TEXT NOT NULL,
  name TEXT NOT NULL,
  single_cost_tokens INT NOT NULL DEFAULT 20,
  ten_cost_tokens INT NOT NULL DEFAULT 180,
  rarity_rates JSONB NOT NULL,
  pity_rules JSONB NOT NULL,
  start_at TIMESTAMPTZ,
  end_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE(config_version_id, banner_key)
);

CREATE TABLE gacha_pool_items (
  pool_item_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  banner_id UUID NOT NULL REFERENCES gacha_banners(banner_id),
  item_type TEXT NOT NULL,
  item_id TEXT NOT NULL,
  rarity TEXT NOT NULL CHECK (rarity IN ('Common','Rare','Epic','Legendary')),
  weight INT NOT NULL CHECK (weight > 0),
  duplicate_blueprints INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE gacha_pity_state (
  player_id UUID NOT NULL REFERENCES players(player_id),
  banner_id UUID NOT NULL REFERENCES gacha_banners(banner_id),
  pulls_since_rare INT NOT NULL DEFAULT 0,
  pulls_since_epic INT NOT NULL DEFAULT 0,
  pulls_since_legendary INT NOT NULL DEFAULT 0,
  total_pulls INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY(player_id, banner_id)
);

CREATE TABLE gacha_history (
  gacha_history_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES players(player_id),
  banner_id UUID NOT NULL REFERENCES gacha_banners(banner_id),
  pull_group_id UUID NOT NULL,
  pull_index INT NOT NULL,
  item_type TEXT NOT NULL,
  item_id TEXT NOT NULL,
  rarity TEXT NOT NULL,
  is_pity_triggered BOOLEAN NOT NULL DEFAULT FALSE,
  duplicate_converted_to_blueprints INT NOT NULL DEFAULT 0,
  idempotency_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(player_id, idempotency_key, pull_index)
);

CREATE TABLE analytics_events (
  event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID REFERENCES players(player_id),
  event_name TEXT NOT NULL,
  event_time TIMESTAMPTZ NOT NULL DEFAULT now(),
  session_id TEXT,
  trip_id UUID,
  route_id UUID,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  server_version TEXT,
  config_version_id UUID
);

CREATE INDEX idx_analytics_event_time ON analytics_events(event_name, event_time DESC);

CREATE TABLE suspicious_events (
  suspicious_event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES players(player_id),
  risk_type TEXT NOT NULL,
  severity INT NOT NULL DEFAULT 1 CHECK (severity BETWEEN 1 AND 5),
  source_endpoint TEXT,
  trip_id UUID,
  request_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  server_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  action_taken TEXT NOT NULL DEFAULT 'LOG_ONLY',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE migration_log (
  migration_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_config_version_id UUID NOT NULL REFERENCES config_versions(config_version_id),
  to_config_version_id UUID NOT NULL REFERENCES config_versions(config_version_id),
  migration_type TEXT NOT NULL,
  affected_players INT NOT NULL DEFAULT 0,
  preview_report JSONB NOT NULL DEFAULT '{}'::jsonb,
  executed_by TEXT,
  executed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'PREVIEW',
  error_summary JSONB NOT NULL DEFAULT '{}'::jsonb
);

