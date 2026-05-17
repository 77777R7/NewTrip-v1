-- NewTrip V1 seed placeholder.
-- Day 2 will insert one LIVE config, one default vehicle, Tutorial/Short routes,
-- route segments, one weather profile, and the first required landmark.
insert into public.config_versions (
  config_version_id,
  version_number,
  status,
  checksum,
  notes,
  created_by,
  published_by,
  published_at,
  validation_report
) values (
  '00000000-0000-4000-8000-000000000001',
  1,
  'LIVE',
  'newtrip-v1-day02-seed',
  'Day 2 playable-spine seed config.',
  'seed.sql',
  'seed.sql',
  now(),
  '{"route_segments_checked": true, "tutorial_route_free": true}'::jsonb
) on conflict (version_number) do update set
  status = excluded.status,
  checksum = excluded.checksum,
  notes = excluded.notes,
  published_by = excluded.published_by,
  published_at = excluded.published_at,
  validation_report = excluded.validation_report;

insert into public.vehicle_definitions (
  vehicle_def_id,
  config_version_id,
  vehicle_key,
  display_name,
  rarity,
  base_speed_kmph,
  fuel_capacity,
  fuel_consumption_per_km,
  durability,
  durability_loss_per_km,
  cleanliness_loss_per_km,
  offline_efficiency,
  weather_resistance,
  default_skin_id,
  upgrade_curve_key,
  metadata
) values (
  '00000000-0000-4000-8000-000000000101',
  '00000000-0000-4000-8000-000000000001',
  'van_common_001',
  'Blue Travel Van',
  'Common',
  72,
  45,
  0.075,
  100,
  0.018,
  0.035,
  0.60,
  0.15,
  'skin_van_blue_default',
  'default_v1',
  '{"starting_vehicle": true}'::jsonb
) on conflict (config_version_id, vehicle_key) do update set
  display_name = excluded.display_name,
  rarity = excluded.rarity,
  base_speed_kmph = excluded.base_speed_kmph,
  fuel_capacity = excluded.fuel_capacity,
  fuel_consumption_per_km = excluded.fuel_consumption_per_km,
  durability = excluded.durability,
  durability_loss_per_km = excluded.durability_loss_per_km,
  cleanliness_loss_per_km = excluded.cleanliness_loss_per_km,
  offline_efficiency = excluded.offline_efficiency,
  weather_resistance = excluded.weather_resistance,
  default_skin_id = excluded.default_skin_id,
  upgrade_curve_key = excluded.upgrade_curve_key,
  metadata = excluded.metadata;

insert into public.weather_profiles (
  weather_profile_id,
  config_version_id,
  weather_profile_key,
  seed_salt,
  refresh_distance_km,
  weights,
  effects,
  is_active
) values (
  '00000000-0000-4000-8000-000000000201',
  '00000000-0000-4000-8000-000000000001',
  'coast_easy',
  'coast-easy-v1',
  25,
  '{"Sunny": 60, "Cloudy": 25, "Rain": 15}'::jsonb,
  '{
    "Sunny": {"speed_multiplier": 1.00, "photo_quality_delta": 4},
    "Cloudy": {"speed_multiplier": 0.98, "photo_quality_delta": 0},
    "Rain": {"speed_multiplier": 0.92, "photo_quality_delta": -6}
  }'::jsonb,
  true
) on conflict (config_version_id, weather_profile_key) do update set
  seed_salt = excluded.seed_salt,
  refresh_distance_km = excluded.refresh_distance_km,
  weights = excluded.weights,
  effects = excluded.effects,
  is_active = excluded.is_active;

insert into public.route_definitions (
  route_id,
  config_version_id,
  route_key,
  name,
  region,
  start_node,
  destination_node,
  route_type,
  total_distance_km,
  difficulty,
  unlock_cost_stamps,
  trip_prep_fee_coins,
  reward_multiplier,
  weather_profile_id,
  day_night_profile,
  background_pack_id,
  is_active
) values
  (
    '00000000-0000-4000-8000-000000000301',
    '00000000-0000-4000-8000-000000000001',
    'tutorial_big_sur_hwy1_001',
    'Big Sur Sunset Drive',
    'California Highway 1',
    'Carmel Highlands',
    'San Carpoforo Creek Approach',
    'Tutorial',
    100,
    1,
    0,
    0,
    1.0,
    '00000000-0000-4000-8000-000000000201',
    '{"profile_key": "default_day", "game_time_speed_multiplier": 10}'::jsonb,
    'bg_big_sur_sunset_v1',
    true
  ),
  (
    '00000000-0000-4000-8000-000000000302',
    '00000000-0000-4000-8000-000000000001',
    'short_coast_to_town_001',
    'Big Sur to Santa Cruz Drive',
    'California Central Coast',
    'Monterey Bay',
    'Santa Cruz Boardwalk',
    'Short',
    95,
    2,
    1,
    70,
    1.08,
    '00000000-0000-4000-8000-000000000201',
    '{"profile_key": "default_day", "game_time_speed_multiplier": 10}'::jsonb,
    'bg_santa_cruz_sunset_v1',
    true
  )
