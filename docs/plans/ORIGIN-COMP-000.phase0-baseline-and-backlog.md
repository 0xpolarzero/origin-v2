# ORIGIN-COMP-000 Plan: Baseline, Requirement Matrix, and Core-First Backlog

## Phase 0 baseline verification (2026-02-27)
- `bun run typecheck`: pass
- `bun test`: pass (`608 passed`, `0 failed`, `77 files`)
- `bun run build`: pass

## Requirement matrix (docs/super-ralph.prompt.md + docs/design.spec.md + docs/engineering.choices.md + docs/references.md)

| Requirement | Evidence | Status | Gap to close |
| --- | --- | --- | --- |
| Core-first delivery per slice | Existing services/tests precede many workflow surfaces (`src/core/services/*`, `tests/unit/core/*`) | Partial | Enforceable gate policy exists but not wired to every remaining completion ticket outcome |
| Use Bun + Electron + TypeScript + Vite + React + shadcn + Effect + pi-mono | `package.json`, `src/core/services/ai/pi-ai-runtime.ts` | Partial | pi-mono runtime is implemented but not fully wired into interactive workflows |
| Local-first authored data | `src/core/app/core-platform.ts`, sqlite repositories/migrations | Partial | Runtime app bootstrap still defaults to in-memory when no db path provided |
| Required domain objects | `src/core/domain/*` + migrations | Green | None |
| Required views: Plan, Inbox, Tasks, Events, Projects, Notes, Signals, Jobs, Notifications, Search, Settings, Activity | Surface loaders exist (`src/ui/workflows/*-surface.ts`) | Partial | React shell does not expose full interactive multi-view experience |
| Required workflows (7) from design spec | Workflow routes/services + integration tests exist | Partial | Several flows are core/API-only and not fully user-executable via UI controls |
| Explicit outbound approval before action | `approval-service.ts`, routes + tests | Green | Preserve behavior while expanding UI |
| Auditability and reversibility for AI writes | Checkpoint + activity services/routes/tests | Partial | AI runtime traces are not consistently persisted across AI-assisted actions |
| UX requirements (keyboard-first, command capture, state feedback, accessibility baseline, linking, undo/recovery affordances) | Minimal shell + workflow surface tests | Partial | Most UX requirements not implemented in React shell |
| References policy using docs/references.md repository-links strategy | `tests/integration/reference-docs-contract.integration.test.ts` | Green | Keep evidence updated for major decisions |

## Explicit missing/partial scope to turn GREEN
1. Full interactive app shell with all required views and navigation.
2. CRUD/lifecycle operations needed for fully usable Tasks/Events/Projects/Notes/Notifications views.
3. AI runtime wiring (pi-mono) into capture suggestion and job retry/fix paths with deterministic fallback semantics.
4. UX completeness: keyboard-first, global command capture, consistent feedback states, accessibility baseline.
5. End-to-end UI workflow coverage for all required workflows.
6. Delivery-process gate enforcement evidence for strict slice flow.
7. Local-first desktop bootstrap defaults to sqlite-backed persistence.

## Ticketized backlog (core-first ordering + dependencies)

### Ticket ORIGIN-PLATFORM-001: Default desktop runtime to sqlite local-first storage
- Scope:
  - Bootstrap app platform with sqlite repository by default in desktop runtime.
  - Run migrations on init and ensure graceful close behavior in renderer lifecycle.
- Dependencies: none.
- DoD:
  - Desktop app sessions persist authored data across restarts.
  - Existing in-memory behavior remains available for tests.
- Targeted gates:
  - `bun run typecheck`
  - `bun test tests/unit/app-shell/bootstrap.test.ts tests/integration/database-core-platform.integration.test.ts`
- Commit boundary:
  - `feat: default desktop app bootstrap to sqlite local-first storage`

### Ticket ORIGIN-CORE-001: Missing core CRUD/lifecycle operations
- Scope:
  - Add task create/update/list filtering/sorting operations needed by UI.
  - Add event create/update + conflict-query operations.
  - Add project create/update/lifecycle operations.
  - Add note create/update/link/unlink operations.
  - Add notification dismiss/ack operations.
  - Add richer query/list operations for view filters/sorts where missing.
