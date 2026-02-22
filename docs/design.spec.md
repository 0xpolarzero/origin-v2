# Origin v2 Product Requirements (Minimal)

Status: Draft v0.2  
Purpose: Define a concise but complete product baseline for rebuilding Origin.

## 1. Summary

Users can capture thoughts quickly, but turning that input into reliable planned work still requires manual triage across notes, tasks, and calendar tools. Origin v2 provides a local-first personal command center that converts raw input and inbound signals into structured work and a clear 3-21 day plan, with explicit approval for outbound actions.

## 2. Problem Statement

Current state:
- Fast capture is easy; consistent conversion into executable plans is not.
- Signals (messages, emails, threads) are disconnected from planning.
- Calendar/task context is fragmented, causing missed or duplicated work.

User pain:
- High cognitive overhead to translate intent into tasks/events.
- Planning quality depends on manual discipline and context switching.
- Risk of accidental outbound actions when integrations are automated.

Impact:
- Lower execution reliability and slower decision cycles.
- Frequent plan drift across short horizons.

## 3. Target User and Jobs To Be Done

Primary user:
- Single power user managing personal work and commitments.

Core jobs:
- Capture intent in seconds.
- Convert intent/signals into structured tasks/events/notes/projects.
- Maintain a trustworthy short-horizon plan.
- Approve outbound actions safely.

## 4. Goals

- Minimize friction from capture to structured work.
- Keep planning view accurate and actionable for the next 3-21 days.
- Preserve local control and auditability of AI-assisted changes.
- Make external integrations assistive, not autonomous.

## 5. Success Metrics

Product metrics:
- Capture-to-persist latency is consistently fast (target p95 <= 2s on local machine).
- Structured conversion success is high (target >= 90% of entries converted without manual rewrite).
- Planning reliability is strong (target >= 95% of planned items/events render correctly in horizon view).

Safety metrics:
- Outbound external actions require explicit approval 100% of the time.
- All AI-applied changes are traceable to structured, reviewable records.

## 6. MVP Scope

Must have:
- Local entry capture and storage.
- Structured objects: tasks, events, notes, projects, signals, jobs, views, memory, checkpoints.
- Horizon plan view combining tasks and events.
- Signal-to-structured-work triage flow.
- Approval gate for outbound actions.
- Checkpoint restore path.

Out of scope for MVP:
- Team collaboration.
- Cloud-first mandatory architecture.
- Autonomous external posting/sending.

## 7. Core Domain Objects

- `Entry`: raw user input.
- `Task`: actionable unit with state and optional schedule window.
- `Event`: calendar unit with pending/approved lifecycle.
- `Project`: grouping for related execution.
- `Note`: durable reference content.
- `Signal`: inbound external item.
- `Job`: background automation definition.
- `View`: saved query/filter projection.
- `Memory`: persistent AI context.
- `Checkpoint`: restorable state snapshot.

## 8. Required Product Workflows

- Capture: persist entry immediately, then optionally parse/apply structured updates.
- Plan: show date-range timeline with tasks + events.
- Triage: convert signals into tasks/events/notes/drafts.
- Approval: require explicit confirmation before outbound actions.
- Recovery: restore previous known-good state from checkpoints.

## 9. Product Constraints and Rules

- Local-first authored data.
- Single-writer lease model per workspace.
- AI changes must be auditable and reversible.
- Pending events remain local until approved for external sync.
- Core flows should work offline except inherently online integrations.

## 10. Acceptance Criteria

- User can create/edit/retrieve all core objects.
- User can manage the next N days from one combined plan surface.
- User can process inbound signals into structured work.
- No outbound external action is executed without explicit approval.
- User can recover via checkpoint restore after bad write/output.

## 11. Open Questions

- Exact schema contract for AI operation payloads and failure semantics.
- Exact UX for approval and retry/failure handling.
- Final data retention/dedup policy for external signals.
