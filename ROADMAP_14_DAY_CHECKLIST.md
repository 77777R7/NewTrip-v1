# NewTrip V1 14-Day Playable Spine Checklist

Goal: build a runnable, testable, demoable V1 playable spine in 14 days. This is not the full production game. The demo target is:

```text
create player -> initialize wallet/default vehicle -> see Tutorial Route -> start trip
-> online drive tick -> forced stop at landmark -> take first photo
-> simulate offline -> see Travel Report -> claim rewards
-> refuel/clean/repair -> complete route -> receive Stamps
-> unlock next Short Route
```

The stack assumption for this plan is:

```text
Game Client: Unity + C#
Backend: Node.js + NestJS + TypeScript
Database: Supabase PostgreSQL
Auth: Supabase Auth or temporary anonymous auth
Cache: Redis can wait until after Day 10; use DB idempotency first
Admin: SQL seed/config files first; Retool or full Admin UI later
Analytics: write analytics_events table first; Firebase/PostHog later
```

AI update rule: after every work session, update the relevant day checkboxes and append one line to the progress log. Do not mark a task complete unless it has a runnable check, test, or reviewed artifact.

Status legend:

- `[ ]` not started
- `[~]` in progress
- `[x]` complete
- `[!]` blocked or needs human decision

## Day 1: Project Skeleton And Dev Environment

Goal: turn the repo from a documentation handoff into a runnable project repo.

Backend:

- [ ] Create NestJS backend under `apps/backend/`.
- [ ] Add `apps/backend/src/main.ts`.
- [ ] Add `apps/backend/src/app.module.ts`.
- [ ] Add `apps/backend/src/health/`.
- [ ] Add `apps/backend/src/config/`.
- [ ] Add `apps/backend/src/database/`.
- [ ] Add `npm run dev`.
- [ ] Add `npm run test`.
- [ ] Add `npm run build`.
- [ ] Add `GET /health` returning OK.

Environment:

- [ ] Add `.env.example` with `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`, `REDIS_URL`, `NODE_ENV`, and `PORT`.

Database/config:

- [ ] Create `supabase/migrations/`.
- [ ] Create `supabase/seed.sql`.
- [x] Keep `config/default_parameters.v1.yaml` readable and multi-line.
- [ ] Add `config/tutorial_route.v1.yaml`.
- [ ] Add `config/default_vehicle.v1.yaml`.

Docs/ADRs:

- [x] Keep source PDF and extracted text under `docs/source/`.
- [x] Keep agent rules and project context under `AGENTS.md` and `CONTEXT.md`.
- [x] Add ADR for the tech stack.
- [x] Add ADR for no runtime real-map API in V1.

Acceptance:

- [ ] Fresh clone can run `npm install`.
- [ ] `npm run dev` starts the backend.
- [ ] `GET /health` returns OK.
- [ ] `.env.example` exists.
- [ ] Supabase migration directory exists.
- [ ] Default YAML config files are readable.

Do not do:

- [ ] No Gacha.
- [ ] No Unity art.
- [ ] No real map.
- [ ] No complex Admin Panel.

## Day 2: Database Base Tables And Seed Data

Goal: create the minimum database structure so the backend can create players, vehicles, routes, trips, and wallets.

Migrations:

- [ ] `config_versions`.
- [ ] `players`.
- [ ] `wallet_balances`.
- [ ] `wallet_transactions`.
- [ ] `vehicle_definitions`.
- [ ] `player_vehicles`.
- [ ] `weather_profiles`.
- [ ] `route_definitions`.
- [ ] `route_segments`.
- [ ] `landmarks`.
- [ ] `player_unlocked_routes`.
- [ ] `player_trips`.

Do not build yet:

- [ ] No gacha tables.
- [ ] No daily quest tables.
- [ ] No advanced admin tables.
- [ ] No `migration_log`.

Seed data:

- [ ] One LIVE `config_version`.
- [ ] One default vehicle.
- [ ] One Tutorial Route.
- [ ] One Short Route.
- [ ] One weather profile.
- [ ] Three Tutorial Route segments covering 0-100 km.
- [ ] One required landmark at 40 km.

Tutorial Route defaults:

- [ ] `route_type = Tutorial`.
- [ ] `total_distance_km = 100`.
- [ ] `trip_prep_fee = 0`.
- [ ] `unlock_cost_stamps = 0`.
- [ ] First landmark at 40 km.

Default vehicle:

- [ ] `base_speed_kmph = 72`.
- [ ] `fuel_capacity = 45`.
- [ ] `fuel_consumption_per_km = 0.075`.
- [ ] `cleanliness_loss_per_km = 0.035`.
- [ ] `durability_loss_per_km = 0.018`.
- [ ] `offline_efficiency = 0.60`.

