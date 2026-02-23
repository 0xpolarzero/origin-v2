## core
### Status: PARTIALLY SET UP
### What works:
- Bun integration test discovery now finds and runs `tests/integration/core-platform.integration.test.ts`.
- A smoke integration test confirms the `core` integration suite is wired and executable.
- `bun run test:integration:core` runs successfully (1 pass, 3 todo, 0 fail).
- Placeholder TODO integration cases are in place for core flows from the spec.
### What was tried:
- Ran `bun test` before setup and confirmed there were no tests (`No tests found!`).
- Added `test` and `test:integration:core` scripts in `package.json`.
- Added `tests/integration/core-platform.integration.test.ts` and reran:
- `bun test tests/integration/core-platform.integration.test.ts`
- `bun test`
- `bun run test:integration:core`
### What's blocked:
- Core domain modules and workflows (entries/tasks/projects/checkpoints persistence paths) are not implemented yet, so real end-to-end behavior assertions cannot be written.
- No app runtime/composition root exists yet for integration bootstrapping beyond test scaffolding.
### Needs human intervention:
- None currently.
### Suggested tickets:
- `feat(core): implement first executable core slice (Entry -> Task triage workflow) with Effect services and persistence boundary`
- `test(core): replace TODO integration placeholders with executable end-to-end assertions for Entry/Task/Project/Checkpoint lifecycle`
- `chore(testing): add shared integration test harness (fixtures, deterministic clock/ids, isolated storage setup/teardown)`

## api
### Status: PARTIALLY SET UP
### What works:
- Bun integration test discovery now finds and runs `tests/integration/api-data.integration.test.ts`.
- A smoke test confirms the API/Data integration suite is wired and executable.
- `bun run test:integration:api` runs successfully (1 pass, 3 todo, 0 fail).
### What was tried:
- Reviewed `docs/design.spec.md` API/Data workflow requirements (capture -> persist, pending approval, explicit outbound approval, local-first data).
- Added `tests/integration/api-data.integration.test.ts` with initial TODO integration cases for API/Data behavior.
- Added `test:integration:api` script in `package.json`.
- Ran:
- `bun run test:integration:api`
- `bun test`
### What's blocked:
- BLOCKED: Cannot validate real API contract or persistence lifecycle because API/data modules (services, repositories, composition root) are not implemented yet.
- BLOCKED: No concrete outbound integration adapters exist, so explicit approval and sync execution behavior cannot be exercised end-to-end.
- BLOCKED: No restartable test harness (isolated storage + rehydrate bootstrap) exists yet to verify local-first durability behavior.
### Needs human intervention:
- None currently.
### Suggested tickets:
- `feat(api): implement core API/Data slice for Entry capture -> persistence -> AI suggestion retrieval with Effect services`
- `feat(api): add outbound sync approval pipeline and adapter interface for explicit-approval execution`
- `test(api): build integration harness for isolated storage, app bootstrap, and restart/rehydration assertions`

## workflow
### Status: PARTIALLY SET UP
### What works:
- Bun integration test discovery now finds and runs `tests/integration/workflow-automation.integration.test.ts`.
- A smoke test confirms the Workflow and Automation integration suite is wired and executable.
- `bun run test:integration:workflow` runs successfully (1 pass, 4 todo, 0 fail).
### What was tried:
- Reviewed workflow requirements in `docs/design.spec.md` section 5 (`Planning loop`, `Outbound approval`, `Automation run`, `AI-applied recovery`).
- Added `tests/integration/workflow-automation.integration.test.ts` with TODO integration cases aligned to required end-to-end workflows.
- Added `test:integration:workflow` script in `package.json`.
- Ran:
- `bun run test:integration:workflow`
- `bun test`
### What's blocked:
- BLOCKED: Cannot validate real workflow state transitions (complete/defer/reschedule) because task/event planning domain services are not implemented yet.
- BLOCKED: Cannot test explicit approval gating end-to-end because outbound draft/sync execution pipeline and adapters are not implemented.
- BLOCKED: Cannot exercise automation inspect/retry/fix lifecycle because job runner and failure state model do not exist yet.
- BLOCKED: Cannot verify AI keep/recover behavior because auditable AI-write log and rollback/recovery paths are not implemented.
### Needs human intervention:
- None currently.
### Suggested tickets:
- `feat(workflow): implement planning loop service with explicit task/event state transitions and persisted schedule updates`
- `feat(workflow): implement outbound approval gate and execution pipeline with adapter contract`
- `feat(workflow): implement job automation runner with history, failure diagnostics, and retry controls`
- `feat(workflow): implement AI change audit log with keep/recover rollback workflow`
- `test(workflow): replace workflow TODO integration placeholders with executable end-to-end assertions using shared harness fixtures`
