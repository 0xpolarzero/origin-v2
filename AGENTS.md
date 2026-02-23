# AGENTS

## Goal
Build Origin from scratch using the docs in this repo and Super Ralph.

## Source of truth
- `docs/design.spec.md`
- `docs/engineering.choices.md`
- `docs/references.md`
- `docs/super-ralph.prompt.md`

## Rules
- Keep implementation decisions low-prescription unless the spec is explicit.
- Core-first is mandatory: implement and test core logic before UI integration.
- Use latest stable versions at implementation time and pin resolved versions.
- Use Effect wherever it is practical for core/domain workflows.
- Use pi-mono for AI integration.
- Use `jj` for frequent checkpointing.
- Commit every atomic piece of work.
- Every commit must pass relevant tests/typecheck for that changed slice.

## Commit format
Use concise conventional messages:
- `feat: ...`
- `fix: ...`
- `docs: ...`
- `chore: ...`
