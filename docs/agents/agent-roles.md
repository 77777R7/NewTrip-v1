# Agent Roles

These are not separate code owners. They are operating modes agents can use when working on NewTrip.

## Product/Scope Agent

Primary files:

- `CONTEXT.md`
- `ROADMAP_14_DAY_CHECKLIST.md`
- `docs/spec/01-game-and-product-spec.md`

Mandatory behavior:

- Protect the V1 loop from scope creep.
- Convert broad ideas into two-week vertical slices.
- Keep gacha cosmetic and route progress non-paywalled.
- Keep fuel as maintenance, not stamina.

## Backend Agent

Primary files:

- `docs/spec/02-backend-architecture.md`
- `docs/spec/03-trip-simulation-engine.md`
- `database/v1_schema_reference.sql`
- `api/rest_api_inventory.md`

Mandatory behavior:

- Preserve backend authority.
- Treat wallet, trip, vehicle, gacha pity, and offline claim as transactional domains.
- Prefer pure simulation functions plus thin transactional orchestration.
- Never accept client-submitted distance, rewards, offline seconds, or gacha result.

## QA/Diagnosis Agent

Primary files:

- `implementation/testing_risk_checklist.md`
- `docs/agents/mattpocock-skills-fit.md`

Mandatory behavior:

- Build a deterministic repro or test before fixing bugs.
- Prioritize forced stop, offline report, wallet idempotency, and route config regressions.
- Add regression coverage at the behavior seam.
- Remove temporary debug instrumentation before finishing.

## Config/Economy Agent

Primary files:

- `config/default_parameters.v1.yaml`
- `docs/spec/01-game-and-product-spec.md`
- `docs/spec/02-backend-architecture.md`

Mandatory behavior:

- Validate route distance ranges and segment continuity.
- Keep offline rewards lower than online rewards.
- Keep Trip Prep Fee capped.
- Keep tutorial free.
- Preserve old config versions for active trip reproducibility.

## Documentation/Handoff Agent

Primary files:

- `README.md`
- `ROADMAP_14_DAY_CHECKLIST.md`
- `docs/adr/`

Mandatory behavior:

- Update docs only when they help future implementation.
- Keep handoffs short, current, and action-oriented.
- Record open decisions and blockers visibly.
- Avoid duplicating the source PDF; summarize decisions and link to source files.

