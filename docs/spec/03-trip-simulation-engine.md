# Trip Simulation Engine

The Trip Simulation Engine is the V1 technical foundation. It is not a client animation system. It is the backend-authoritative state transition engine for distance, fuel, cleanliness, durability, forced stops, rewards, route completion, and offline progress.

## Inputs

- `player_id` from auth.
- `trip_id` from client intent.
- `mode` from client intent: `HOLD_TO_DRIVE`, `AUTO_DRIVING`, `HOLD_TO_BOOST`.
- `idempotency_key` for retry safety.
- `player_trips` from DB.
- `player_vehicles` from DB.
- `route_definitions` and `route_segments` from config/DB.
- `weather_profiles` from config/DB.

## Outputs

- `distance_gain_km`.
- Updated trip distance and status.
- Vehicle state deltas: fuel, cleanliness, durability.
- Rewards or pending rewards.
- `forced_stop_reason`.
- Analytics and suspicious events.

## Online Distance Formula

```text
distance_gain =
  vehicle_speed_kmph
  * duration_seconds / 3600
  * mode_multiplier
  * condition_multiplier
  * segment_speed_multiplier

condition_multiplier =
  durability_speed_multiplier
  * weather_speed_multiplier
  * fuel_state_multiplier
```

Mode multipliers:

- Hold to Drive: 1.00.
- Auto Driving: 0.85.
- Hold to Boost: 1.10.

## Consumption Formulas

```text
fuel_used =
  distance_km
  * vehicle.fuel_consumption_per_km
  * weather_fuel_multiplier
  * terrain_fuel_multiplier
  * durability_fuel_penalty
  * mode_fuel_multiplier

cleanliness_loss =
  distance_km
  * vehicle.cleanliness_loss_per_km
  * weather_cleanliness_multiplier
  * terrain_cleanliness_multiplier

durability_loss =
  distance_km
  * vehicle.durability_loss_per_km
  * terrain_durability_multiplier
  * adjusted_weather_durability_multiplier

adjusted_weather_durability_multiplier =
  1 + (weather_durability_multiplier - 1) * (1 - vehicle.weather_resistance)
```

## Online Tick Rules

- Client submits intent every 5-10 seconds.
- Backend calculates duration from `server_now - trip.last_simulated_at`.
- `max_online_tick_seconds = 15`.
- Every minute can have at most 60 effective driving seconds.
- Repeated or concurrent tick uses lock plus idempotency.
- Distance is clamped by fuel, next required landmark, route end, and risk/config stops.

## Offline Progress Rules

```text
offline_seconds =
  min(
    server_now - max(player.last_seen_at, trip.last_simulated_at),
    max_offline_hours * 3600
  )
```

Defaults:

- `max_offline_hours = 8`.
- `base_offline_speed_kmph = 30`.
- `min_offline_report_seconds = 60`.

```text
offline_speed_kmph =
  min(base_offline_speed_kmph, vehicle.base_speed_kmph * vehicle.offline_efficiency)
  * durability_offline_multiplier
  * weather_speed_multiplier
  * segment_speed_multiplier
```

Offline distance is clamped by:

- Fuel-limited distance.
- Next required landmark.
- Route end.
- Forced stop.
- 8-hour offline cap.

## Forced Stop Reasons

- `LOW_FUEL`: fuel cannot support more progress.
- `LANDMARK_REQUIRED`: required landmark reached.
- `ROUTE_END`: route total distance reached.
- `VEHICLE_BROKEN`: hard durability threshold, if enabled.
- `CONFIG_MISSING`: missing route/weather/segment config.
- `RISK_LIMITED`: player risk state limits rewards or tick.

## Reward Rules

Online:

```text
online_road_coins =
  floor(online_distance_km * 10 * route_reward_multiplier * active_event_multiplier)
```

- Immediate wallet grant.
- Travel Token meter grants 1 token per 10 online km.

Offline:

```text
offline_road_coins =
  floor(offline_distance_km * 4 * route_reward_multiplier)
```

- Pending in `offline_reports`.
- Travel Token meter grants 1 token per 20 offline km, pending until report claim.

Wallet reasons must be explicit:

- `ONLINE_DRIVE_REWARD`
- `OFFLINE_REPORT_CLAIM`
- `ROUTE_COMPLETE_REWARD`
- `PHOTO_FIRST_REWARD`

## Critical Implementation Shape

Implement pure functions first:

- `calculate_distance_gain`
- `calculate_fuel_used`
- `calculate_cleanliness_loss`
- `calculate_durability_loss`
- `check_for_forced_stop`
- `grant_trip_rewards`

Then call them from transactional orchestrators:

- `simulate_online_tick`
- `simulate_offline_progress`

