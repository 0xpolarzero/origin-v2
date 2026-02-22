# Origin Product Requirements (Comprehensive, Low-Prescription)

Status: Draft v0.3  
Purpose: Define complete product-facing scope (features + views + workflows) while leaving implementation choices to agents.

## 1. Summary

Origin is a local-first personal command center for one user. It converts raw input and inbound signals into structured work, and keeps a reliable short-horizon plan (3-21 days) across tasks and events, with explicit approval for outbound actions.

## 2. Problem Statement

Current state:
- Capture is fast, but conversion into executable work is inconsistent.
- Signals from external tools are disconnected from planning.
- Tasks/events context is fragmented across surfaces.

User pain:
- High cognitive overhead for triage and planning.
- Repeated context switching and plan drift.
- Safety risk from accidental outbound actions.

Impact:
- Lower execution quality and slower feedback cycles.

## 3. Target User and Jobs To Be Done

Primary user:
- Single power user managing personal and project commitments.

Core jobs:
- Capture intent quickly.
- Convert intent/signals into structured work.
- Plan and execute the next 3-21 days from one place.
- Approve risky outbound actions explicitly.

## 4. Product Goals

- Minimize friction from capture to structured work.
- Keep plan quality high and continuously actionable.
- Preserve local control and auditability of AI-assisted changes.
- Keep integrations assistive, not autonomous.

## 5. Success Metrics

Product metrics:
- Fast capture-to-persist latency (target p95 <= 2s local).
- High structured conversion quality (target >= 90% without manual rewrite).
- Strong planning reliability (target >= 95% correct rendering of planned items).

Safety metrics:
- Outbound external actions require explicit approval 100% of the time.
- AI-applied changes are always traceable in activity/audit surfaces.

## 6. Required Views and Feature Surface

### 6.1 Core views (required)

- `Plan`
  - Combined timeline for tasks + events over configurable N-day horizon.
  - Fast schedule edits, complete/defer flows, clear pending vs approved event state.
- `Inbox`
  - Raw entries + untriaged items.
  - Accept/edit/reject AI suggestions.
  - Convert into tasks/events/notes/projects.
- `Tasks`
  - Full task management: status, priority, dates, project links, batch actions, filtering.
- `Events`
  - Local event create/edit.
  - Pending approval queue for external sync.
  - Approval/rejection and conflict handling.
- `Projects`
  - Project lifecycle, grouped work visibility, archive/unarchive.
- `Notes`
  - Durable note editing, linking, pin/favorite behavior, searchable content.
- `Signals`
  - Unified external feed, triage to work, archive/read controls, draft outbound actions.
- `Jobs`
  - Automation list, status, enable/disable, run-now, execution history and errors.
- `Notifications`
  - Actionable alerts for approvals, failures, due/overdue items, sync issues.
- `Search`
  - Global cross-entity search with filters and keyboard-first open.
- `Settings`
  - Integrations/auth, AI preferences, plan defaults, safety/approval behavior, shortcuts.
- `Activity`
  - Auditable trail of AI changes, approvals, job runs, and recovery actions.

### 6.2 Cross-view UX capabilities (required)

- Keyboard-first navigation and command palette.
- Fast capture path always available.
- Consistent create/edit interactions across entities.
- Consistent filters/sorting patterns.
- Clear empty/loading/error states.
- Save/sync/error feedback that is always visible.
- Entity linking (task <-> project <-> note <-> event <-> signal).
- Undo/recovery affordances where practical.
- Basic accessibility baseline (focus order, keyboard operability, readable contrast).

## 7. Required User Workflows

- Capture -> persist -> AI suggestions -> user confirms/edits -> structured entity created.
- Signal ingestion -> triage -> conversion to task/event/note/project or outbound draft.
- Planning loop -> adjust timeline -> execute -> reschedule/defer/complete.
- Local event -> pending state -> explicit approval -> external sync.
- Outbound action draft -> explicit approval -> send/post.
- Automation run -> inspect result -> retry/fix.
- AI-applied update -> inspect changes -> keep/recover.

## 8. Scope Guardrails

Must have:
- Local entry capture/storage.
- Structured objects: tasks, events, notes, projects, signals, jobs, views, memory, checkpoints.
- All required views and workflows in Sections 6 and 7.
- Explicit approval gate for outbound actions.
- Recovery path from bad writes/outputs.

Out of scope for MVP:
- Team collaboration.
- Cloud-first mandatory architecture.
- Autonomous external posting/sending.

## 9. Core Domain Objects

- `Entry`: raw input.
- `Task`: actionable work item.
- `Event`: time-bound item with pending/approved lifecycle.
- `Project`: work grouping/context.
- `Note`: durable knowledge.
- `Signal`: inbound external artifact.
- `Job`: automation definition.
- `View`: saved query/filter projection.
- `Memory`: persistent AI context.
- `Checkpoint`: restorable snapshot.

## 10. Product Rules

- Local-first authored data.
- Single-writer model per workspace.
- AI changes must be auditable and reversible.
- Pending external changes remain local until approved.
- Core flows work offline except inherently online integrations.

## 11. Acceptance Criteria

- All required views are usable for daily operation.
- All required workflows complete end-to-end with clear user feedback.
- No outbound action executes without explicit approval.
- Core planning loop is reliable and actionable.
- Recovery flow is available after bad writes/AI outputs.

## 12. Intentionally Unspecified

- Exact component hierarchy and visual style.
- Exact infrastructure and internal architecture.
- Exact prompt/model/provider implementation details.

## 13. Open Questions

- Exact AI operation payload contract and failure semantics.
- Exact approval UX for retries/errors.
- Final retention and dedup strategy for signals.
