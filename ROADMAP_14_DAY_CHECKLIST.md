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

- [x] Create NestJS backend under `apps/backend/`.
- [x] Add `apps/backend/src/main.ts`.
- [x] Add `apps/backend/src/app.module.ts`.
- [x] Add `apps/backend/src/health/`.
- [x] Add `apps/backend/src/config/`.
- [x] Add `apps/backend/src/database/`.
- [x] Add `npm run dev`.
- [x] Add `npm run test`.
- [x] Add `npm run build`.
- [x] Add `GET /health` returning OK.

Environment:

- [x] Add `.env.example` with `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`, `REDIS_URL`, `NODE_ENV`, and `PORT`.

Database/config:

- [x] Create `supabase/migrations/`.
- [x] Create `supabase/seed.sql`.
- [x] Keep `config/default_parameters.v1.yaml` readable and multi-line.
- [x] Add `config/tutorial_route.v1.yaml`.
- [x] Add `config/default_vehicle.v1.yaml`.

Docs/ADRs:

- [x] Keep source PDF and extracted text under `docs/source/`.
- [x] Keep agent rules and project context under `AGENTS.md` and `CONTEXT.md`.
- [x] Add ADR for the tech stack.
- [x] Add ADR for no runtime real-map API in V1.

Acceptance:

- [x] Fresh clone can run `npm install`.
- [x] `npm run dev` starts the backend.
- [x] `GET /health` returns OK.
- [x] `.env.example` exists.
- [x] Supabase migration directory exists.
- [x] Default YAML config files are readable.

Do not do:

- [x] No Gacha.
- [x] No Unity art.
- [x] No real map.
- [x] No complex Admin Panel.

## Day 2: Database Base Tables And Seed Data

Goal: create the minimum database structure so the backend can create players, vehicles, routes, trips, and wallets.

Migrations:

- [x] `config_versions`.
- [x] `players`.
- [x] `wallet_balances`.
- [x] `wallet_transactions`.
- [x] `vehicle_definitions`.
- [x] `player_vehicles`.
- [x] `weather_profiles`.
- [x] `route_definitions`.
- [x] `route_segments`.
- [x] `landmarks`.
- [x] `player_unlocked_routes`.
- [x] `player_trips`.

Do not build yet:

- [x] No gacha tables.
- [x] No daily quest tables.
- [x] No advanced admin tables.
- [x] No `migration_log`.

Seed data:

- [x] One LIVE `config_version`.
- [x] One default vehicle.
- [x] One Tutorial Route.
- [x] One Short Route.
- [x] One weather profile.
- [x] Three Tutorial Route segments covering 0-100 km.
- [x] One required landmark at 40 km.

Tutorial Route defaults:

- [x] `route_type = Tutorial`.
- [x] `total_distance_km = 100`.
- [x] `trip_prep_fee = 0`.
- [x] `unlock_cost_stamps = 0`.
- [x] First landmark at 40 km.

Default vehicle:

- [x] `base_speed_kmph = 72`.
- [x] `fuel_capacity = 45`.
- [x] `fuel_consumption_per_km = 0.075`.
- [x] `cleanliness_loss_per_km = 0.035`.
- [x] `durability_loss_per_km = 0.018`.
- [x] `offline_efficiency = 0.60`.

Acceptance:

- [x] Supabase migration runs.
- [x] `seed.sql` inserts default config.
- [x] Route segments continuously cover 0-100 km.
- [x] Landmark distance is in route range.
- [x] Tutorial Route is free.
- [x] Short Route costs 1-2 Stamps.
- [x] `npm run db:smoke` verifies LIVE config, default vehicle, Tutorial Route, and first landmark.

## Day 3: Player, Auth, And Wallet Initialization

Goal: a new player request creates save data, wallet balances, and default vehicle.

Player service:

- [x] Implement `GET /player/profile`.
- [x] Implement `GET /player/state`.
- [x] Create player if missing.
- [x] Create default `wallet_balances`.
- [x] Create default `player_vehicles`.
- [x] Set `tutorial_state = NOT_STARTED`.

