# ADR 0002: V1 Technical Stack

Status: accepted

Date: 2026-05-16

## Context

The 14-day goal is to build a runnable, testable, demoable V1 playable spine, not a full production game. The stack should minimize setup drag while staying aligned with the Clean Final Report: backend-authoritative simulation, auditable wallet ledger, route config, and offline Travel Reports.

## Decision

NewTrip V1 will use:

- Game Client: Unity + C#.
- Backend: Node.js + NestJS + TypeScript.
- Database: Supabase PostgreSQL.
- Auth: Supabase Auth or temporary anonymous auth during the early playable-spine phase.
- Cache: Redis after Day 10 if needed; database idempotency first.
- Admin: SQL seed/config files and validation scripts first; Retool or full Admin UI later.
- Analytics: write to `analytics_events` first; Firebase/PostHog later.

## Consequences

The first implementation step is a NestJS backend under `apps/backend/`, plus Supabase migrations and seed data. Redis, Retool, Firebase, PostHog, and advanced Admin UI must not block the first playable spine.