Acceptance:

- [ ] Supabase migration runs.
- [ ] `seed.sql` inserts default config.
- [ ] Route segments continuously cover 0-100 km.
- [ ] Landmark distance is in route range.
- [ ] Tutorial Route is free.
- [ ] Short Route costs 1-2 Stamps.
- [ ] `npm run db:smoke` verifies LIVE config, default vehicle, Tutorial Route, and first landmark.

## Day 3: Player, Auth, And Wallet Initialization

Goal: a new player request creates save data, wallet balances, and default vehicle.

Player service:

- [ ] Implement `GET /player/profile`.
- [ ] Implement `GET /player/state`.
- [ ] Create player if missing.
- [ ] Create default `wallet_balances`.
- [ ] Create default `player_vehicles`.
- [ ] Set `tutorial_state = NOT_STARTED`.

Default wallet:

- [ ] `ROAD_COINS = 0` or `500` after team decision.
- [ ] `TRAVEL_TOKENS = 0`.
- [ ] `SOUVENIR_STAMPS = 0`.
- [ ] `STAMP_FRAGMENTS = 0`.
- [ ] `BLUEPRINTS = 0`.

Wallet service:

- [ ] `wallet.getBalances(player_id)`.
- [ ] `wallet.grant(...)`.
- [ ] `wallet.spend(...)`.
- [ ] Write `wallet_transactions` with reason, source, idempotency key, `balance_before`, and `balance_after`.

Acceptance:

- [ ] First `/player/state` initializes a new player.
- [ ] Player has default vehicle.
- [ ] Player has all five currency balances.
- [ ] Wallet grant/spend writes transactions.
- [ ] Balance cannot go negative.
- [ ] Repeated player creation does not duplicate default vehicle.
- [ ] Repeated wallet grant with same idempotency key does not double-pay.

## Day 4: Route API And Start Trip

Goal: player can see routes, choose a vehicle, and start the first tutorial trip.

Route service:

- [ ] `GET /routes/available`.
- [ ] `GET /routes/:route_id`.
- [ ] `POST /routes/start`.
- [ ] `POST /routes/abandon`.

Rules:

- [ ] Tutorial incomplete players only see Tutorial Route.
- [ ] Tutorial Route is free.
- [ ] Non-Tutorial Route must already be unlocked.
- [ ] Player cannot have two active trips.
- [ ] Starting route locks `player_vehicle_id`.

Trip service:

- [ ] Create `player_trips`.
- [ ] Set `status = ACTIVE`.
- [ ] Set `current_distance_km = 0`.
- [ ] Set `route_config_version = current LIVE config`.
- [ ] Set `last_simulated_at = now()`.
- [ ] Implement `GET /trip/current`.

Acceptance:

- [ ] `/routes/available` returns Tutorial Route.
- [ ] `/routes/start` creates active trip.
- [ ] Second active route start fails.
- [ ] Tutorial Route does not spend Stamps or Trip Prep Fee.
- [ ] `/trip/current` returns current trip.

## Day 5: Trip Simulation Engine Pure Functions

Goal: implement core formulas as pure functions before DB orchestration.

Files:

- [ ] `apps/backend/src/modules/simulation/simulation.formulas.ts`.
- [ ] `apps/backend/src/modules/simulation/simulation.types.ts`.
- [ ] `apps/backend/src/modules/simulation/simulation.spec.ts`.

Pure functions:

- [ ] `calculate_distance_gain()`.
- [ ] `calculate_fuel_used()`.
- [ ] `calculate_cleanliness_loss()`.
- [ ] `calculate_durability_loss()`.
- [ ] `calculate_offline_speed()`.
- [ ] `check_for_forced_stop()`.
- [ ] `calculate_online_rewards()`.
- [ ] `calculate_offline_pending_rewards()`.

Formula defaults:

- [ ] Hold to Drive multiplier is `1.00`.
- [ ] Auto Driving multiplier is `0.85`.
- [ ] Hold to Boost multiplier is `1.10`.
- [ ] Online Road Coins are `floor(distance_km * 10 * route_reward_multiplier)`.
- [ ] Offline Road Coins are `floor(distance_km * 4 * route_reward_multiplier)`.

Acceptance:

- [ ] All core formulas have unit tests.
- [ ] Forced stop can stop at landmark.
- [ ] Forced stop can stop at route end.
- [ ] Fuel-limited distance can clamp progress.
- [ ] Auto/Hold/Boost produce different distances.
- [ ] Test case: current distance 39.9, landmark 40, raw distance 1 -> final gain 0.1 and reason `LANDMARK_REQUIRED`.

