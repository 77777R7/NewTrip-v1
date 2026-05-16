# NewTrip V1 Two-Week Roadmap

Goal: in two weeks, turn the PDF handoff into a runnable V1 backend foundation and a thin playable loop that proves route start, online driving, forced stop, offline Travel Report, wallet ledger, and route completion.

AI update rule: after every work session, update the relevant day checkboxes and append one line to the progress log at the bottom. Do not silently mark work complete unless it has a runnable check, test, or reviewed artifact.

Status legend:

- `[ ]` not started
- `[~]` in progress
- `[x]` complete
- `[!]` blocked or needs human decision

## Week 1: Build The Spine

### Day 1: Repo And Domain Setup

- [x] Preserve the source PDF and full text extract in `docs/source/`.
- [x] Create implementation docs from the PDF.
- [x] Create `CONTEXT.md`, `AGENTS.md`, and `docs/agents/`.
- [ ] Confirm first implementation stack: NestJS/PostgreSQL/Redis or a lighter prototype stack.
- [ ] Create the first executable project skeleton.
- [ ] Add the first smoke command to verify the skeleton runs.

Acceptance check: a new agent can read `README.md`, `CONTEXT.md`, `AGENTS.md`, and this roadmap and know the V1 target without reopening the PDF.

### Day 2: Data Model And Migration Baseline

- [ ] Convert `database/v1_schema_reference.sql` into real migration files.
- [ ] Add local database setup instructions.
- [ ] Add seed data for one config version, one tutorial route, one weather profile, one vehicle, and one landmark.
- [ ] Add schema validation checks for route segment continuity.
- [ ] Add a database reset command for local development.

Acceptance check: local DB can be created, migrated, seeded, and queried from one command.

### Day 3: Player, Auth, Wallet Ledger

- [ ] Implement anonymous/basic player creation.
- [ ] Initialize default wallet balances.
- [ ] Initialize default vehicle and tutorial state.
- [ ] Implement wallet grant/spend with immutable `wallet_transactions`.
- [ ] Add idempotency behavior for wallet operations.
- [ ] Add tests for insufficient balance and duplicate idempotency keys.

Acceptance check: a test can create a player, grant/spend Road Coins, and prove duplicate writes do not double-change balance.

### Day 4: Route And Vehicle Core

- [ ] Implement route availability.
- [ ] Implement route detail.
- [ ] Implement selected vehicle lookup.
- [ ] Implement vehicle selection rules.
- [ ] Implement route start with Trip Prep Fee.
- [ ] Lock `route_config_version` into `player_trips`.

Acceptance check: a player can select the default vehicle and start the free tutorial route.

### Day 5: Trip Simulation Engine Pure Functions

- [ ] Implement `calculate_distance_gain`.
- [ ] Implement `calculate_fuel_used`.
- [ ] Implement `calculate_cleanliness_loss`.
- [ ] Implement `calculate_durability_loss`.
- [ ] Implement deterministic weather bucket selection.
- [ ] Implement `check_for_forced_stop`.
- [ ] Add unit tests for the PDF's three critical examples.

Acceptance check: pure simulation tests pass without database access.

### Day 6: Online Drive Tick

- [ ] Implement `POST /trip/drive-tick`.
- [ ] Calculate tick duration from server time.
- [ ] Clamp `max_online_tick_seconds=15`.
- [ ] Apply route segment, weather, vehicle, and mode multipliers.
- [ ] Apply vehicle state deltas.
- [ ] Grant online Road Coins and Travel Token meter through wallet ledger.
- [ ] Enforce forced stops at landmarks and route end.
- [ ] Emit basic analytics and suspicious events.

Acceptance check: a test starts at 39.9 km, ticks past a 40.0 km required landmark, and stops exactly at the landmark.

### Day 7: Offline Travel Report

