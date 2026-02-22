# Origin Campaign 02 - UI Integration

Integrate UI slices only for core features that are already implemented and thoroughly tested.

## Scope
- Build the required views from `docs/design.spec.md` as thin adapters over tested core logic.
- Keep cross-view UX capabilities consistent.

## Hard Constraints
- Any UI behavior must map to existing tested core modules.
- If a required core behavior is missing, implement and test it first.
- Commit every atomic piece of work with validation.

## References
- `docs/design.spec.md`
- `docs/engineering.choices.md`
- `docs/super-ralph.autonomy.md`
