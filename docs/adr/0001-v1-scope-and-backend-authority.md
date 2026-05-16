# ADR 0001: V1 Scope And Backend Authority

Status: accepted

Date: 2026-05-16

## Context

The source PDF defines NewTrip V1 as a curated route travel simulator, not a real map or navigation product. The highest-risk systems are Trip Simulation Engine, Economy Ledger, Route Config System, offline Travel Report, vehicle maintenance, and route unlock.

## Decision

V1 will use curated route packs and a backend-authoritative simulation model.

The backend owns:

- Distance and time.
- Online/offline progress.
- Rewards and wallet deltas.
- Forced stops.
- Route completion.
- Gacha RNG and pity.
- Config version selection.

The client owns:

- Presentation.
- Input intent.
- Short prediction animation that reconciles to backend state.

V1 will not require real maps, Google Maps, real navigation, real weather API, microservices, or Kubernetes.

## Consequences

- Core implementation starts with server-side simulation and wallet tests.
- Offline progress is reproducible and auditable.
- Active trips must keep their start-time config version.
- The first two-week roadmap prioritizes a runnable spine over content breadth.