- Dependencies: ORIGIN-PLATFORM-001.
- DoD:
  - Core services and typed errors implemented.
  - Unit tests cover happy paths + error semantics.
  - No UI changes in this ticket.
- Targeted gates:
  - `bun run typecheck`
  - `bun test tests/unit/core/services`
- Commit boundary:
  - `feat: add core CRUD and lifecycle services for required entities`

### Ticket ORIGIN-API-001: Workflow API + route contract completion
- Scope:
  - Extend route keys/contracts/routes/http dispatch/workflow api for ORIGIN-CORE-001 operations.
  - Update route contract docs:
    - `docs/contracts/workflow-api-routes.md`
    - `docs/contracts/workflow-api-schema-contract.md`
- Dependencies: ORIGIN-CORE-001.
- DoD:
  - All new operations exposed through validated routes.
  - Contract tests/documentation updated and passing.
- Targeted gates:
  - `bun run typecheck`
  - `bun test tests/unit/api/workflows tests/integration/workflow-api.integration.test.ts tests/integration/workflow-api-http.integration.test.ts`
- Commit boundary:
  - `feat: extend workflow API routes for required entity operations`

### Ticket ORIGIN-AI-001: Capture suggestion AI orchestration wiring
- Scope:
  - Wire pi-mono runtime into capture suggestion path.
  - Persist suggestion trace metadata for auditability.
  - Add deterministic fallback when runtime fails/times out.
- Dependencies: ORIGIN-API-001.
- DoD:
  - Capture suggestion can be AI-generated from UI/API path.
  - Failure path is deterministic and safe.
- Targeted gates:
  - `bun run typecheck`
  - `bun test tests/unit/core/services/ai tests/unit/core/services/entry-service.test.ts tests/integration/workflow-api.integration.test.ts`
- Commit boundary:
  - `feat: wire pi-mono capture suggestions with fallback and trace metadata`

### Ticket ORIGIN-AI-002: Job retry AI fix summary wiring
- Scope:
  - Wire pi-mono runtime into job retry/fix summary path.
  - Persist trace metadata to activity/audit.
  - Add deterministic fallback semantics.
- Dependencies: ORIGIN-AI-001.
- DoD:
  - Retry path supports optional AI-generated fix summary end-to-end.
- Targeted gates:
  - `bun run typecheck`
  - `bun test tests/unit/core/services/job-service.test.ts tests/unit/core/services/ai/pi-ai-runtime.test.ts tests/integration/workflow-surfaces.integration.test.ts`
- Commit boundary:
  - `feat: add ai-assisted job retry fix summary orchestration`

### Ticket ORIGIN-SETTINGS-001: AI runtime config persistence and defaults
- Scope:
  - Persist provider/model/limits/timeout settings via settings/memory services.
  - Apply safe defaults and validation.
- Dependencies: ORIGIN-AI-001.
- DoD:
  - Settings changes influence runtime selection deterministically.
- Targeted gates:
  - `bun run typecheck`
  - `bun test tests/unit/ui/workflows tests/integration/required-view-surfaces.integration.test.ts`
- Commit boundary:
  - `feat: persist and apply ai runtime settings with safe defaults`

### Ticket ORIGIN-UI-SHELL-001: Full app shell architecture
- Scope:
  - Replace minimal shell with multi-view navigation for all required views.
  - Add global status/toast/error boundary channel.
  - Keep desktop-first layout with acceptable mobile fallback.
- Dependencies: ORIGIN-API-001.
- DoD:
  - All required views are reachable in UI.
  - App-level loading/init/failure states are clear.
- Targeted gates:
  - `bun run typecheck`
  - `bun test tests/unit/app-shell tests/integration/ui-interactive-workflows.integration.test.ts`
- Commit boundary:
  - `feat: implement full multi-view interactive app shell`

