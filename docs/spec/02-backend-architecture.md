# Backend Architecture

## Recommended Architecture

V1 should be a modular monolith:

```text
Client: Unity or Godot
  -> HTTPS / JSON
Backend API: Node.js + NestJS + TypeScript
  -> Trip Simulation Engine / Wallet Service / Route Config System
PostgreSQL + Redis
  -> Admin Config / Analytics / Risk Dashboard
```

The report explicitly recommends not starting with microservices or Kubernetes. V1 risks are gameplay loop validation, economy balance, offline simulation, and config operations. Service splitting would add distributed transaction complexity before product proof.

## Client/Server Boundary

Client responsibilities:

- Visual driving presentation.
- Weather/day-night rendering.
- UI input and animation.
- Short prediction interpolation.
- Submitting player intent.

Server responsibilities:

- Auth and ownership checks.
- Trip state, distance, and time.
- Online and offline simulation.
- Forced stops.
- Wallet grant/spend.
- Route unlock.
- Gacha RNG, pity, and history.
- Config publish, validation, checksum, rollback.
- Analytics and suspicious events.

## Modules

P0 modules:

- Auth Service: anonymous login, token validation.
- Player Service: profile, state, tutorial state, features, last seen.
- Route Service: route availability, detail, unlock, start validation.
- Trip Service: start/current/abandon/complete orchestration.
- Trip Simulation Engine: pure online/offline simulation functions.
- Vehicle Service: default vehicle, selected vehicle, player vehicle state.
- Maintenance Service: refuel, clean, repair.
- Economy/Wallet Service: balances, immutable transactions, idempotent grant/spend.
- Landmark/Photo Service: required stops, photo cards, first photo reward.
- Weather/DayNight Service: deterministic simulated conditions.
- Admin Config Service: draft, validate, publish, rollback.
- Analytics Service: backend event recording.
- Anti-Cheat/Risk Service: suspicious events, clamp/reject/rate-limit.

P1 modules:

- Gacha Service.
- Daily Login Service.
- Quest Service.
- Inventory/Blueprint exchange.
- Admin simulation UI.

P2 modules:

- Multiple trips or dispatch.
- Vehicle upgrade depth.
- Seasonal weather.
- Social/share/multiplayer.
- Real weather API or global routes.

## Transaction Boundaries

The following must be single database transactions:

- Online drive tick.
- Offline report generation.
- Offline report claim.
- Route start with trip prep fee.
- Route unlock with Stamp spend.
- Route completion rewards.
- Maintenance payment and state update.
- Gacha pull with token spend, pity, inventory, and history.

Use locks:

- `SELECT ... FOR UPDATE` on `player_trips` for simulation and route completion.
- `SELECT ... FOR UPDATE` on `player_vehicles` for simulation and maintenance.
- `SELECT ... FOR UPDATE` on wallet balances during spend/grant.
- `SELECT ... FOR UPDATE` on `gacha_pity_state` during pulls.

## Idempotency

All retryable write APIs need an `idempotency_key`, including:

- `/routes/unlock`
- `/routes/start`
- `/routes/abandon`
- `/trip/drive-tick`
- `/trip/claim-offline-report`
- `/trip/complete-landmark`
- `/trip/complete-route`
- `/vehicle/refuel`
- `/vehicle/clean`
- `/vehicle/repair`
- `/gacha/pull`
- `/inventory/use-item`
- `/daily-login/claim`
- `/quests/claim`

Repeated keys return the original result. Same key with conflicting request body should return `IDEMPOTENCY_CONFLICT`.

## Config Versioning

Rules:

- Live config rows must not be edited in place.
- Every config change creates a new `config_versions` row.
- New players and new trips use latest LIVE version.
- Active trips use the route/config version captured when the trip started.
- Old versions are marked `DEPRECATED`, not deleted.
- Rollback creates a new LIVE version copied from the old version.

