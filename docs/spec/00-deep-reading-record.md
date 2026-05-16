# Deep Reading Record

PDF: `Travel_Simulator_V1_Final_Technical_Report_ZH_Clean.pdf`  
Title: `旅游模拟器 / Travel Simulator V1 最终技术落地方案报告`  
Date in document: 2026-05-15  
Pages: 73  
Extracts preserved:

- `docs/source/travel_simulator_report_full_layout_extract.txt`
- `docs/source/travel_simulator_report_full_plain_extract.txt`

## Executive Understanding

The PDF is a direct implementation report, not a concept deck. It defines a V1 game built around a backend-authoritative road trip simulation loop: curated routes, route segments, landmarks, online driving, offline progress, Travel Reports, vehicle maintenance, photo cards, route unlocks, and collection-only gacha.

The report repeatedly narrows scope: V1 must avoid real global maps, Google Maps, real GPS navigation, complex traffic AI, real weather API, MMO/PvP, blockchain/NFT, Kubernetes as a required dependency, and true paid gacha. The purpose is to validate the first playable loop, retention through offline return, vehicle maintenance, photo collection, and next-route motivation.

## Core Product Shape

The game is positioned as:

- Pixel-style long-distance road trip simulation.
- Light management through vehicle fuel, cleanliness, and durability.
- Collection through photos, albums, vehicles, skins, blueprints, and gacha.
- Offline return through backend-generated Travel Reports.
- Route progression through Souvenir Stamps and capped Road Coins trip fees.

The emotional target is relaxation, anticipation, progress, discovery, and return. It is not speed competition or high-precision driving.

## V1 Success Metrics

- Tutorial Completion Rate: at least 75%.
- First Trip Complete Rate: at least 65%.
- D1 Retention: at least 30% during soft launch observation.
- Offline Report Claim Rate: at least 45%.
- First Route Unlock Rate: at least 35%.
- Economy Inflation: 7-day average Road Coins balance must not grow excessively.

## Backend Authority Map

The client can:

- Render vehicle movement, pixel backgrounds, weather, UI, and photos.
- Submit player intent: hold, auto, boost, claim, photo, start route.
- Predict short animation locally.

The client cannot:

- Decide final distance, offline time, rewards, wallet deltas, route completion, or gacha results.
- Submit Road Coins, Travel Tokens, Stamps, distance, random seeds, or item outcomes.

The backend must:

- Calculate online and offline progress.
- Clamp tick duration and theoretical speed.
- Generate and claim offline reports.
- Write wallet transactions for every currency movement.
- Lock trips, vehicles, wallet balances, and pity state in transactions.
- Emit analytics and suspicious events.

## Main Systems Recorded From The PDF

1. Product positioning and V1 scope.
2. Main, daily, offline-return, route unlock, maintenance, photo, and gacha loops.
3. Client presentation layer: main driving screen, segment background changes, weather/day-night treatment, Route Board, Travel Report UI, photo card stop, prediction reconciliation.
4. First-trip tutorial: 3x3 start/destination choices, 80-120 km route, free trip, Hold to Drive, Auto Driving, Hold to Boost, first forced landmark, first photo, full system unlock.
5. Modular monolith backend: NestJS/TypeScript, PostgreSQL, Redis, Admin Panel, Analytics.
6. Service modules: Auth, Player, Route, Trip, Trip Simulation Engine, Vehicle, Maintenance, Wallet, Inventory, Landmark/Photo, Weather/DayNight, Gacha, Daily Login, Quest, Admin Config, Analytics, Anti-Cheat.
7. V1 scope control: P0 must-have, P1 optional, P2 later, and explicit non-goals.
8. Route system: curated route packs, definitions, segments, landmarks, weather profile, day-night profile, background pack, reward multipliers.
9. Route unlock economy: Souvenir Stamps permanently unlock routes; Road Coins pay capped trip prep; Travel Tokens must not unlock routes.
10. Wallet economy: Road Coins, Travel Tokens, Souvenir Stamps, Stamp Fragments, Blueprints.
11. Vehicle system: base speed, fuel, durability, cleanliness, offline efficiency, weather resistance, rarity, skins, upgrades.
12. Maintenance formulas: fuel, cleaning, repair, weather/terrain/durability effects.
13. Online driving: server-authoritative tick, max 15 seconds, Hold 1.00, Auto 0.85, Boost 1.10.
14. Offline driving: server time only, max 8 hours, base speed 30 km/h, pending report rewards.
15. Travel Report: independent `offline_reports` table, no duplicate pending report generation, claim idempotency.
16. Landmark/photo system: required stops, photo quality, first/repeat reward split, album rewards.
17. Weather: simulated seeded route weather, no real weather API in V1.
18. Day/night: simulated game minutes, not real timezone.
19. Gacha: collection/cosmetic only, backend RNG, pity and history.
20. Daily login and quests: fragments, coins, small tokens, one full Day 7 Stamp per week max, event-driven tasks.
21. PostgreSQL schema: player, wallet, inventory, vehicle, route, trip, report, photo, weather, login, quest, gacha, config, analytics, suspicious, migration tables.
22. REST API: player, routes, trip, wallet, vehicle maintenance, gacha, inventory, daily/quest, admin config.
23. Trip Simulation Engine: pure formulas plus transactional online/offline orchestration.
24. Anti-cheat: distrust client time, distance, rewards, gacha result, and config.
25. Admin Config System: Draft, Validate, Publish, Rollback, checksum, audit, economic simulator.
26. Config Versioning: live version lock on trip start, old versions deprecated but retained.
27. Analytics: tutorial, route, offline, vehicle, gacha, photo, wallet, risk events.
28. Technical choices: Node.js, NestJS, TypeScript, PostgreSQL, Redis, PostHog/Firebase, Render/Railway/Supabase/AWS/GCP, Retool/self-hosted admin, Unity/Godot client.
29. V1 roadmap: 12 phases from account/route to soft launch.
30. Testing: unit, integration, economy simulation, offline, wallet concurrency, gacha probability, config validation, anti-cheat, analytics, soft launch.
31. Risks: route length, tutorial slowness, fuel-as-stamina perception, offline imbalance, maintenance costs, gacha paywall perception, stamp scarcity, duplicate rewards, duplicate offline reports, skipped landmarks, bad config publish, gacha probability bugs, concurrency, cheating, admin permission, missing analytics, deleted old configs, segment discontinuity, inflation, weak Travel Report, first-day gacha distraction.
32. Backend checklist: final launch checklist by subsystem.
33. Change log: clean version fixed layout/terminology/economy values/client layer/scope/offline duplicate rules/daily stamp risk/P0-P2/testing-risk.
34. Final architect advice: build simulation engine first, keep wallet strict, keep routes configurable, keep offline restrained, keep gacha cosmetic, keep tutorial short and positive.

## Highest-Risk Implementation Details

- `GET /player/state` must query existing pending `offline_reports` before attempting generation.
- `POST /trip/claim-offline-report` must lock report, check `claimed=false`, write wallet transactions, and set `claimed=true`.
- `POST /trip/drive-tick` must calculate duration from server time and clamp to `max_online_tick_seconds=15`.
- `player_trips`, `player_vehicles`, `wallet_balances`, and `gacha_pity_state` require transaction locking where relevant.
- All write endpoints need idempotency keys or equivalent backend request IDs.
- Config publish must validate route segment continuity, route distance range, gacha probability/pity, offline-vs-online economy, tutorial free route, and trip prep fee clamp.
- Active trips must remain tied to the route/config version that existed when the trip started.