## Day 6: Online Drive Tick

Goal: online driving advances distance, consumes vehicle state, grants rewards, and triggers forced stops.

API:

- [ ] Implement `POST /trip/drive-tick`.

Backend flow:

- [ ] Authenticate.
- [ ] `SELECT trip FOR UPDATE`.
- [ ] `SELECT vehicle FOR UPDATE`.
- [ ] Check `trip.status = ACTIVE`.
- [ ] Check mode is unlocked.
- [ ] Use `server_now - last_simulated_at` for duration.
- [ ] Clamp `max_online_tick_seconds`.
- [ ] Calculate distance gain.
- [ ] Check forced stop.
- [ ] Deduct fuel, cleanliness, and durability.
- [ ] Update `trip.current_distance_km`.
- [ ] Grant Road Coins and Travel Tokens.
- [ ] Write wallet transactions.
- [ ] Write analytics events.
- [ ] Return result.

Acceptance:

- [ ] Drive tick advances distance.
- [ ] Fuel decreases.
- [ ] Cleanliness decreases.
- [ ] Durability decreases.
- [ ] Road Coins enter wallet.
- [ ] Travel Token meter works.
- [ ] 40 km landmark triggers forced stop.
- [ ] Forced stop blocks further drive tick.
- [ ] Tick is idempotent.
- [ ] Tick duration is clamped.
- [ ] Low fuel, landmark, and route-end tests pass.

## Day 7: Tutorial State Machine And First Landmark Photo

Goal: complete the first half of the first trip: Hold to Drive, Auto Driving unlock, forced landmark stop, and first photo.

Tutorial state machine:

- [ ] `NOT_STARTED -> ROUTE_SELECTED`.
- [ ] `ROUTE_SELECTED -> HOLD_TO_DRIVE_REQUIRED`.
- [ ] `HOLD_TO_DRIVE_REQUIRED -> AUTO_DRIVING_UNLOCKED`.
- [ ] `AUTO_DRIVING_UNLOCKED -> FIRST_LANDMARK_REACHED`.
- [ ] `FIRST_LANDMARK_REACHED -> PHOTO_TAKEN`.

Landmark/photo service:

- [ ] Implement `POST /trip/complete-landmark`.
- [ ] Require `trip.forced_stop_reason = LANDMARK_REQUIRED`.
- [ ] Require landmark belongs to current route.
- [ ] Create `player_photos`.
- [ ] Calculate `photo_quality_score`.
- [ ] Grant first-photo reward.
- [ ] Set trip back to `ACTIVE`.

Acceptance:

- [ ] Player can unlock Auto Driving after Hold to Drive.
- [ ] First landmark stops the trip.
- [ ] `complete-landmark` generates photo.
- [ ] First photo reward writes wallet transaction.
- [ ] Trip continues after photo.
- [ ] Same landmark cannot grant first reward twice.

Milestone demo:

- [ ] Create player -> start tutorial -> drive -> stop at landmark -> take first photo.

## Day 8: Offline Simulation And Travel Report

Goal: offline return creates one pending Travel Report and claim pays once.

Build:

- [ ] Add `offline_reports` table if not already present.
- [ ] Implement `simulate_offline_progress()`.
- [ ] Make `GET /player/state` trigger or return pending report.
- [ ] Implement `POST /trip/claim-offline-report`.

Rules:

- [ ] If current trip has `claimed=false` report, return it and do not generate a new one.
- [ ] Offline seconds use `min(server_now - max(player.last_seen_at, trip.last_simulated_at), 8h)`.
- [ ] Offline distance clamps by raw distance, fuel-limited distance, next required landmark, and route end.

Acceptance:

- [ ] Offline 2 hours can generate report.
- [ ] Report has distance, rewards, fuel used, cleanliness loss, durability loss.
- [ ] Report rewards are pending, not directly paid.
- [ ] Claim writes wallet transactions.
- [ ] Repeated `/player/state` does not create multiple reports.
- [ ] Claim retry does not double-pay.
- [ ] Offline 12 hours counts only 8 hours.
- [ ] Offline can stop at landmark, route end, or low fuel.

## Day 9: Vehicle Maintenance

Goal: player can refuel, clean, and repair without breaking first-day flow.

APIs:

- [ ] `POST /vehicle/refuel`.
- [ ] `POST /vehicle/clean`.
- [ ] `POST /vehicle/repair`.

Default prices:

- [ ] `fuel_price_per_liter = 2`.
- [ ] `base_clean_cost = 15`.
- [ ] `clean_price_per_point = 0.8`.
- [ ] `base_repair_cost = 25`.
- [ ] `repair_price_per_point = 1.2`.

Acceptance:

- [ ] Fuel at 0 makes drive tick fail.
- [ ] Refuel allows driving to continue.
- [ ] Clean restores cleanliness.
- [ ] Repair restores durability.
- [ ] Maintenance spends Road Coins.
- [ ] Maintenance writes wallet transactions.
- [ ] Insufficient balance blocks maintenance.
- [ ] Full fuel/cleanliness/durability edge cases pass.
- [ ] Maintenance APIs are idempotent.

## Day 10: Route Completion And Route Unlock

Goal: completing tutorial grants Stamps and unlocks the next Short Route.

APIs:

- [ ] `POST /trip/complete-route`.
- [ ] `POST /routes/unlock`.

Completion rules:

- [ ] `current_distance_km >= route.total_distance_km`.
- [ ] Completion reward has not already been claimed.
- [ ] Required landmarks are completed.

Tutorial completion reward:

- [ ] Road Coins.
- [ ] Travel Tokens.
- [ ] 1 Souvenir Stamp or enough Stamp Fragments.
- [ ] `tutorial_state = ROUTE_COMPLETED` or `FULL_SYSTEM_UNLOCKED`.

Route unlock rules:

- [ ] Tutorial is free.
- [ ] Short Route costs 1-2 Stamps.
- [ ] Unlock writes `player_unlocked_routes`.
- [ ] Unlock is permanent.

Acceptance:

- [ ] Tutorial Route can be completed.
- [ ] `complete-route` pays once.
- [ ] Full system unlocks after tutorial.
- [ ] Player receives Stamps.
- [ ] Player can unlock Short Route.
- [ ] Starting unlocked Short Route does not spend Stamps again, only Trip Prep Fee.

## Day 11: Daily Login And Basic Quest System

Goal: add light daily goals without replacing the core travel loop.

Daily login:

- [ ] `GET /daily-login`.
- [ ] `POST /daily-login/claim`.
- [ ] Day 1 gives Stamp Fragments and Road Coins.
- [ ] Day 2 gives Stamp Fragments and Travel Token.
- [ ] Day 7 gives 1 Souvenir Stamp, max once per week.

Quest events:

- [ ] `DRIVE_DISTANCE_ONLINE`.
- [ ] `OFFLINE_REPORT_CLAIMED`.
- [ ] `VEHICLE_REFUELED`.
- [ ] `PHOTO_TAKEN`.
- [ ] `ROUTE_COMPLETED`.

Quest APIs:

- [ ] `GET /quests/daily`.
- [ ] `POST /quests/claim`.

Acceptance:

- [ ] Daily login can be claimed once per day.
- [ ] Day 7 Stamp is max once per week.
- [ ] Drive tick updates driving task progress.
- [ ] Claim offline report updates task progress.
- [ ] Photo updates task progress.
- [ ] Completed task can be claimed.
- [ ] Task rewards write wallet transactions.
- [ ] `period_key`, daily claim idempotency, quest claim idempotency, and incomplete-quest rejection tests pass.

## Day 12: Admin Config, Analytics, And Risk

Goal: make config verifiable, behavior traceable, and suspicious behavior recordable.

Config validation:

- [ ] Add `npm run config:validate`.
- [ ] Validate route segments are continuous.
- [ ] Validate landmarks are inside route range.
- [ ] Validate Tutorial route is 80-120 km.
- [ ] Validate Trip Prep Fee <= 300.
- [ ] Validate gacha probability if present.
- [ ] Validate `offline_coin_per_km < online_coin_per_km`.

Analytics events:

- [ ] `tutorial_start`.
- [ ] `auto_driving_unlocked`.
- [ ] `photo_taken`.
- [ ] `offline_report_generated`.
- [ ] `offline_report_claimed`.
- [ ] `route_completed`.
- [ ] `wallet_currency_changed`.
- [ ] `stopped_at_landmark`.
- [ ] `stopped_low_fuel`.

Risk events:

- [ ] `INVALID_MODE`.
- [ ] `TICK_RATE_LIMITED`.
- [ ] `REWARD_DUPLICATE_ATTEMPT`.
- [ ] `SPEED_LIMIT_EXCEEDED`.

Acceptance:

- [ ] `config:validate` runs.
- [ ] Bad route config fails.
- [ ] Wallet changes write `wallet_currency_changed`.
- [ ] Drive tick anomalies write `suspicious_events`.
- [ ] Forced stops write analytics.

## Day 13: Unity Thin Client Or Debug Web Client