### Ticket ORIGIN-UI-WF-001: Inbox/Plan/Tasks/Events interactive controls
- Scope:
  - Real controls for capture/suggest/accept/reject, timeline actions, task/event CRUD + transitions.
- Dependencies: ORIGIN-UI-SHELL-001, ORIGIN-API-001.
- DoD:
  - These views can complete their required workflows entirely from UI.
- Targeted gates:
  - `bun run typecheck`
  - `bun test tests/unit/ui/workflows tests/integration/ui-interactive-workflows.integration.test.ts`
- Commit boundary:
  - `feat: add interactive inbox plan tasks and events workflows`

### Ticket ORIGIN-UI-WF-002: Projects/Notes/Signals/Jobs/Notifications/Search/Settings/Activity interactivity
- Scope:
  - Add full controls for remaining required views, including deep linking and recovery actions.
- Dependencies: ORIGIN-UI-WF-001, ORIGIN-SETTINGS-001.
- DoD:
  - Every required view is user-usable with create/edit/filter/sort/action controls.
- Targeted gates:
  - `bun run typecheck`
  - `bun test tests/unit/ui/workflows tests/integration/required-view-surfaces.integration.test.ts tests/integration/workflow-surfaces.integration.test.ts`
- Commit boundary:
  - `feat: complete interactive workflows for remaining required views`

### Ticket ORIGIN-UX-001: UX + accessibility completeness
- Scope:
  - Keyboard-first navigation, global command capture, consistent loading/empty/error/success feedback, baseline accessibility labels/focus/live regions.
- Dependencies: ORIGIN-UI-WF-002.
- DoD:
  - UX requirements in design spec are explicitly implemented and tested.
- Targeted gates:
  - `bun run typecheck`
  - `bun test tests/unit/ui tests/integration/ui-interactive-workflows.integration.test.ts tests/integration/required-view-surfaces.integration.test.ts`
- Commit boundary:
  - `feat: implement keyboard-first ux and accessibility baseline across views`

### Ticket ORIGIN-E2E-001: Required workflow end-to-end validation
- Scope:
  - Expand integration suite to verify the 7 required workflows via UI/API path with deterministic negative cases.
- Dependencies: ORIGIN-UI-WF-002, ORIGIN-AI-002.
- DoD:
  - Each required workflow has at least one full-path passing test and one failure/edge-path test.
- Targeted gates:
  - `bun run typecheck`
  - `bun test tests/integration/ui-interactive-workflows.integration.test.ts tests/integration/workflow-surfaces.integration.test.ts tests/integration/workflow-api.integration.test.ts`
- Commit boundary:
  - `feat: add end-to-end coverage for required interactive workflows`

### Ticket ORIGIN-PROCESS-001: Delivery behavior hardening
- Scope:
  - Strengthen gate policy/test coverage for plan->implement->test->review->commit flow and core-first attestations.
- Dependencies: ORIGIN-E2E-001.
- DoD:
  - Workflow process checks fail fast on policy violations and remain deterministic.
- Targeted gates:
  - `bun run typecheck`
  - `bun test tests/unit/workflow tests/integration/workflow-gate-policy.integration.test.ts`
- Commit boundary:
  - `chore: harden workflow gate policy and traceability enforcement`

### Ticket ORIGIN-DOCS-001: Final evidence and signoff docs
- Scope:
  - Update final requirement-to-evidence mapping and test findings.
- Dependencies: all previous tickets.
- DoD:
  - Every requirement from `docs/super-ralph.prompt.md` and `docs/design.spec.md` maps to file + test evidence.
  - Residual risk list is empty or explicitly justified.
- Targeted gates:
  - `bun run typecheck`
  - `bun test`
  - `bun run build`
- Commit boundary:
  - `docs: publish final requirement evidence and completion report`

## Phase exit criteria checklist
- [x] Baseline `typecheck` pass
- [x] Baseline `test` pass
- [x] Baseline `build` pass
- [x] Requirement matrix with status and evidence
- [x] Ordered backlog with dependencies
- [x] Per-ticket DoD, targeted test gates, and commit boundary definitions
