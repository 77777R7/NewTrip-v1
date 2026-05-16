# mattpocock/skills Fit Review

Source inspected: `https://github.com/mattpocock/skills.git`

Conclusion: use it selectively as an agent workflow toolkit. Do not copy the whole repo into NewTrip, and do not treat it as a runtime dependency.

## Take Now

### `setup-matt-pocock-skills`

Use the repo setup pattern: define issue tracker, triage labels, and domain docs so agents know where work lives and which language to use.

NewTrip application:

- `AGENTS.md`
- `CONTEXT.md`
- `docs/agents/issue-tracker.md`
- `docs/agents/triage-labels.md`
- `docs/agents/domain.md`

### `to-issues`

Use the vertical-slice rule. NewTrip issues should be tracer bullets, not horizontal backend-only or schema-only tasks unless they are genuinely standalone.

Good NewTrip issue shape:

- "Player can start tutorial route and pay zero Trip Prep Fee"
- "Offline report claim pays once even after retry"
- "Drive tick stops exactly at required landmark"

### `tdd`

Use red-green-refactor for core behavior:

- Trip Simulation Engine formulas.
- Forced stop.
- Wallet ledger idempotency.
- Offline report duplicate prevention.
- Route config validation.

Rule: one behavior test, then implementation, then next behavior. Do not write a giant imagined test suite before the first working slice.

### `diagnose`

Use for bugs and regressions. Build a fast feedback loop first, then reproduce, hypothesize, instrument, fix, regression-test.

Best NewTrip feedback loops:

- Unit tests for pure simulation functions.
- Integration tests for API + DB transactions.
- Replay scripts for full loop: create player, start route, tick, stop, photo, offline report, claim.

### `grill-with-docs`

Use before changing product boundaries or architecture. It is especially useful for:

- Should real maps enter V1?
- Should gacha affect vehicle power?
- Should offline rewards increase?
- Should a microservice split happen?

The expected output is updated domain docs or an ADR, not a long conversation only.

### `to-prd`

Use when a feature needs a standalone implementation brief before code, especially for admin config, route editor, client prototype, or soft launch analytics.

### `handoff`

Use at the end of long sessions or Day 14. Handoff should name current status, verified commands, changed files, open blockers, and next exact slice.

### `prototype`

Use for uncertain UI/state mechanics:

- Travel Report presentation.
- Route Board layout.
- Tutorial state machine.
- Admin Config validation UX.

Prototype output should be disposable unless explicitly promoted.

### `zoom-out`

Use when implementation starts to feel fragmented. Ask how the current change fits the full V1 loop and whether it preserves backend authority, wallet auditability, and two-week scope.

## Use Later Or Sparingly

### `improve-codebase-architecture`

Useful after there is real code. In the first few days, avoid abstract architecture work unless tests show a seam is bad.

### `triage`

Useful once GitHub Issues are populated. Not necessary before there are real incoming issues.

### `grill-me`

Useful for product/design interrogation, but `grill-with-docs` is better for this repo because decisions should update `CONTEXT.md` or ADRs.

### `setup-pre-commit`

Useful after the stack is chosen. Do not add Node hooks before the actual package manager and test commands exist.

### `git-guardrails-claude-code`

Potentially useful in a team setting, but not needed for this repo today because Codex and git policy already constrain destructive actions.

## Skip

- `caveman`: not needed unless the user explicitly asks for compressed communication.
- `write-a-skill`: only useful if creating custom reusable skills later.
- `migrate-to-shoehorn`: TypeScript test-helper niche, not relevant yet.
- `scaffold-exercises`: course/exercise repo workflow, not relevant.
- personal, in-progress, and deprecated skills: do not adopt.

