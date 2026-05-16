create index if not exists idx_config_versions_rollback_from
  on public.config_versions(rollback_from)
  where rollback_from is not null;

create index if not exists idx_landmarks_config_version
  on public.landmarks(config_version_id);

create index if not exists idx_player_trips_player_vehicle
  on public.player_trips(player_vehicle_id);

create index if not exists idx_player_trips_route_config_version
  on public.player_trips(route_config_version);

create index if not exists idx_player_trips_route
  on public.player_trips(route_id);

create index if not exists idx_player_unlocked_routes_route
  on public.player_unlocked_routes(route_id);

create index if not exists idx_player_vehicles_locked_trip
  on public.player_vehicles(locked_in_trip_id)
  where locked_in_trip_id is not null;

create index if not exists idx_player_vehicles_vehicle_def
  on public.player_vehicles(vehicle_def_id);

create index if not exists idx_players_current_vehicle
  on public.players(current_vehicle_id)
  where current_vehicle_id is not null;

create index if not exists idx_route_definitions_weather_profile
  on public.route_definitions(weather_profile_id);
