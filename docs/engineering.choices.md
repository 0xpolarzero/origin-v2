# Engineering Choices and Guardrails

Status: Normative for Origin v2

## 1. Technology Choices

Use latest stable versions at implementation time, pinned in lockfiles:

- Runtime/package manager: `bun`
- Desktop shell: `electron`
- Language/build: `typescript`, `vite`
- UI: `react`, `shadcn/ui`
- Effect system: `effect` (Effect-TS) wherever possible
- AI integration: `pi-mono` primarily, with Codex/ChatGPT subscription workflows as primary coding path
- Orchestration for autonomous implementation: `super-ralph` (prompt-driven), with `smithers-orchestrator` as runtime dependency
- Checkpoint/revert VCS: `jj` (Jujutsu)

## 2. Version Policy

- Default policy is `latest stable` for all selected technologies.
- Pin exact resolved versions in lockfiles and document major version shifts.
- When scaffolding, verify current latest versions first; do not rely on stale templates.

## 3. Architecture Policy

- Core-first delivery is mandatory.
- Build and finalize core domain logic, services, and tests before UI integration.
- UI is a thin adapter over already-tested core behavior.
- Prefer Effect primitives for async work, errors, retries, scheduling, and concurrency.
- Keep side effects at boundaries; keep core logic deterministic and testable.

## 4. Testing Gate (Non-Negotiable)

For any feature that will appear in UI:

- Implement core behavior first.
- Add comprehensive tests for that behavior (unit + integration + contract as applicable).
- Only integrate into UI after all related core tests are complete and passing.

No exception: UI work does not start until the full targeted core feature set is thoroughly tested.

## 5. Delivery Principles

- Prefer small, reviewable increments.
- Keep behavior explicit in specs and tests.
- Treat regressions as workflow failures that must be closed before new scope.