Default wallet:

- [x] `ROAD_COINS = 0` for Day 3.
- [x] `TRAVEL_TOKENS = 0`.
- [x] `SOUVENIR_STAMPS = 0`.
- [x] `STAMP_FRAGMENTS = 0`.
- [x] `BLUEPRINTS = 0`.

Wallet service:

- [x] `wallet.getBalances(player_id)`.
- [x] `wallet.grant(...)`.
- [x] `wallet.spend(...)`.
- [x] Write `wallet_transactions` with reason, source, idempotency key, `balance_before`, and `balance_after`.

Acceptance:

- [x] First `/player/state` initializes a new player.
- [x] Player has default vehicle.
- [x] Player has all five currency balances.
- [x] Wallet grant/spend writes transactions.
- [x] Balance cannot go negative.
- [x] Repeated player creation does not duplicate default vehicle.
- [x] Repeated wallet grant with same idempotency key does not double-pay.

## Day 4: Route API And Start Trip

Goal: player can see routes, choose a vehicle, and start the first tutorial trip.

Route service:

- [x] `GET /routes/available`.
- [x] `GET /routes/:route_id`.
- [x] `POST /routes/start`.
- [x] `POST /routes/abandon`.

Rules:

- [x] Tutorial incomplete players only see Tutorial Route.
- [x] Tutorial Route is free.
- [x] Non-Tutorial Route must already be unlocked.
- [x] Player cannot have two active trips.
- [x] Starting route locks `player_vehicle_id`.

Trip service:

- [x] Create `player_trips`.
- [x] Set `status = ACTIVE`.
- [x] Set `current_distance_km = 0`.
- [x] Set `route_config_version = current LIVE config`.
- [x] Set `last_simulated_at = now()`.
- [x] Implement `GET /trip/current`.

Acceptance:

- [x] `/routes/available` returns Tutorial Route.
- [x] `/routes/start` creates active trip.
- [x] Second active route start fails.
- [x] Tutorial Route does not spend Stamps or Trip Prep Fee.
- [x] `/trip/current` returns current trip.

## Day 5: Trip Simulation Engine Pure Functions

Goal: implement core formulas as pure functions before DB orchestration.

Files:

- [x] `apps/backend/src/modules/simulation/simulation.formulas.ts`.
- [x] `apps/backend/src/modules/simulation/simulation.types.ts`.
- [x] `apps/backend/src/modules/simulation/simulation.constants.ts`.
- [x] `apps/backend/src/modules/simulation/simulation.formulas.spec.ts`.

Pure functions:

- [x] `calculate_distance_gain()`.
- [x] `calculate_fuel_used()`.
- [x] `calculate_cleanliness_loss()`.
- [x] `calculate_durability_loss()`.
- [x] `calculate_offline_speed()`.
- [x] `check_for_forced_stop()`.
- [x] `calculate_online_rewards()`.
- [x] `calculate_offline_pending_rewards()`.

Formula defaults:

- [x] Hold to Drive multiplier is `1.00`.
- [x] Auto Driving multiplier is `0.85`.
- [x] Hold to Boost multiplier is `1.10`.
- [x] Online Road Coins are `floor(distance_km * 10 * route_reward_multiplier)`.
- [x] Offline Road Coins are `floor(distance_km * 4 * route_reward_multiplier)`.

Acceptance:

- [x] All core formulas have unit tests.
- [x] Forced stop can stop at landmark.
- [x] Forced stop can stop at route end.
- [x] Fuel-limited distance can clamp progress.
- [x] Auto/Hold/Boost produce different distances.
- [x] Test case: current distance 39.9, landmark 40, raw distance 1 -> final gain 0.1 and reason `LANDMARK_REQUIRED`.

## Day 6: Online Drive Tick

Goal: online driving advances distance, consumes vehicle state, grants rewards, and triggers forced stops.

