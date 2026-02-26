## core
### Status: PASSING
### What works:
- `bun run test:integration:core` passes (6 pass, 0 fail) with executable in-memory Core Platform scenarios.
- `bun run test:integration:db` passes (12 pass, 0 fail) with sqlite-backed integration coverage.
- Core workflow behavior changes around persistence, approvals, checkpoints, and transaction safety are validated by passing integration suites.
### What was tried:
- Reviewed previous `core` findings in this file.
- Ran `bun run test:integration:core`.
- Ran `bun run test:integration:db`.
### What's blocked:
- None currently for Core Platform integration suites in this repository.
### Needs human intervention:
- None currently.
### Suggested tickets:
- `test(core): add end-to-end CLI/app-shell integration tests that boot the real runtime composition root`
- `test(core): add cross-process restart durability assertions for sqlite-backed core workflows`

## api
### Status: PASSING
### What works:
- `bun run test:integration:api` passes (23 pass, 0 fail) across API/Data integration suites.
- Integration tests validate `capture -> suggest -> accept/edit/reject` behavior through API handlers.
- Integration tests validate `signal ingest -> triage -> convert` flows for task, event, note, project, and outbound draft targets.
- Approval-gated outbound actions are validated for event sync and outbound drafts, including pending gating, explicit rejection, duplicate/conflict handling, and exactly-once execution.
- HTTP dispatcher integration validates route/method handling and sanitized `400/403/404/409` error payloads.
- Restart/rehydration coverage validates local-first persistence of pending approval state for both events and outbound drafts.
### What was tried:
- Reviewed previous `api` findings in this file.
- Verified current API integration coverage in:
- `tests/integration/api-data.integration.test.ts`
- `tests/integration/workflow-api.integration.test.ts`
- `tests/integration/workflow-api-http.integration.test.ts`
- Ran `bun run test:integration:api`.
- Attempted `jj describe -m "📊 test(api): update integration test findings"` for checkpointing.
### What's blocked:
- BLOCKED: Unable to checkpoint this update with `jj describe` in this environment because writing to `.git/objects` is denied (`Operation not permitted`).
### Needs human intervention:
- Need a local environment/runner with write permission to `.git/objects` so `jj describe` can create the commit object.
### Suggested tickets:
- `test(api): add adapter-backed outbound integration tests against concrete external sync adapters (beyond stubbed outbound ports)`
- `test(api): add API/Data integration matrix for in-memory, file, and sqlite repositories with shared fixtures`

## workflow
### Status: PASSING
### What works:
- `bun run test:integration:workflow` passes (11 pass, 0 fail) across workflow automation, workflow automation edge cases, and workflow surfaces suites.
- `bun test tests/integration/workflow-*.integration.test.ts` passes (39 pass, 0 fail), including workflow API/HTTP and workflow gate policy integration suites.
- Workflow and Automation behavior changes are now covered by executable assertions for planning transitions, explicit approval gating, automation retry/fix, checkpoint keep/recover, and workflow surfaces orchestration.
### What was tried:
- Reviewed previous `workflow` findings in this file.
- Inspected workflow integration suites under `tests/integration`.
- Ran:
- `bun run test:integration:workflow`
- `bun test tests/integration/workflow-*.integration.test.ts`
### What's blocked:
- None currently for Workflow and Automation integration coverage in this repository.
### Needs human intervention:
- None currently.
### Suggested tickets:
- `test(workflow): add process-level E2E harness that executes workflow routes through the real app/runtime entrypoint`
- `test(workflow): add sqlite-backed restart/recovery integration coverage for workflow automation state`