Goal: make the project demoable without Postman.

Option A: Unity Thin Client:

- [ ] Login / Start.
- [ ] Route Board.
- [ ] Driving Screen.
- [ ] Travel Report.
- [ ] Garage / Maintenance.

Driving screen:

- [ ] Car moving on road.
- [ ] Current distance.
- [ ] Next landmark distance.
- [ ] Fuel.
- [ ] Cleanliness.
- [ ] Durability.
- [ ] Hold / Auto / Boost buttons.

Travel Report screen:

- [ ] Offline duration.
- [ ] Distance travelled.
- [ ] Rewards.
- [ ] Fuel used.
- [ ] Vehicle losses.
- [ ] Stop reason.
- [ ] Claim button.

Option B: Debug Web Client if Unity is too slow:

- [ ] Create `apps/debug-client/`.
- [ ] Button: Create Player.
- [ ] Button: Start Tutorial.
- [ ] Button: Drive Tick.
- [ ] Button: Complete Landmark.
- [ ] Button: Simulate Offline.
- [ ] Button: Claim Report.
- [ ] Button: Refuel.
- [ ] Button: Complete Route.
- [ ] Button: Unlock Short Route.

Acceptance:

- [ ] UI can run the full demo.
- [ ] Demo does not require Postman.
- [ ] UI shows backend state.
- [ ] Drive tick updates distance and vehicle status.
- [ ] Travel Report can be claimed.

## Day 14: End-To-End QA, Demo, And Soft Launch Prep

Goal: stabilize the 14-day result into a presentable demo.

Full demo script:

- [ ] Open client.
- [ ] Create new player.
- [ ] Select first route.
- [ ] Hold to Drive.
- [ ] Unlock Auto Driving.
- [ ] Reach first landmark.
- [ ] Take photo.
- [ ] Continue driving.
- [ ] Manually set `last_seen_at` to simulate offline.
- [ ] Return to Travel Report.
- [ ] Claim rewards.
- [ ] Refuel / clean / repair.
- [ ] Complete route.
- [ ] Receive Stamps.
- [ ] Unlock Short Route.

Bug-fix priority:

- [ ] Crash.
- [ ] Duplicate rewards.
- [ ] Cannot continue trip.
- [ ] Forced stop deadlock.
- [ ] Wallet errors.
- [ ] Duplicate report generation.
- [ ] Cannot complete route.

Commands:

- [ ] `npm run test`.
- [ ] `npm run config:validate`.
- [ ] `npm run db:smoke`.

Soft launch prep:

- [ ] D1/D7 metrics plan.
- [ ] Core events land in DB.
- [ ] Wallet transaction query path.
- [ ] Risk event query path.
- [ ] Config rollback process.

Acceptance:

- [ ] Full core loop demos once end to end.
- [ ] All P0 APIs basically work.
- [ ] Core formulas have tests.
- [ ] Wallet has no duplicate reward issue.
- [ ] Offline report does not duplicate.
- [ ] Forced stop works.
- [ ] New player is not stuck.
- [ ] Demo video/screenshots can be recorded.

## Daily End-Of-Day Check

Ask these five questions every day:

- [ ] Does today's code run?
- [ ] Are there tests for today's work?
- [ ] Did we break yesterday's demo?
- [ ] Did we add anything that expands V1 scope?
- [ ] Did we commit to GitHub?

Suggested commit messages:

```text
day-01 backend skeleton and env setup
day-02 supabase schema and seed tutorial route
day-03 player wallet initialization
day-04 route start trip api
day-05 simulation formulas tests
```

## 14-Day Non-Goals

- [ ] No real map API.
- [ ] No real weather API.
- [ ] No multiplayer.
- [ ] No full Gacha commercialization.
- [ ] No complex cosmetic shop.
- [ ] No complete Admin UI.
- [ ] No complex album variants.
- [ ] No traffic AI.
- [ ] No advanced art.
- [ ] No complex vehicle modifications.
- [ ] No Kubernetes.
- [ ] No microservice split.

## Priority Order

```text
Trip Simulation Engine
-> Wallet Ledger
-> Route Config
-> Travel Report
-> Vehicle Maintenance
-> Landmark Photo
-> Route Unlock
```

## Progress Log

- 2026-05-16: Created public GitHub repository `NewTrip-v1`, preserved PDF, extracted docs, and created initial implementation handoff.
- 2026-05-16: Added two-week roadmap, agent rules, domain context, issue-tracker config, triage labels, and `mattpocock/skills` fit review.
- 2026-05-16: Replaced the roadmap with the user-provided 14-day playable spine plan and stack assumptions.