API:

- [x] Implement `POST /trip/drive-tick`.

Backend flow:

- [x] Authenticate.
- [x] `SELECT trip FOR UPDATE`.
- [x] `SELECT vehicle FOR UPDATE`.
- [x] Check `trip.status = ACTIVE`.
- [x] Check mode is unlocked.
- [x] Use `server_now - last_simulated_at` for duration.
- [x] Clamp `max_online_tick_seconds`.
- [x] Calculate distance gain.
- [x] Check forced stop.
- [x] Deduct fuel, cleanliness, and durability.
- [x] Update `trip.current_distance_km`.
- [x] Grant Road Coins and Travel Tokens.
- [x] Write wallet transactions.
- [x] Write analytics events.
- [x] Return result.

Acceptance:

- [x] Drive tick advances distance.
- [x] Fuel decreases.
- [x] Cleanliness decreases.
- [x] Durability decreases.
- [x] Road Coins enter wallet.
- [x] Travel Token meter works.
- [x] 40 km landmark triggers forced stop.
- [x] Forced stop blocks further drive tick.
- [x] Tick is idempotent.
- [x] Tick duration is clamped.
- [x] Low fuel, landmark, and route-end tests pass.

## Day 7: Tutorial State Machine And First Landmark Photo

Goal: complete the first half of the first trip: Hold to Drive, Auto Driving unlock, forced landmark stop, and first photo.

Tutorial state machine:

- [x] `NOT_STARTED -> ROUTE_SELECTED`.
- [x] `ROUTE_SELECTED -> HOLD_TO_DRIVE_REQUIRED`.
- [x] `HOLD_TO_DRIVE_REQUIRED -> AUTO_DRIVING_UNLOCKED`.
- [x] `AUTO_DRIVING_UNLOCKED -> FIRST_LANDMARK_REACHED`.
- [x] `FIRST_LANDMARK_REACHED -> PHOTO_TAKEN`.

Landmark/photo service:

- [x] Implement `POST /trip/complete-landmark`.
- [x] Require `trip.forced_stop_reason = LANDMARK_REQUIRED`.
- [x] Require landmark belongs to current route.
- [x] Create `player_photos`.
- [x] Calculate `photo_quality_score`.
- [x] Grant first-photo reward.
- [x] Set trip back to `ACTIVE`.

Acceptance:

- [x] Player can unlock Auto Driving after Hold to Drive.
- [x] First landmark stops the trip.
- [x] `complete-landmark` generates photo.
- [x] First photo reward writes wallet transaction.
- [x] Trip continues after photo.
- [x] Same landmark cannot grant first reward twice.

Milestone demo:

- [x] Create player -> start tutorial -> drive -> stop at landmark -> take first photo.

## Day 8: Offline Simulation And Travel Report

Goal: offline return creates one pending Travel Report and claim pays once.

Build:

- [x] Add `offline_reports` table if not already present.
- [x] Implement `simulate_offline_progress()`.
- [x] Make `GET /player/state` trigger or return pending report.
- [x] Implement `POST /trip/claim-offline-report`.

Rules:

- [x] If current trip has `claimed=false` report, return it and do not generate a new one.
- [x] Offline seconds use `min(server_now - max(player.last_seen_at, trip.last_simulated_at), 8h)`.
- [x] Offline distance clamps by raw distance, fuel-limited distance, next required landmark, and route end.

Acceptance:

- [x] Offline 2 hours can generate report.
- [x] Report has distance, rewards, fuel used, cleanliness loss, durability loss.
- [x] Report rewards are pending, not directly paid.
- [x] Claim writes wallet transactions.
- [x] Repeated `/player/state` does not create multiple reports.
- [x] Claim retry does not double-pay.
- [x] Offline 12 hours counts only 8 hours.
- [x] Offline can stop at landmark, route end, or low fuel.

## Day 9: Vehicle Maintenance

Goal: player can refuel, clean, and repair without breaking first-day flow.

