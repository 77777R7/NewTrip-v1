# REST API Inventory

All responses follow:

```json
{
  "success": true,
  "data": {},
  "error": null,
  "server_time": "2026-05-15T00:00:00Z",
  "request_id": "req_..."
}
```

Client must not submit distance, rewards, offline duration, wallet deltas, random seed, or gacha results.

## Player

`GET /player/profile`

- Reads profile, tutorial state, risk status, selected vehicle summary.
- Errors: `401 UNAUTHORIZED`, `404 PLAYER_NOT_FOUND`.

`GET /player/state`

- Reads first-screen aggregate state: wallet, vehicle, current trip, pending offline report, quest summary.
- Critical rule: if an unclaimed pending offline report already exists, return it and do not generate another.

`POST /player/select-vehicle`

- Body: `player_vehicle_id`.
- Checks ownership and no active trip vehicle lock.
- Repeat selection succeeds.
- Errors: `INVALID_VEHICLE`, `VEHICLE_LOCKED_IN_TRIP`.

## Routes

`GET /routes/available`

- Query: `route_type`, `include_locked`.
- Tutorial incomplete players only see Tutorial route.

`GET /routes/:route_id`

- Reads route details, segments, landmarks, weather/day-night profile summary.

`POST /routes/unlock`

- Body: `route_id`, `idempotency_key`.
- Uses Souvenir Stamps for permanent route unlock.
- Errors: `ALREADY_UNLOCKED`, `INSUFFICIENT_STAMPS`.

`POST /routes/start`

- Body: `route_id`, `player_vehicle_id`, `idempotency_key`.
- Checks route unlocked, no active trip, vehicle available, fuel > 0, Road Coins enough.
- Captures live route config version into trip.
- Errors: `INSUFFICIENT_COINS`, `ACTIVE_TRIP_EXISTS`, `LOW_FUEL`.

`POST /routes/abandon`

- Body: `trip_id`, `reason`, `idempotency_key`.
- Does not refund Trip Prep Fee.

## Trip

`GET /trip/current`

- Returns current trip and pending report if present.

`POST /trip/drive-tick`

- Body: `trip_id`, `mode`, `client_tick_seq`, `idempotency_key`.
- Modes: `HOLD_TO_DRIVE`, `AUTO_DRIVING`, `HOLD_TO_BOOST`.
- Backend computes duration from server time, clamps max 15 seconds, calculates distance/rewards/consumption/forced stops.
- Errors: `INVALID_MODE`, `FORCED_STOP`, `TICK_RATE_LIMITED`.

`POST /trip/claim-offline-report`

- Body: `report_id`, `idempotency_key`.
- Locks report, requires `claimed=false`, writes wallet transactions, then sets `claimed=true`.
- Errors: `REPORT_NOT_FOUND`, `REPORT_ALREADY_CLAIMED`.

`POST /trip/complete-landmark`

- Body: `trip_id`, `landmark_id`, `action`, `idempotency_key`.
- Requires reached distance and landmark belongs to route.
- Creates/updates photo card.

`POST /trip/complete-route`

- Body: `trip_id`, `idempotency_key`.
- Requires route end reached and forced landmarks handled.
- Writes completion rewards.

## Wallet

`GET /wallet`

- Returns balances.

`GET /wallet/transactions`

- Query: `currency`, `cursor`, `limit`.
- Limit must be <= 100.

## Vehicle Maintenance

`POST /vehicle/refuel`

- Body: `player_vehicle_id`, `fuel_amount`, `idempotency_key`.
- Errors: `INSUFFICIENT_COINS`, `FUEL_OVER_CAPACITY`.

`POST /vehicle/clean`

- Body: `player_vehicle_id`, `clean_points`, `idempotency_key`.
- Errors: `INSUFFICIENT_COINS`, `ALREADY_CLEAN`.

`POST /vehicle/repair`

- Body: `player_vehicle_id`, `repair_points`, `idempotency_key`.
- Errors: `INSUFFICIENT_COINS`, `ALREADY_FULL_DURABILITY`.

## Gacha

`GET /gacha/banners`

- Returns active banners and public probability display.

`POST /gacha/pull`

- Body: `banner_id`, `pull_count`, `idempotency_key`.
- `pull_count` is 1 or 10 only.
- Backend spends Travel Tokens, rolls RNG, updates pity, writes history.
- Errors: `INSUFFICIENT_TOKENS`, `INVALID_PULL_COUNT`.

`GET /gacha/history`

- Query: `banner_id`, `cursor`.

## Inventory

`GET /inventory`

- Query: `item_type`.

`POST /inventory/use-item`

- Body: `item_type`, `item_id`, `quantity`, `idempotency_key`.
- Errors: `INSUFFICIENT_ITEM`, `ITEM_NOT_USABLE`.

## Daily / Quest

`GET /daily-login`

- Returns `period_key`, `claimed`, `cycle_day`.

`POST /daily-login/claim`

- Body: `idempotency_key`.
- Day 7 full Souvenir Stamp is limited to one per week.

`GET /quests/daily`

- Initializes/returns period task progress.

`POST /quests/claim`

- Body: `quest_id`, `period_key`, `idempotency_key`.
- Errors: `QUEST_NOT_COMPLETED`, `ALREADY_CLAIMED`.

## Admin Config

`GET /admin/configs`

- Admin only. Lists config versions.

`POST /admin/configs/draft`

- Body: `base_config_version`, `notes`.

`POST /admin/configs/validate`

- Validates schema, route continuity, economy, and gacha.

`POST /admin/configs/publish`

- Requires `VALIDATED`, publish lock, and a single live version.

`POST /admin/configs/rollback`

- Generates a new live version from a target old version, not direct row resurrection.

