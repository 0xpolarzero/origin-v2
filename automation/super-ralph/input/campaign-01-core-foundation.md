# Origin Campaign 01 - Core Foundation

Implement the highest-impact core domain capabilities from `docs/design.spec.md` without any UI work.

## Scope
- Build core domain models/services for capture, triage, planning, approvals, and auditability.
- Keep all behavior local-first and deterministic.
- Use Effect where practical for orchestration, errors, retries, and boundaries.

## Hard Constraints
- Do not implement UI in this campaign.
- Core-first: tests and validation before any UI integration.
- Commit every atomic piece of work.
- After each commit, run and report relevant validation commands.
- Use `jj` checkpoints in addition to git commits while iterating.

## References
- `docs/design.spec.md`
- `docs/engineering.choices.md`
- `docs/super-ralph.autonomy.md`
- `docs/reference-repos.md`