APIs:

- [x] `POST /vehicle/refuel`.
- [x] `POST /vehicle/clean`.
- [x] `POST /vehicle/repair`.

Default prices:

- [x] `fuel_price_per_liter = 2`.
- [x] `base_clean_cost = 15`.
- [x] `clean_price_per_point = 0.8`.
- [x] `base_repair_cost = 25`.
- [x] `repair_price_per_point = 1.2`.

Acceptance:

- [x] Fuel at 0 makes drive tick fail.
- [x] Refuel allows driving to continue.
- [x] Clean restores cleanliness.
- [x] Repair restores durability.
- [x] Maintenance spends Road Coins.
- [x] Maintenance writes wallet transactions.
- [x] Insufficient balance blocks maintenance.
- [x] Full fuel/cleanliness/durability edge cases pass.
- [x] Maintenance APIs are idempotent.

## Day 10: Route Completion And Route Unlock

Goal: completing tutorial grants Stamps and unlocks the next Short Route.

APIs:

- [x] `POST /trip/complete-route`.
- [x] `POST /routes/unlock`.

Completion rules:

- [x] `current_distance_km >= route.total_distance_km`.
- [x] Completion reward has not already been claimed.
- [x] Required landmarks are completed.

Tutorial completion reward:

- [x] Road Coins.
- [x] Travel Tokens.
- [x] 1 Souvenir Stamp or enough Stamp Fragments.
- [x] `tutorial_state = ROUTE_COMPLETED` or `FULL_SYSTEM_UNLOCKED`.

Route unlock rules:

- [x] Tutorial is free.
- [x] Short Route costs 1-2 Stamps.
- [x] Unlock writes `player_unlocked_routes`.
- [x] Unlock is permanent.

Acceptance:

- [x] Tutorial Route can be completed.
- [x] `complete-route` pays once.
- [x] Full system unlocks after tutorial.
- [x] Player receives Stamps.
- [x] Player can unlock Short Route.
- [x] Starting unlocked Short Route does not spend Stamps again, only Trip Prep Fee.

Route decision:

- [x] Tutorial route is now `tutorial_big_sur_hwy1_001` / `Big Sur Sunset Drive`, a 100 km compressed V1 route based on California Hwy 1 Big Sur Coast, north-to-south from Carmel Highlands to the San Carpoforo Creek approach.
- [x] First required landmark is `bixby_bridge_lookout` at 40 km.
- [x] Next Short Route is `short_coast_to_town_001` / `Big Sur to Santa Cruz Drive`, costing 1 Souvenir Stamp and 70 Road Coins Trip Prep Fee.

## Day 11: Daily Login And Basic Quest System

Goal: add light daily goals without replacing the core travel loop.

Daily login:

- [x] `GET /daily-login`.
- [x] `POST /daily-login/claim`.
- [x] Day 1 gives Stamp Fragments and Road Coins.
- [x] Day 2 gives Stamp Fragments and Travel Token.
- [x] Day 7 gives 1 Souvenir Stamp, max once per week.

Quest events:

- [x] `DRIVE_DISTANCE_ONLINE`.
- [x] `OFFLINE_REPORT_CLAIMED`.
- [x] `VEHICLE_REFUELED`.
- [x] `PHOTO_TAKEN`.
- [x] `ROUTE_COMPLETED`.

Quest APIs:

- [x] `GET /quests/daily`.
- [x] `POST /quests/claim`.

Acceptance:

- [x] Daily login can be claimed once per day.
- [x] Day 7 Stamp is max once per week.
- [x] Drive tick updates driving task progress.
- [x] Claim offline report updates task progress.
- [x] Photo updates task progress.
- [x] Completed task can be claimed.
- [x] Task rewards write wallet transactions.
- [x] `period_key`, daily claim idempotency, quest claim idempotency, and incomplete-quest rejection tests pass.

## Day 12: Admin Config, Analytics, And Risk

Goal: make config verifiable, behavior traceable, and suspicious behavior recordable.

