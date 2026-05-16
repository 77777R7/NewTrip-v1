# Agent Rules For NewTrip V1

This repo is an implementation handoff for **旅游模拟器 / Travel Simulator V1**. Agents must optimize for a two-week playable V1 spine, not a beautiful long-term architecture in isolation.

## Mandatory Project Rules

1. Read `CONTEXT.md`, `README.md`, `ROADMAP_14_DAY_CHECKLIST.md`, and the relevant `docs/spec/` file before making non-trivial changes.
2. Keep V1 scoped to curated route packs, backend simulation, wallet ledger, Travel Report, vehicle maintenance, landmark/photo, and route unlock.
3. Do not introduce real global maps, Google Maps, real navigation, real weather API, MMO/PvP, blockchain/NFT, or Kubernetes as a required dependency.
4. Backend is authoritative for distance, time, rewards, offline progress, wallet changes, gacha results, and config version selection.
5. Client code, when added, may animate and predict briefly, but must reconcile to backend state.
6. Every currency change must go through wallet ledger semantics: balance update plus immutable transaction with reason, source, and idempotency.
7. Offline rewards stay pending in `offline_reports` until claim. Existing unclaimed pending report must block duplicate generation.
8. Gacha is collection/cosmetic only. It must not gate route unlock or core progress.
9. Fuel is maintenance, not stamina. No wait-to-refill timer and no first-trip fuel trap.
10. Prefer vertical slices that are runnable and testable end to end.
11. Use TDD for core formulas, wallet, offline report, forced stop, and idempotency.
12. Add or update tests for any behavior that changes simulation, wallet, route unlock, offline report, or config validation.
13. Update `ROADMAP_14_DAY_CHECKLIST.md` after each meaningful work session.
14. Preserve the source PDF and extracted text in `docs/source/`; do not rewrite them as working docs.
15. Keep docs and code terminology aligned with `CONTEXT.md`.

## Agent Skills

### Issue tracker

Issues are tracked in GitHub Issues for `77777R7/NewTrip-v1`. See `docs/agents/issue-tracker.md`.

### Triage labels

Use the default five-role triage vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, and `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

This repo uses a single-context domain layout: root `CONTEXT.md` plus `docs/adr/`. See `docs/agents/domain.md`.

## Working Style

- If the task is ambiguous, preserve V1 scope and ask only when the choice changes product direction or external services.
- Do not silently expand scope because a system would be "nice later."
- Use `ROADMAP_14_DAY_CHECKLIST.md` as the source of work sequencing.
- Use `docs/agents/mattpocock-skills-fit.md` to decide which imported workflow patterns fit this repo.

