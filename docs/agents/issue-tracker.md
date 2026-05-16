# Issue Tracker

Issue tracker: GitHub Issues.

Repository: `77777R7/NewTrip-v1`

Use GitHub Issues for implementation slices, PRDs, bugs, and agent-ready tasks.

## Rules

- Prefer vertical-slice issues over layer-only issues.
- Each issue should be independently verifiable.
- Each issue should include acceptance criteria.
- Mark issues that an agent can complete without more human input as `ready-for-agent`.
- Mark issues needing design/product decisions as `ready-for-human` or `needs-info`.
- Do not create issues for vague cleanup unless they name the user-visible or release-risk outcome.

## Suggested Issue Body

```markdown
## What to build

Describe the end-to-end behavior.

## Acceptance criteria

- [ ] Criterion 1
- [ ] Criterion 2
- [ ] Criterion 3

## Blocked by

None - can start immediately.

## References

- ROADMAP_14_DAY_CHECKLIST.md
- CONTEXT.md
- docs/spec/...
```