Config validation:

- [x] Add `npm run config:validate`.
- [x] Validate route segments are continuous.
- [x] Validate landmarks are inside route range.
- [x] Validate Tutorial route is 80-120 km.
- [x] Validate Trip Prep Fee <= 300.
- [x] Validate gacha probability if present.
- [x] Validate `offline_coin_per_km < online_coin_per_km`.

Analytics events:

- [x] `tutorial_start`.
- [x] `auto_driving_unlocked`.
- [x] `photo_taken`.
- [x] `offline_report_generated`.
- [x] `offline_report_claimed`.
- [x] `route_completed`.
- [x] `wallet_currency_changed`.
- [x] `stopped_at_landmark`.
- [x] `stopped_low_fuel`.

Risk events:

- [x] `INVALID_MODE`.
- [x] `TICK_RATE_LIMITED`.
- [x] `REWARD_DUPLICATE_ATTEMPT`.
- [x] `SPEED_LIMIT_EXCEEDED`.

Acceptance:

- [x] `config:validate` runs.
- [x] Bad route config fails.
- [x] Wallet changes write `wallet_currency_changed`.
- [x] Drive tick anomalies write `suspicious_events`.
- [x] Forced stops write analytics.

## Day 13: Unity Thin Client Or Debug Web Client

Goal: make the project demoable without Postman.

Option A: Unity Thin Client (deferred; Debug Web Client is the Day 13 delivery):

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

Option B: Debug Web Client:

- [x] Create `apps/debug-client/`.
- [x] Button: Create Player / Refresh State.
- [x] Button: Start Tutorial.
- [x] Button: Drive Tick.
- [x] Button: Complete Landmark.
- [x] Button: Simulate Offline.
- [x] Button: Claim Report.
- [x] Button: Refuel.
- [x] Button: Clean.
- [x] Button: Repair.
- [x] Button: Complete Route.
- [x] Button: Unlock Short Route.
- [x] Button: Run Demo Script.

Acceptance:

