# Testing, Risk, And Launch Checklist

## Required Test Types

- Unit tests: formulas for distance, fuel, cleanliness, durability, photo quality, unlock cost, trip prep fee.
- Integration tests: start route, drive tick, forced stop, refuel, continue, route completion.
- Economy simulation: 7-day and 30-day player archetypes.
- Offline simulation: server time, 8-hour cap, fuel cap, landmark stop, route end, duplicate report prevention.
- Wallet concurrency: concurrent claim/refuel/spend must not create negative balance or duplicate ledger rows.
- Gacha probability: large simulation checks rates and 10/30/80 pity.
- Config validation: segment discontinuity, bad probabilities, paid tutorial, bad trip prep fee.
- Anti-cheat: tick spam, invalid mode, repeated claim, route tampering.
- Analytics: every core loop event lands with player/trip/config context.
- Soft launch: D1/D7, tutorial funnel, offline claim, route unlock, economy balances, risk events.

## Three Critical Regression Tests

### Drive tick stops at required landmark

Given:

- `trip.current_distance_km = 39.9`
- `next_required_landmark.distance_km = 40.0`
- `distance_raw = 0.5`

Then:

- `distance_gain_km = 0.1`
- `trip.status = FORCED_STOP`
- `forced_stop_reason = LANDMARK_REQUIRED`
- No distance beyond landmark is rewarded.

### Offline report claim is idempotent

Given:

- `offline_report.claimed = false`
- `road_coins_pending = 100`

When:

- `POST /trip/claim-offline-report` is called twice with same idempotency key.

Then:

- One wallet transaction is created.
- Balance increases once.
- Second response returns same result.

### Pending offline report prevents duplicate generation

Given:

- Trip has unclaimed offline report.

When:

- `GET /player/state` is called multiple times.

Then:

- No new report is inserted.
- Same pending report is returned.

## Risk Controls

- Route too long: monitor completion time and drop-off point; shorten early routes and add mid-route rewards.
- Tutorial too slow: keep route 80-120 km, first landmark early, Auto unlock in first third.
- Auto unlock too late: monitor unlock distance and early churn.
- Fuel feels like stamina: no wait-to-refill, first trip cannot run dry, refuel only costs earnable Road Coins.
- Offline too strong: offline 4 coins/km vs online 10 coins/km; cap at 8 hours.
- Maintenance too expensive: cap maintenance ratio against daily income.
- Gacha perceived as pay-to-progress: gacha cannot unlock routes or block progression.
- Stamps too scarce: Short routes cost 1-2; album/weekly tasks provide Stamps; daily login mostly fragments.
- Duplicate wallet rewards: idempotency, unique indexes, single transaction ledger.
- Duplicate offline calculation: one pending report per trip, lock trip, update `last_simulated_at`.
- Skipped landmarks: forced stop clamps to landmark distance.
- Bad config publish: Draft/Validate/Simulate/Publish/Rollback.
- Gacha probability bug: pre-publish simulation and history audit.
- Concurrency bugs: locks and unique idempotency keys.
- Client cheating: server authority, clamp, reject, suspicious events.
- Admin permission risk: RBAC, audit log, two-person approval.
- Missing analytics: backend event checklist and tests.
- Old config deletion: never delete historical config versions.
- Segment discontinuity: route validation must cover full distance with no overlap/gaps.
- Economy inflation: monitor average balance trend and source/sink ratio.
- Weak Travel Report feedback: show distance, rewards, weather, losses, stop reason.
- First-day gacha distraction: delay gacha guidance; keep Tokens separate from Stamps.

## Backend Launch Checklist

- Player system: auth token, player init, tutorial transitions, risk status, server `last_seen_at`.
- Wallet: all currencies, immutable transactions, locked balance spend, idempotency.
- Route: route types, difficulty, config version, segment continuity, tutorial free route.
- Tutorial: 3x3 starts/destinations, first landmark, first photo, full unlock.
- Client layer: driving screen, background switch, weather/day-night, Route Board, Travel Report, prediction correction.
- Vehicle: definitions, player state, one selected vehicle, locked vehicle during trip.
- Maintenance: fuel, clean, repair formulas and state effects.
- Online: backend tick, server duration, max tick clamp, mode multipliers, forced stops, rewards.
- Offline: server time only, 8-hour cap, fuel and forced stop clamps, lower rewards.
- Travel Report: independent table, pending rewards, duplicate prevention, idempotent claim.
- Photos: photo quality, first/repeat reward, album reward, unique first photo.
- Weather/day-night: deterministic bucket, consistent online/offline, all multipliers.
- Route unlock: Stamps permanent, Road Coins trip fee, fragments conversion.
- Gacha: backend RNG, public probabilities, pity, history, duplicate blueprints.
- Daily/quest: period key, claim idempotency, event-driven progress.
- Admin Config: draft/validate/publish/rollback, checksum, simulation, audit.
- Config Version: old configs retained, active trips use start version.
- Analytics: tutorial, route, wallet, offline, gacha, photo, maintenance events.
- Anti-cheat: client distrust, rate limits, speed caps, suspicious events.
- Soft launch: cohort, dashboards, rollback drill, support lookup tools.

