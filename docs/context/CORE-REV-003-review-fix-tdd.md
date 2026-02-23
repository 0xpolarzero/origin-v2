# CORE-REV-003 Review-Fix TDD Evidence

## Scope
This note addresses the review concern that the original ticket implementation commit (`854eaa3f`) mixed tests and implementation, which made strict tests-first ordering non-auditable from that historical change alone.

For the review-fix phase, each behavioral fix was executed with explicit test-first command sequencing and isolated `jj` changes.

## Test-First Evidence (Review Fixes)

1. **Transaction boundary support**
   - Added failing tests:
     - `tests/integration/core-platform.integration.test.ts` (`wraps mutating workflow operations in repository transaction boundaries`)
     - `tests/unit/core/repositories/sqlite-core-repository.test.ts` (`withTransaction rolls back writes when a later step fails`)
   - Failing command (pre-fix): `bun test tests/integration/core-platform.integration.test.ts tests/unit/core/repositories/sqlite-core-repository.test.ts`
   - Passing command (post-fix): `bun test tests/integration/core-platform.integration.test.ts tests/unit/core/repositories/sqlite-core-repository.test.ts`

2. **Bounded list query reads**
   - Added failing test:
     - `tests/unit/core/repositories/sqlite-core-repository.test.ts` (`listEntities performs bounded paged reads instead of unbounded SELECT * scans`)
   - Failing command (pre-fix): `bun test tests/unit/core/repositories/sqlite-core-repository.test.ts`
   - Passing command (post-fix): `bun test tests/unit/core/repositories/sqlite-core-repository.test.ts`

3. **Entity-id audit index coverage**
   - Added failing test:
     - `tests/unit/core/repositories/sqlite-schema.test.ts` (expects `idx_audit_transitions_entity_id_at`)
   - Failing command (pre-fix): `bun test tests/unit/core/repositories/sqlite-schema.test.ts`
   - Passing command (post-fix): `bun test tests/unit/core/repositories/sqlite-schema.test.ts`

4. **Migration negative-path safety**
   - Added negative-path tests:
     - rollback on failed migration SQL
     - checksum mismatch rejection
   - Verification command: `bun test tests/unit/core/repositories/sqlite-migrations.test.ts`

## Notes
- The historical audit gap on `854eaa3f` cannot be retroactively converted into tests-only then implementation-only checkpoints without rewriting prior reviewed history.
- This review-fix pass records auditable tests-first sequencing for all new behavioral fixes and keeps each fix in its own `jj` change description.
