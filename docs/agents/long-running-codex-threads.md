# Long-Running Codex Threads

Use these three durable thread profiles when starting or resuming NewTrip work. They keep recurring context explicit without scattering new notes.

## Unity Visual QA / Pseudo-3D Driving

Purpose: make the Unity phone-portrait driving view feel natural, stable, and reviewable.

Start prompt:

```text
Continue the NewTrip Unity Visual QA / pseudo-3D driving thread.
Read AGENTS.md, CONTEXT.md, README.md, ROADMAP_14_DAY_CHECKLIST.md,
docs/client/newtrip-pseudo3d-driving-knowledge-base-v1.md,
docs/client/pseudo3d-road-renderer-v1.md,
docs/client/unity-portrait-coordinate-contract-v1.md,
docs/client/unity-road-lock-pass-v1.md, and
docs/client/unity-car-anchor-test-v1.md.
Preserve V1 scope: no real maps, no full-road generated runtime image, and Unity visual prediction must reconcile to backend state.
Use the current visual gate before adding the next layer.
```

Required anchors:

- V1 uses curated route packs, not real navigation.
- Road, lane, edge, and future spawners consume one visual distance source.
- RoadOnlyTest, SkyOnlyTest, SkyFarRoadTest, Road Lock Pass, and CarAnchorTest are staged gates, not optional screenshots.
- Do not add UI, bridge, signs, guardrails, roadside props, vegetation, or weather before the active gate allows them.
- Update `ROADMAP_14_DAY_CHECKLIST.md` after meaningful visual QA work.

Done signal:

- Required Unity capture artifacts exist for the gate.
- The report names pass/fail against the gate criteria.
- Any rejected visual output is documented as review-only, not silently promoted.

## Day 14 QA + Demo Stabilization

Purpose: turn the 14-day spine into a reliable, recordable demo.

Start prompt:

```text
Continue the NewTrip Day 14 QA + demo stabilization thread.
Read AGENTS.md, CONTEXT.md, README.md, ROADMAP_14_DAY_CHECKLIST.md,
docs/spec/01-game-and-product-spec.md, docs/spec/02-backend-architecture.md,
and docs/agents/issue-tracker.md.
Focus on the full core loop demo and P0 bug classes only.
```

Required anchors:

- Demo target is the full loop from player creation through Short Route unlock.
- Prioritize crashes, duplicate rewards, cannot continue trip, forced-stop deadlock, wallet errors, duplicate report generation, and cannot complete route.
- Verification defaults are `npm run test`, `npm run config:validate`, `npm run db:smoke`, and debug-client smoke checks when relevant.
- Do not mix unfinished Unity prototype growth into Day 14 stabilization unless it blocks the demo.

Done signal:

- The full demo script has a clear pass/fail note.
- Failed steps are converted into vertical-slice issues or direct fixes.
- The roadmap checkboxes and progress log reflect the verified state.

## Backend Spine / Wallet / Offline Report / Idempotency

Purpose: protect backend authority and money/progress correctness.

Start prompt:

```text
Continue the NewTrip backend spine / wallet / offline report / idempotency thread.
Read AGENTS.md, CONTEXT.md, README.md, ROADMAP_14_DAY_CHECKLIST.md,
docs/spec/02-backend-architecture.md, docs/spec/03-trip-simulation-engine.md,
database/v1_schema_reference.sql, and api/rest_api_inventory.md.
Use TDD for core formulas, wallet ledger changes, offline reports, forced stops, and idempotency.
```

Required anchors:

- Backend is authoritative for distance, time, rewards, offline progress, wallet changes, gacha results, and config version selection.
- Every currency change uses wallet ledger semantics: balance update plus immutable transaction with reason, source, and idempotency.
- Offline rewards stay pending in `offline_reports` until claim.
- Existing unclaimed pending reports block duplicate generation.
- Fuel is maintenance, not stamina.

Done signal:

- Changed behavior has focused tests.
- Idempotent retry behavior is covered where money, rewards, or reports are touched.
- The roadmap is updated only after runnable verification or reviewed artifacts.

## Skill Routing

Use `newtrip-visual-gate` for Unity visual QA gate work.

Use `newtrip-v1-slice` for roadmap vertical slices that change simulation, wallet, route unlock, offline report, config validation, or demo-critical behavior.

Do not use these thread profiles to expand V1 scope. They are continuity tools, not permission to add real maps, real weather APIs, MMO/PvP, blockchain, or large architecture changes.