- [x] UI can run the full demo.
- [x] Demo does not require Postman.
- [x] UI shows backend state.
- [x] Drive tick updates distance and vehicle status.
- [x] Travel Report can be claimed.

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
- 2026-05-16: Completed Day 1 backend skeleton: NestJS workspace, health endpoint, env example, Supabase folders, tutorial/default vehicle YAML, and test/build/dev verification.
- 2026-05-16: Added Day 2 Supabase base schema migration, seed data, config validation, and DB smoke checks.
- 2026-05-16: Completed Day 2 Supabase remote setup for project `NewTrip-v1`: MCP access verified, migrations applied, seed rows confirmed, and foreign-key index advisor findings resolved.
- 2026-05-16: Completed Day 3 player/auth/wallet initialization slice with temporary anonymous auth headers, `/player/profile`, `/player/state`, default wallet/vehicle creation, and wallet idempotency tests.
- 2026-05-16: Completed Day 4 route/trip slice: available/detail routes, start tutorial trip, current trip, abandon trip, selected vehicle locking, and active-trip prevention.
- 2026-05-16: Added ComfyUI batch-generation workflow docs for the pseudo-3D pixel-art route style, including art bible, prompt library, manifest, workflow template, and approved Big Sur style reference.
- 2026-05-16: Generated and archived first Tutorial Coast draft layer test outputs for sky, far ocean, lighthouse silhouettes, roadside grass, and road foreground; marked them as art-direction drafts, not production-complete Unity assets.
- 2026-05-16: Added `docs/art/scene-pack-contract-v1.md` as the mandatory asset production contract and wired the art bible and ComfyUI workflow to require usage class, layer type, time preset, naming, and metadata for future generation.
- 2026-05-16: Clarified art generation policy: V1 uses ChatGPT Image 2.0-first for fast draft exploration, while ComfyUI/Leonardo remain later repeatable production-factory options under the same scene-pack contract.
- 2026-05-16: Created the first 0-35 km Big Sur Sunset Coastal Cliffs layer composite mock from five generated draft layers and recorded the review caveats for alpha cleanup, road animation, HUD safe area, and Unity import readiness.
- 2026-05-17: Installed global Codex Unity skills (`unity-skills`, `unity-mcp-orchestrator`), registered the local Unity MCP endpoint in Codex config, and added an `apps/unity-client` Unity project shell with the Big Sur Sunset draft layers staged under `Assets/NewTrip`.
- 2026-05-17: Locked the client road-rendering direction away from full-screen driving images: added the Unity pseudo-3D road renderer plan and updated the scene-pack contract so production road projection is code-generated with small tiles, strips, sprites, backgrounds, signs, and overlays.
- 2026-05-17: Added the first Unity pseudo-3D road renderer prototype scripts: procedural road mesh, lane strip, rear car anchor, roadside sprite spawning/scaling, landmark sign cue, weather overlay, runtime bootstrap, and Editor menu scene builder.
- 2026-05-17: Rebuilt the Unity prototype composite asset crops from the approved draft sheets, fixing half-car, mixed-sign, duplicated-rock, and neighboring-tree cuts, then regenerated the contact sheet and manifest for import review.
- 2026-05-17: Locked the Unity prototype composite to a phone-portrait coordinate contract, updated road/background/spawner anchors, made road and lane meshes double-sided for prototype visibility, and verified the 9:16 Game view composite in Unity.
- 2026-05-16: Completed pre-Day-5 cleanup gate: expanded remaining inline config YAML, added parser-backed YAML validation, added `config:validate-yaml`, and covered config validation with unit tests.
- 2026-05-16: Completed Day 5 Trip Simulation Engine pure functions with typed simulation inputs, default constants, distance/consumption/offline/forced-stop/reward formulas, and focused unit tests.
- 2026-05-16: Completed Day 6 online drive tick: `/trip/drive-tick`, backend-authoritative distance/vehicle/wallet updates, tick idempotency, max-duration clamp, landmark forced stop, analytics event writes, and route-end/low-fuel tests.
- 2026-05-17: Completed Day 7 tutorial landmark/photo slice: tutorial state machine through `PHOTO_TAKEN`, Auto Driving unlock guard, `POST /trip/complete-landmark`, `player_photos`, first-photo wallet reward, and idempotent retry coverage.
- 2026-05-17: Completed Day 8 offline Travel Report slice: `offline_reports`, `simulate_offline_progress`, pending reports from `/player/state`, claim-only wallet payout, duplicate pending-report prevention, idempotent claim retry, and Supabase migration verification.
- 2026-05-17: Completed Day 9 vehicle maintenance slice: `POST /vehicle/refuel`, `/vehicle/clean`, `/vehicle/repair`, default price formulas, Road Coins spends through wallet ledger, idempotent maintenance actions, full-stat/insufficient-funds guards, and Supabase migration verification.
- 2026-05-17: Completed Day 10 route completion/unlock slice: Big Sur tutorial completion rewards, required-landmark guard, Short Route unlock with Souvenir Stamps, Trip Prep Fee on unlocked route start, and Supabase migration verification.
- 2026-05-17: Completed Day 11 daily-login and basic quest slice: `/daily-login`, `/quests/daily`, idempotent reward claims, five travel-loop quest events, wallet-ledger rewards, Day 7 weekly Stamp guard, and Supabase migration verification.
- 2026-05-17: Completed Day 12 admin config/analytics/risk slice: stricter config validation, admin diagnostics read APIs, `wallet_currency_changed` and core travel analytics, `suspicious_events` logging for invalid modes, clamped ticks, duplicate reward attempts, and Supabase migration verification.
- 2026-05-17: Completed Day 13 Debug Web Client slice: `apps/debug-client`, local backend proxy, demo controls for the full playable spine, debug-only time-skip helpers, smoke coverage, and a one-command `npm run dev:demo` launcher.