- [ ] Implement offline seconds from server time only.
- [ ] Cap offline progress at 8 hours.
- [ ] Generate `offline_reports` with pending rewards.
- [ ] Return existing pending report instead of generating duplicates.
- [ ] Implement `POST /trip/claim-offline-report`.
- [ ] Write pending rewards to wallet transactions on claim.
- [ ] Add idempotent claim tests.

Acceptance check: repeated `GET /player/state` returns the same pending report, and repeated claim pays once.

## Week 2: Complete V1 Loop

### Day 8: Maintenance

- [ ] Implement refuel cost formula.
- [ ] Implement clean cost formula.
- [ ] Implement repair cost formula.
- [ ] Enforce Road Coins spend through wallet ledger.
- [ ] Add vehicle boundary tests.
- [ ] Make low fuel forced stop recoverable.

Acceptance check: a low-fuel trip can be refueled and continue.

### Day 9: Landmark And Photo Cards

- [ ] Implement `POST /trip/complete-landmark`.
- [ ] Calculate photo quality from cleanliness, weather, day phase, and rarity.
- [ ] Grant first-photo rewards.
- [ ] Cap repeat photo rewards.
- [ ] Resume trip after required landmark photo.
- [ ] Emit `photo_taken` and `stopped_at_landmark` analytics.

Acceptance check: player cannot pass a required landmark before completing the photo action.

### Day 10: Route Completion And Unlock

- [ ] Implement `POST /trip/complete-route`.
- [ ] Grant route completion rewards.
- [ ] Implement Souvenir Stamp route unlock.
- [ ] Implement Stamp Fragment conversion path or record as explicit post-MVP if delayed.
- [ ] Enforce Trip Prep Fee Road Coins only.
- [ ] Add tests that Travel Tokens cannot unlock routes.

Acceptance check: completing tutorial can unlock the next route target without gacha.

### Day 11: Tutorial Flow

- [ ] Implement tutorial state transitions.
- [ ] Restrict available routes before tutorial completion.
- [ ] Unlock Auto Driving at the configured first-third point.
- [ ] Unlock Hold to Boost after Auto Driving.
- [ ] Unlock full systems after tutorial completion.
- [ ] Add reconnect/resume tests for tutorial states.

Acceptance check: a new player can complete the full first-trip tutorial path.

### Day 12: Admin Config Validation

- [ ] Implement config draft/validate/publish/rollback skeleton or CLI equivalent.
- [ ] Validate route distance ranges.
- [ ] Validate route segment continuity.
- [ ] Validate tutorial route is free.
- [ ] Validate gacha probability rules if gacha config is present.
- [ ] Validate offline rewards remain below online rewards.

Acceptance check: intentionally bad configs fail with readable validation errors.

### Day 13: Analytics, Risk, And Regression Pack

- [ ] Add event writes for tutorial, route, trip, offline report, wallet, maintenance, photo, and risk events.
- [ ] Add suspicious event paths for invalid mode, tick spam, duplicate reward attempts, and impossible speed.
- [ ] Build one replay/smoke script for the full V1 loop.
- [ ] Add the three critical regression tests from `implementation/testing_risk_checklist.md`.
- [ ] Document any remaining P1/P2 gaps.

Acceptance check: one command runs the full loop regression pack.

### Day 14: Demo, Stabilize, And Handoff

- [ ] Run all tests and smoke scripts.
- [ ] Fix release-blocking failures.
- [ ] Update README with run commands and current demo path.
- [ ] Update this roadmap with final status.
- [ ] Create GitHub issues for remaining vertical slices.
- [ ] Write a handoff note for the next build cycle.

Acceptance check: another agent can clone the repo, run the demo/checks, and continue from documented open issues.

## Progress Log

- 2026-05-16: Created public GitHub repository `NewTrip-v1`, preserved PDF, extracted docs, and created initial implementation handoff.
- 2026-05-16: Added two-week roadmap, agent rules, domain context, issue-tracker config, triage labels, and `mattpocock/skills` fit review.

