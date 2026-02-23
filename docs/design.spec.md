# Origin Design Spec (Minimal, Complete, Low-Prescription)

Status: Draft

## 1. Product summary
Origin is a local-first personal command center for one user. It captures raw input and external signals, converts them into structured work, and keeps an actionable near-term plan.

## 2. Product goals
- Fast capture and triage with low cognitive load.
- Reliable planning and execution for the next 3-21 days.
- Explicit user control for risky/outbound actions.
- Auditability and recovery for AI-applied changes.

## 3. Core domain objects
- Entry (raw capture)
- Task
- Event
- Project
- Note
- Signal
- Job
- Notification
- View (saved query/filter)
- Memory
- Checkpoint

## 4. Required user-facing views
- Plan: combined timeline for tasks + events.
- Inbox: untriaged entries/signals and AI suggestions.
- Tasks: full task lifecycle and filtering.
- Events: local events, pending approvals, conflicts.
- Projects: grouped work context.
- Notes: durable linked notes.
- Signals: external feed triage and conversion.
- Jobs: automation status/history/run controls.
- Notifications: actionable failures/approvals/due items.
- Search: global cross-entity search.
- Settings: integrations, AI preferences, defaults, safety.
- Activity: auditable log of AI changes and actions.

## 5. Required end-to-end workflows
- Capture -> persist -> AI suggestion -> user accept/edit/reject -> structured entity.
- Signal ingestion -> triage -> convert to task/event/note/project or outbound draft.
- Planning loop -> adjust schedule -> complete/defer/reschedule.
- Local event -> pending approval -> external sync on explicit approval.
- Outbound draft -> explicit approval -> execute.
- Automation run -> inspect -> retry/fix.
- AI-applied update -> inspect -> keep/recover.

## 6. UX requirements (non-prescriptive)
- Keyboard-first navigation.
- Command-style quick capture always available.
- Consistent create/edit/filter/sort patterns.
- Clear empty/loading/error states.
- Visible save/sync/error feedback.
- Entity linking across tasks/projects/notes/events/signals.
- Undo/recovery where practical.
- Basic accessibility baseline.

## 7. Scope boundaries
Must have:
- Local-first authored data.
- Core workflows above complete and reliable.
- Explicit approval for outbound actions.
- Auditable, reversible AI writes.

Out of scope for initial delivery:
- Team collaboration.
- Mandatory cloud-first architecture.
- Autonomous outbound posting/sending without approval.

## 8. Intentionally unspecified
- Exact internal architecture and module layout.
- Exact UI component hierarchy and visual style.
- Exact prompting/model/provider internals.
