# Travel Simulator V1

This repository is the implementation handoff for **旅游模拟器 / Travel Simulator V1**.

Source document: `docs/source/Travel_Simulator_V1_Final_Technical_Report_ZH_Clean.pdf`

## What This Game Is

Travel Simulator V1 is a pixel-style long-distance road trip simulator. It is not a racing game, real-world GPS navigation app, or open-world map product. The V1 loop is:

1. Choose a curated route.
2. Choose a vehicle.
3. Pay a capped Road Coins trip prep fee.
4. Drive online through Hold to Drive, Auto Driving, or Hold to Boost.
5. Progress while offline through backend simulation.
6. Stop at landmarks, take photo cards, maintain the vehicle, complete routes, and unlock the next routes.

The technical center of the project is a backend-authoritative **Trip Simulation Engine**, an auditable **Economy Ledger**, and a versioned **Route Config System**.

## Repository Map

- `ROADMAP_14_DAY_CHECKLIST.md` is the two-week implementation checklist and progress log.
- `AGENTS.md` contains mandatory rules for AI agents working in this repo.
- `CONTEXT.md` defines the project domain language and V1 non-goals.
- `docs/agents/` configures issue tracker, triage labels, domain-doc usage, agent roles, and the `mattpocock/skills` fit review.
- `docs/source/` keeps the original PDF and full extracted text.
- `docs/spec/00-deep-reading-record.md` records the full PDF reading and decision map.
- `docs/spec/01-game-and-product-spec.md` captures the product loop, tutorial, UI experience, economy, vehicles, weather, photos, gacha, and daily systems.
- `docs/spec/02-backend-architecture.md` captures the backend module split and authority boundaries.
- `database/v1_schema_reference.sql` is the V1 PostgreSQL schema reference from the report.
- `api/rest_api_inventory.md` is the REST API contract inventory.
- `config/default_parameters.v1.yaml` records the report's default tuning constants.
- `implementation/p0_backlog.md` turns the PDF into an executable P0/P1/P2 delivery backlog.
- `implementation/testing_risk_checklist.md` records test gates, risk controls, analytics, and launch checks.

## Day 1 Commands

```bash
npm install
npm run dev
npm run test
npm run build
```

The Day 1 backend lives in `apps/backend/`. `GET /health` returns the minimal backend health payload.

## Config Validation

Before simulation or route-config work, run:

```bash
npm run config:validate-yaml
npm run config:validate
```

`config:validate-yaml` parses all YAML under `config/` and `art-pipeline/comfyui/`. `config:validate` also checks the Tutorial Route, default vehicle, and Day 5 simulation defaults structurally.

## Non-Negotiable V1 Principles

- Backend is authoritative for distance, time, rewards, offline progress, wallet changes, and gacha results.
- Client submits intent and renders animation. It never decides final distance or currency.
- Every Road Coins, Travel Tokens, Souvenir Stamps, Stamp Fragments, and Blueprints change must be written to `wallet_transactions`.
- Offline rewards are pending in `offline_reports` and only enter the wallet after claim.
- Existing unclaimed offline report blocks new report generation for the same trip.
- Gacha is collection and cosmetics only. It must not gate route progress.
- Fuel must feel like vehicle maintenance, not stamina.
- V1 uses curated route packs, not Google Maps, real navigation, real weather API, MMO, PvP, blockchain, or Kubernetes as a required architecture.

## Recommended First Build Order

1. Player/auth/profile and default save.
2. Route, vehicle, and tutorial route config.
3. Wallet ledger with idempotent grant/spend.
4. Trip Simulation Engine pure functions.
5. Online drive tick with forced stops.
6. Offline simulation and Travel Report.
7. Vehicle maintenance.
8. Landmark/photo card system.
9. Route unlock economy.
10. Admin Config validation and analytics.