on conflict (route_id) do update set
  name = excluded.name,
  region = excluded.region,
  start_node = excluded.start_node,
  destination_node = excluded.destination_node,
  route_type = excluded.route_type,
  total_distance_km = excluded.total_distance_km,
  difficulty = excluded.difficulty,
  unlock_cost_stamps = excluded.unlock_cost_stamps,
  trip_prep_fee_coins = excluded.trip_prep_fee_coins,
  reward_multiplier = excluded.reward_multiplier,
  weather_profile_id = excluded.weather_profile_id,
  day_night_profile = excluded.day_night_profile,
  background_pack_id = excluded.background_pack_id,
  is_active = excluded.is_active;

insert into public.route_segments (
  route_id,
  segment_id,
  segment_index,
  start_km,
  end_km,
  terrain_type,
  biome,
  background_id,
  speed_multiplier,
  fuel_multiplier,
  cleanliness_multiplier,
  durability_multiplier
) values
  ('00000000-0000-4000-8000-000000000301', '00000000-0000-4000-8000-000000000401', 0, 0, 35, 'coastal_cliffs', 'coast', 'bg_big_sur_cliffs_sunset', 1.00, 1.00, 1.00, 1.00),
  ('00000000-0000-4000-8000-000000000301', '00000000-0000-4000-8000-000000000402', 1, 35, 70, 'bridge_coast', 'coast', 'bg_bixby_bridge_sunset', 0.92, 1.00, 1.08, 1.02),
  ('00000000-0000-4000-8000-000000000301', '00000000-0000-4000-8000-000000000403', 2, 70, 100, 'south_coast_highway', 'coast', 'bg_south_big_sur_sunset', 1.08, 0.95, 0.95, 0.95),
  ('00000000-0000-4000-8000-000000000302', '00000000-0000-4000-8000-000000000411', 0, 0, 30, 'monterey_bay_coast', 'coastal_town', 'bg_monterey_bay_sunset', 1.00, 1.00, 1.00, 1.00),
  ('00000000-0000-4000-8000-000000000302', '00000000-0000-4000-8000-000000000412', 1, 30, 65, 'coastal_town', 'coastal_town', 'bg_capitola_sunset', 0.96, 1.02, 1.04, 1.00),
  ('00000000-0000-4000-8000-000000000302', '00000000-0000-4000-8000-000000000413', 2, 65, 95, 'boardwalk_approach', 'city_coast', 'bg_santa_cruz_boardwalk_sunset', 1.04, 0.98, 0.98, 0.98)
on conflict (route_id, segment_index) do update set
  start_km = excluded.start_km,
  end_km = excluded.end_km,
  terrain_type = excluded.terrain_type,
  biome = excluded.biome,
  background_id = excluded.background_id,
  speed_multiplier = excluded.speed_multiplier,
  fuel_multiplier = excluded.fuel_multiplier,
  cleanliness_multiplier = excluded.cleanliness_multiplier,
  durability_multiplier = excluded.durability_multiplier;

insert into public.landmarks (
  landmark_id,
  route_id,
  config_version_id,
  landmark_key,
  name,
  distance_km,
  rarity,
  required_stop,
  base_photo_coins,
  photo_card_key,
  album_group_id,
  metadata
) values
  (
    '00000000-0000-4000-8000-000000000501',
    '00000000-0000-4000-8000-000000000301',
    '00000000-0000-4000-8000-000000000001',
    'bixby_bridge_lookout',
    'Bixby Bridge Lookout',
    40,
    'Common',
    true,
    80,
    'photo_bixby_bridge_v1',
    'tutorial_album_v1',
    '{"tutorial_first_photo": true, "real_route_reference": "Bixby Creek Bridge"}'::jsonb
  ),
  (
    '00000000-0000-4000-8000-000000000502',
    '00000000-0000-4000-8000-000000000302',
    '00000000-0000-4000-8000-000000000001',
    'santa_cruz_boardwalk',
    'Santa Cruz Boardwalk',
    82,
    'Common',
    true,
    90,
    'photo_santa_cruz_boardwalk_v1',
    'santa_cruz_album_v1',
    '{"destination_landmark": true}'::jsonb
  )
on conflict (landmark_id) do update set
  name = excluded.name,
  distance_km = excluded.distance_km,
  rarity = excluded.rarity,
  required_stop = excluded.required_stop,
  base_photo_coins = excluded.base_photo_coins,
  photo_card_key = excluded.photo_card_key,
  album_group_id = excluded.album_group_id,
  metadata = excluded.metadata;
