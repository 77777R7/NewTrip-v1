# Domain Docs

Layout: single-context.

Agents should read:

1. `CONTEXT.md` for domain language and non-goals.
2. `README.md` for repository map.
3. `ROADMAP_14_DAY_CHECKLIST.md` for current two-week sequencing.
4. `docs/spec/` for extracted product and technical specs.
5. `docs/adr/` for architectural decisions.

## Consumer Rules

- Use the exact domain terms from `CONTEXT.md`.
- If you introduce a new durable term, add it to `CONTEXT.md`.
- If you make a decision that changes architecture, scope, persistence, or external dependencies, add an ADR.
- Do not override ADRs without creating a newer ADR that explains the replacement.
- Keep day-to-day status in `ROADMAP_14_DAY_CHECKLIST.md`, not scattered across random notes.

