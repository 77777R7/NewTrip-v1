create table if not exists public.route_completion_actions (
  action_id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(player_id) on delete cascade,
  trip_id uuid not null references public.player_trips(trip_id) on delete cascade,
  idempotency_key text not null,
  road_coins_reward integer not null default 0 check (road_coins_reward >= 0),
  travel_tokens_reward integer not null default 0 check (travel_tokens_reward >= 0),
  souvenir_stamps_reward integer not null default 0 check (souvenir_stamps_reward >= 0),
  result_payload jsonb not null,
  created_at timestamptz not null default now(),
  unique (player_id, idempotency_key),
  unique (trip_id)
);

create table if not exists public.route_unlock_actions (
  action_id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(player_id) on delete cascade,
  route_id uuid not null references public.route_definitions(route_id) on delete cascade,
  idempotency_key text not null,
  cost_stamps integer not null default 0 check (cost_stamps >= 0),
  wallet_transaction_id uuid references public.wallet_transactions(transaction_id),
  result_payload jsonb not null,
  created_at timestamptz not null default now(),
  unique (player_id, idempotency_key)
);

create index if not exists idx_route_unlock_actions_route
  on public.route_unlock_actions(route_id);

create index if not exists idx_route_unlock_actions_wallet_tx
  on public.route_unlock_actions(wallet_transaction_id)
  where wallet_transaction_id is not null;

alter table public.route_completion_actions enable row level security;
alter table public.route_unlock_actions enable row level security;

update public.route_definitions
set route_key = 'tutorial_big_sur_hwy1_001',
    name = 'Big Sur Sunset Drive',
    region = 'California Highway 1',
    start_node = 'Carmel Highlands',
    destination_node = 'San Carpoforo Creek Approach',
    total_distance_km = 100,
    unlock_cost_stamps = 0,
    trip_prep_fee_coins = 0,
    reward_multiplier = 1.0,
    background_pack_id = 'bg_big_sur_sunset_v1'
where route_id = '00000000-0000-4000-8000-000000000301';

update public.route_definitions
set route_key = 'short_coast_to_town_001',
    name = 'Big Sur to Santa Cruz Drive',
    region = 'California Central Coast',
    start_node = 'Monterey Bay',
    destination_node = 'Santa Cruz Boardwalk',
    total_distance_km = 95,
    unlock_cost_stamps = 1,
    trip_prep_fee_coins = 70,
    reward_multiplier = 1.08,
    background_pack_id = 'bg_santa_cruz_sunset_v1'
where route_id = '00000000-0000-4000-8000-000000000302';

update public.route_segments
set end_km = 35,
    terrain_type = 'coastal_cliffs',
    biome = 'coast',
    background_id = 'bg_big_sur_cliffs_sunset',
    speed_multiplier = 1.00,
    fuel_multiplier = 1.00,
    cleanliness_multiplier = 1.00,
    durability_multiplier = 1.00
where segment_id = '00000000-0000-4000-8000-000000000401';

update public.route_segments
set start_km = 35,
    end_km = 70,
    terrain_type = 'bridge_coast',
    biome = 'coast',
    background_id = 'bg_bixby_bridge_sunset',
    speed_multiplier = 0.92,
    fuel_multiplier = 1.00,
    cleanliness_multiplier = 1.08,
    durability_multiplier = 1.02
where segment_id = '00000000-0000-4000-8000-000000000402';

update public.route_segments
set start_km = 70,
    end_km = 100,
    terrain_type = 'south_coast_highway',
    biome = 'coast',
    background_id = 'bg_south_big_sur_sunset',
    speed_multiplier = 1.08,
    fuel_multiplier = 0.95,
    cleanliness_multiplier = 0.95,
    durability_multiplier = 0.95
where segment_id = '00000000-0000-4000-8000-000000000403';

update public.route_segments
set start_km = 0,
    end_km = 30,
    terrain_type = 'monterey_bay_coast',
    biome = 'coastal_town',
    background_id = 'bg_monterey_bay_sunset',
    speed_multiplier = 1.00,
    fuel_multiplier = 1.00,
    cleanliness_multiplier = 1.00,
    durability_multiplier = 1.00
where segment_id = '00000000-0000-4000-8000-000000000411';

update public.route_segments
set start_km = 30,
    end_km = 65,
    terrain_type = 'coastal_town',
    biome = 'coastal_town',
    background_id = 'bg_capitola_sunset',
    speed_multiplier = 0.96,
    fuel_multiplier = 1.02,
    cleanliness_multiplier = 1.04,
    durability_multiplier = 1.00
where segment_id = '00000000-0000-4000-8000-000000000412';

update public.route_segments
set start_km = 65,
    end_km = 95,
    terrain_type = 'boardwalk_approach',
    biome = 'city_coast',
    background_id = 'bg_santa_cruz_boardwalk_sunset',
    speed_multiplier = 1.04,
    fuel_multiplier = 0.98,
    cleanliness_multiplier = 0.98,
    durability_multiplier = 0.98
where segment_id = '00000000-0000-4000-8000-000000000413';

update public.landmarks
set landmark_key = 'bixby_bridge_lookout',
    name = 'Bixby Bridge Lookout',
    distance_km = 40,
    required_stop = true,
    base_photo_coins = 80,
    photo_card_key = 'photo_bixby_bridge_v1',
    album_group_id = 'tutorial_album_v1',
    metadata = '{"tutorial_first_photo": true, "real_route_reference": "Bixby Creek Bridge"}'::jsonb
where landmark_id = '00000000-0000-4000-8000-000000000501';

update public.landmarks
set landmark_key = 'santa_cruz_boardwalk',
    name = 'Santa Cruz Boardwalk',
    distance_km = 82,
    required_stop = true,
    base_photo_coins = 90,
    photo_card_key = 'photo_santa_cruz_boardwalk_v1',
    album_group_id = 'santa_cruz_album_v1',
    metadata = '{"destination_landmark": true}'::jsonb
where landmark_id = '00000000-0000-4000-8000-000000000502';
