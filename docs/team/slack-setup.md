# NewTrip Slack Setup

This document defines the recommended Slack structure for the NewTrip V1 team.

## Current Status

Slack workspace link provided by the user:

`https://app.slack.com/client/T09KWNHU16C/D09K3ABRCCS`

The connected Slack conversation is a DM named `codex` with channel ID `D09K3ABRCCS`. It is read-only for direct sending from Codex, but a draft setup message has been created there for the user to review and send.

Canvas is not available in this Slack workspace because the workspace appears to be on a free plan.

## Recommended Channels

Start small. If the team is only two or three people, create only `#newtrip-core` first. Add the other channels when message volume becomes noisy.

### `#newtrip-core`

Use this for daily status, blockers, decisions, team-wide announcements, and project coordination.

### `#newtrip-backend`

Use this for schema, migrations, API, Trip Simulation Engine, Economy Ledger, offline Travel Reports, Admin Config, analytics, and anti-cheat.

### `#newtrip-design`

Use this for Route Board, Travel Report UI, tutorial flow, photo card presentation, pixel route backgrounds, and client gameplay presentation.

### `#newtrip-testing`

Use this for smoke tests, regression tests, bug reports, replay scripts, release readiness, and launch blockers.

## Daily Update Format

Each teammate should post one short daily update:

```text
Done:
- ...

Blocked:
- ...

Next:
- ...
```

## Source Of Truth

Slack is for coordination. GitHub is the source of truth.

- Long-term technical roadmap: `docs/source/Travel_Simulator_V1_Final_Technical_Report_ZH_Clean.pdf`
- Current two-week execution plan: `ROADMAP_14_DAY_CHECKLIST.md`
- Agent rules: `AGENTS.md`
- Domain language: `CONTEXT.md`
- Architecture decisions: `docs/adr/`

If Slack discussion changes product scope, backend authority, persistence, economy, or external dependencies, record the decision in an ADR.

## First Pinned Message

```text
*NewTrip V1 team setup*

Core direction: we are building Travel Simulator / NewTrip V1. The long-term technical roadmap is the PDF technical report in GitHub:
https://github.com/77777R7/NewTrip-v1/blob/main/docs/source/Travel_Simulator_V1_Final_Technical_Report_ZH_Clean.pdf

Repo:
https://github.com/77777R7/NewTrip-v1

Two-week goal: build the runnable V1 spine, not the full game. The spine is project skeleton, DB migration/seed, anonymous player, wallet ledger, tutorial route start, online drive tick, forced stop, offline Travel Report, claim idempotency, maintenance, landmark photo, route completion, and config validation.

Daily update format:
Done:
Blocked:
Next:

Mandatory rules:
- Backend owns distance, time, rewards, offline progress, wallet changes, gacha results, and config version.
- Client only submits intent and renders animation.
- Every currency change goes through wallet ledger.
- Offline rewards stay pending in offline_reports until claim.
- Gacha is cosmetic/collection only.
- Fuel is maintenance, not stamina.
```

