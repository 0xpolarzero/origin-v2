# CORE-REV-001 Review Fix TDD Log

Date: 2026-02-23

This phase used test-first sequencing for behavior changes:

1. Added/expanded tests for checkpoint rollback restoration and failure edges.
   - Failing command first: `bun test tests/unit/core/services/checkpoint-service.test.ts`
   - Then implementation updates in checkpoint model/service/repository.
   - Passing command after fix: `bun test tests/unit/core/domain/checkpoint.test.ts tests/unit/core/services/checkpoint-service.test.ts`

2. Added tests for outbound-draft conversion and unknown target handling.
   - Failing command first: `bun test tests/unit/core/services/signal-service.test.ts`
   - Then implementation updates in signal conversion workflow.
   - Passing command after fix: `bun test tests/unit/core/services/signal-service.test.ts`

3. Added tests for approval pre-validation and `pending_approval` enforcement.
   - Failing command first: `bun test tests/unit/core/services/approval-service.test.ts`
   - Then implementation updates in approval service ordering/guards.
   - Passing command after fix: `bun test tests/unit/core/services/approval-service.test.ts tests/unit/core/services/event-service.test.ts`

4. Added tests for entry suggestion creation/edit/reject lifecycle.
   - Failing command first: `bun test tests/unit/core/services/entry-service.test.ts`
   - Then implementation updates in entry service/platform wiring.
   - Passing command after fix: `bun test tests/unit/core/services/entry-service.test.ts tests/unit/core/domain/entry.test.ts`

5. Added tests for file repository mkdir + invalid shape hardening.
   - Failing command first: `bun test tests/unit/core/repositories/file-core-repository.test.ts`
   - Then repository persistence/load hardening updates.
   - Passing command after fix: `bun test tests/unit/core/repositories/file-core-repository.test.ts`

6. Added tests for memory numeric validation and key-index behavior.
   - Failing command first: `bun test tests/unit/core/domain/memory.test.ts tests/unit/core/services/memory-service.test.ts`
   - Then memory domain/service updates.
   - Passing command after fix: `bun test tests/unit/core/domain/memory.test.ts tests/unit/core/services/memory-service.test.ts`

7. Replaced API/data integration TODOs with executable tests.
   - Passing command after implementation: `bun test tests/integration/api-data.integration.test.ts`

Final phase validation:
- `bun run typecheck`
- `bun test tests/unit/core tests/integration/api-data.integration.test.ts tests/integration/core-platform.integration.test.ts tests/integration/workflow-automation.integration.test.ts`
