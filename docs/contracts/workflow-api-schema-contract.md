# Workflow API + Persisted Schema Contract

This is the canonical workflow contract for API behavior and persisted-schema guarantees.
Legacy compatibility docs:

- `docs/contracts/workflow-api-routes.md`
- `docs/contracts/persisted-schema.md`

## Route Matrix

| Route Key                              | Method | Path                                                     |
| -------------------------------------- | ------ | -------------------------------------------------------- |
| capture.entry                          | POST   | /api/workflows/capture/entry                             |
| capture.suggest                        | POST   | /api/workflows/capture/suggest                           |
| capture.editSuggestion                 | POST   | /api/workflows/capture/edit-suggestion                   |
| capture.rejectSuggestion               | POST   | /api/workflows/capture/reject-suggestion                 |
| capture.acceptAsTask                   | POST   | /api/workflows/capture/accept-as-task                    |
| signal.ingest                          | POST   | /api/workflows/signal/ingest                             |
| signal.triage                          | POST   | /api/workflows/signal/triage                             |
| signal.convert                         | POST   | /api/workflows/signal/convert                            |
| planning.completeTask                  | POST   | /api/workflows/planning/complete-task                    |
| planning.deferTask                     | POST   | /api/workflows/planning/defer-task                       |
| planning.rescheduleTask                | POST   | /api/workflows/planning/reschedule-task                  |
| approval.requestEventSync              | POST   | /api/workflows/approval/request-event-sync               |
| approval.requestOutboundDraftExecution | POST   | /api/workflows/approval/request-outbound-draft-execution |
| approval.approveOutboundAction         | POST   | /api/workflows/approval/approve-outbound-action          |
| job.create                             | POST   | /api/workflows/job/create                                |
| job.recordRun                          | POST   | /api/workflows/job/record-run                            |
| job.inspectRun                         | POST   | /api/workflows/job/inspect-run                           |
| job.list                               | POST   | /api/workflows/job/list                                  |
| job.listHistory                        | POST   | /api/workflows/job/list-history                          |
| job.retry                              | POST   | /api/workflows/job/retry                                 |
| checkpoint.create                      | POST   | /api/workflows/checkpoint/create                         |
| checkpoint.inspect                     | POST   | /api/workflows/checkpoint/inspect                        |
| checkpoint.keep                        | POST   | /api/workflows/checkpoint/keep                           |
| checkpoint.recover                     | POST   | /api/workflows/checkpoint/recover                        |
| activity.list                          | POST   | /api/workflows/activity/list                             |

## Route Payload Schema Matrix

`ActorRef` fields: `id:string (required)`, `kind:one-of[user, system, ai] (required)`.
Date-like fields accept either `Date` or ISO-8601 strings with timezone.

| Route Key                              | Request Required Fields                                                                                                                                                                                        | Request Optional Fields                                                                                                                     | Success Response Fields                                                                                                                                                                                                 |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| capture.entry                          | `content:string (required, non-empty)`, `actor:ActorRef (required)`                                                                                                                                           | `entryId:string`, `at:date-like`                                                                                                           | `Entry { id:string, content:string, source:string, status:string, capturedAt:string, createdAt:string, updatedAt:string, suggestedTaskTitle?:string, suggestionUpdatedAt?:string, rejectionReason?:string, acceptedTaskId?:string }` |
| capture.suggest                        | `entryId:string (required)`, `suggestedTitle:string (required)`, `actor:ActorRef (required)`                                                                                                                 | `at:date-like`                                                                                                                             | `Entry { ... }`                                                                                                                                                                                                         |
| capture.editSuggestion                 | `entryId:string (required)`, `suggestedTitle:string (required)`, `actor:ActorRef (required)`                                                                                                                 | `at:date-like`                                                                                                                             | `Entry { ... }`                                                                                                                                                                                                         |
| capture.rejectSuggestion               | `entryId:string (required)`, `actor:ActorRef (required)`                                                                                                                                                      | `reason:string`, `at:date-like`                                                                                                            | `Entry { ... }`                                                                                                                                                                                                         |
| capture.acceptAsTask                   | `entryId:string (required)`, `actor:ActorRef (required)`                                                                                                                                                      | `taskId:string`, `title:string`, `at:date-like`                                                                                            | `Task { id:string, title:string, description?:string, status:string, scheduledFor?:string, dueAt?:string, projectId?:string, sourceEntryId?:string, completedAt?:string, deferredUntil?:string, createdAt:string, updatedAt:string }` |
| signal.ingest                          | `source:string (required, non-empty)`, `payload:string (required, non-empty)`, `actor:ActorRef (required)`                                                                                                  | `signalId:string`, `at:date-like`                                                                                                          | `Signal { id:string, source:string, payload:string, triageState:string, triageDecision?:string, convertedEntityType?:string, convertedEntityId?:string, createdAt:string, updatedAt:string }`                      |
| signal.triage                          | `signalId:string (required)`, `decision:string (required)`, `actor:ActorRef (required)`                                                                                                                      | `at:date-like`                                                                                                                             | `Signal { ... }`                                                                                                                                                                                                        |
| signal.convert                         | `signalId:string (required)`, `targetType:one-of[task, event, note, project, outbound_draft] (required)`, `actor:ActorRef (required)`                                                                      | `targetId:string`, `at:date-like`                                                                                                          | `ConvertedEntityRef { entityType:string, entityId:string }`                                                                                                                                                            |
| planning.completeTask                  | `taskId:string (required)`, `actor:ActorRef (required)`                                                                                                                                                       | `at:date-like`                                                                                                                             | `Task { ... }`                                                                                                                                                                                                          |
| planning.deferTask                     | `taskId:string (required)`, `until:date-like (required)`, `actor:ActorRef (required)`                                                                                                                        | `at:date-like`                                                                                                                             | `Task { ... }`                                                                                                                                                                                                          |
| planning.rescheduleTask                | `taskId:string (required)`, `nextAt:date-like (required)`, `actor:ActorRef (required)`                                                                                                                       | `at:date-like`                                                                                                                             | `Task { ... }`                                                                                                                                                                                                          |
| approval.requestEventSync              | `eventId:string (required, non-empty)`, `actor:ActorRef (required)`                                                                                                                                           | `at:date-like`                                                                                                                             | `{ event: Event { id:string, title:string, startAt:string, endAt?:string, syncState:string, createdAt:string, updatedAt:string }, notification: Notification { id:string, type:string, message:string, status:string, relatedEntityType?:string, relatedEntityId?:string, createdAt:string, updatedAt:string } }` |
| approval.requestOutboundDraftExecution | `draftId:string (required, non-empty)`, `actor:ActorRef (required)`                                                                                                                                           | `at:date-like`                                                                                                                             | `{ draft: OutboundDraft { id:string, payload:string, sourceSignalId:string, status:string, executionId?:string, createdAt:string, updatedAt:string }, notification: Notification { ... } }`                         |
| approval.approveOutboundAction         | `actionType:one-of[event_sync, outbound_draft] (required)`, `entityType:string (required)`, `entityId:string (required, non-empty)`, `approved:boolean (required)`, `trustedActor:ActorRef (required via auth/session or verified signed internal context)`          | `actor:ActorRef (payload optional; when supplied it must exactly match trustedActor)`, `at:date-like`                                                                                       | `{ approved:true, executed:true, executionId:string }`                                                                                                                                                                 |
| job.create                             | `name:string (required, non-empty)`                                                                                                                                                                            | `jobId:string`, `actor:ActorRef`, `at:date-like`                                                                                           | `Job { id:string, name:string, runState:string, retryCount:number, lastRunAt?:string, lastSuccessAt?:string, lastFailureAt?:string, lastFailureReason?:string, diagnostics?:string, createdAt:string, updatedAt:string }` |
| job.recordRun                          | `jobId:string (required, non-empty)`, `outcome:one-of[succeeded, failed] (required)`, `diagnostics:string (required)`, `actor:ActorRef (required)`                                                         | `at:date-like`                                                                                                                             | `Job { ... }`                                                                                                                                                                                                           |
| job.inspectRun                         | `jobId:string (required, non-empty)`                                                                                                                                                                           | `none`                                                                                                                                      | `{ jobId:string, runState:string, retryCount:number, diagnostics?:string, lastFailureReason?:string }`                                                                                                                |
| job.list                               | `none`                                                                                                                                                                                                         | `runState:one-of[idle, running, succeeded, failed, retrying]`, `limit:positive-integer`, `beforeUpdatedAt:date-like`                    | `Array<JobListItem { id:string, name:string, runState:string, retryCount:number, lastRunAt?:string, lastSuccessAt?:string, lastFailureAt?:string, lastFailureReason?:string, diagnostics?:string, createdAt:string, updatedAt:string }>` |
| job.listHistory                        | `jobId:string (required)`                                                                                                                                                                                      | `limit:positive-integer`, `beforeAt:date-like`                                                                                             | `Array<JobRunHistoryRecord { id:string, jobId:string, outcome:one-of[succeeded, failed], diagnostics:string, retryCount:number, actor:{ id:string, kind:one-of[user, system, ai] }, at:string, createdAt:string }>` |
| job.retry                              | `jobId:string (required, non-empty)`, `actor:ActorRef (required)`                                                                                                                                             | `at:date-like`, `fixSummary:string (non-empty)`                                                                                            | `Job { ... }`                                                                                                                                                                                                           |
| checkpoint.create                      | `name:string (required)`, `snapshotEntityRefs:Array<{ entityType:string, entityId:string }> (required)`, `auditCursor:number (required)`, `rollbackTarget:string (required, non-empty)`, `actor:ActorRef (required)` | `checkpointId:string`, `at:date-like`                                                                                                      | `Checkpoint { id:string, name:string, snapshotEntityRefs:Array<EntityReference>, snapshotEntities:Array<{ entityType:string, entityId:string, existed:boolean, state:unknown }>, auditCursor:number, rollbackTarget:string, status:string, createdAt:string, updatedAt:string, recoveredAt?:string }` |
| checkpoint.inspect                     | `checkpointId:string (required, non-empty)`                                                                                                                                                                    | `none`                                                                                                                                      | `Checkpoint { ... }`                                                                                                                                                                                                    |
| checkpoint.keep                        | `checkpointId:string (required, non-empty)`, `actor:ActorRef (required)`                                                                                                                                      | `at:date-like`                                                                                                                             | `Checkpoint { ... }`                                                                                                                                                                                                    |
| checkpoint.recover                     | `checkpointId:string (required, non-empty)`, `actor:ActorRef (required)`                                                                                                                                      | `at:date-like`                                                                                                                             | `{ checkpoint: Checkpoint { ... }, recoveredEntityRefs:Array<{ entityType:string, entityId:string }>, rollbackTarget:string }`                                                                                       |
| activity.list                          | `none`                                                                                                                                                                                                         | `entityType:string (non-empty)`, `entityId:string (non-empty)`, `actorKind:one-of[user, system, ai]`, `aiOnly:boolean`, `limit:positive-integer`, `beforeAt:date-like` | `Array<ActivityFeedItem { id:string, entityType:string, entityId:string, fromState:string, toState:string, actor:{ id:string, kind:one-of[user, system, ai] }, reason:string, at:string, metadata?:Record<string,string> }>` |

## Shared Validation Rules

- Date fields accept either a Date instance or an ISO-8601 string with timezone (`Z` or offset).
- Timezone-less date strings are rejected by route validators.
- Fields documented as non-empty strings reject blank values after trimming.
- Positive integer fields (for example list limits) must be integers greater than zero.
- `approval.approveOutboundAction` binds actor identity from trusted actor context (`auth.sessionActor` or verified `auth.signedInternalActor`) instead of trusting payload identity.
- For trusted-actor routes, payload `actor` is optional for compatibility and is treated as a strict equality assertion; mismatches are rejected as spoof attempts (`403`).

## Service Error to API Status Mapping

| Service Error Code | API Error Code | HTTP Status |
| ------------------ | -------------- | ----------- |
| invalid_request    | validation     | 400         |
| forbidden          | forbidden      | 403         |
| conflict           | conflict       | 409         |
| not_found          | not_found      | 404         |
| unknown            | unknown        | 400         |

## HTTP Dispatcher Contract

- Unknown route path returns `404`.
- Unsupported method for a known path returns `405`.
- Trusted actor context is required for trusted routes (`approval.approveOutboundAction`).
- Signed internal actor context requires configured verification; missing verifier or verification failure returns `403`.
- Payload actor spoof attempts (payload/context mismatch) on trusted routes return sanitized `403` failures before route handler execution.
- Dispatcher injects the resolved trusted actor into routed request bodies before validation/handler execution.
- Mapped route failures return a sanitized body shape: `{ error, route, message }`.
- Unexpected dispatch defects return `500` with a generic internal server error message.

## Migration Ledger

| Migration ID                 |
| ---------------------------- |
| 001_core_schema              |
| 002_core_constraints_indexes |
| 003_relation_integrity       |
| 004_audit_entity_versions    |
| 005_job_run_history          |
| 006_checkpoint_audit_cursor_integer |

## Table Column Matrix

| Table             | Columns                                                                                                                                           |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| audit_transitions | id, entity_type, entity_id, from_state, to_state, actor_id, actor_kind, reason, at, metadata                                                      |
| checkpoint        | id, name, snapshot_entity_refs, snapshot_entities, audit_cursor, rollback_target, status, created_at, updated_at, recovered_at                    |
| entity_versions   | entity_type, entity_id, latest_version, updated_at                                                                                                |
| entry             | id, content, source, status, captured_at, created_at, updated_at, suggested_task_title, suggestion_updated_at, rejection_reason, accepted_task_id |
| event             | id, title, start_at, end_at, sync_state, created_at, updated_at                                                                                   |
| job               | id, name, run_state, retry_count, last_run_at, last_success_at, last_failure_at, last_failure_reason, diagnostics, created_at, updated_at         |
| job_run_history   | id, job_id, outcome, diagnostics, retry_count, actor_id, actor_kind, at, created_at                                                               |
| memory            | id, key, value, source, confidence, created_at, updated_at                                                                                        |
| memory_key_index  | id, key, memory_id, updated_at                                                                                                                    |
| note              | id, body, linked_entity_refs, created_at, updated_at                                                                                              |
| notification      | id, type, message, status, related_entity_type, related_entity_id, created_at, updated_at                                                         |
| outbound_draft    | id, payload, source_signal_id, status, execution_id, created_at, updated_at                                                                       |
| project           | id, name, description, lifecycle, created_at, updated_at                                                                                          |
| schema_migrations | id, name, checksum, applied_at                                                                                                                    |
| signal            | id, source, payload, triage_state, triage_decision, converted_entity_type, converted_entity_id, created_at, updated_at                            |
| task              | id, title, description, status, scheduled_for, due_at, project_id, source_entry_id, completed_at, deferred_until, created_at, updated_at          |
| view              | id, name, query, filters, created_at, updated_at                                                                                                  |

## Persisted Table Detail Matrix

| Table             | Column Contracts                                                                                                                                                                                                                                                                                     | Relation + Trigger Notes                                                                                                                                                                          |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| audit_transitions | `id:TEXT(optional)`, `entity_type:TEXT(required)`, `entity_id:TEXT(required)`, `from_state:TEXT(required)`, `to_state:TEXT(required)`, `actor_id:TEXT(required)`, `actor_kind:TEXT(required)`, `reason:TEXT(required)`, `at:TEXT(required)`, `metadata:TEXT(optional)`                         | `audit_transitions_entity_type_check_insert` and `audit_transitions_entity_ref_check_insert` validate entity references; `audit_transitions_entity_versions_after_insert` maintains `entity_versions`. |
| checkpoint        | `id:TEXT(optional)`, `name:TEXT(required)`, `snapshot_entity_refs:TEXT(required, default='[]')`, `snapshot_entities:TEXT(required, default='[]')`, `audit_cursor:INTEGER(required)`, `rollback_target:TEXT(required)`, `status:TEXT(required)`, `created_at:TEXT(required)`, `updated_at:TEXT(required)`, `recovered_at:TEXT(optional)` | `checkpoint_status_check_insert/update` enforce lifecycle and `checkpoint_audit_cursor_integer_check_insert/update` enforce integer-only `audit_cursor`; delete guard trigger protects notification related-entity references.                                                               |
| entity_versions   | `entity_type:TEXT(required)`, `entity_id:TEXT(required)`, `latest_version:INTEGER(required)`, `updated_at:TEXT(required)`                                                                                                                                                                         | Primary key is `(entity_type, entity_id)` and rows are upserted by `audit_transitions_entity_versions_after_insert`.                                                                            |
| entry             | `id:TEXT(optional)`, `content:TEXT(required)`, `source:TEXT(required)`, `status:TEXT(required)`, `captured_at:TEXT(required)`, `created_at:TEXT(required)`, `updated_at:TEXT(required)`, `suggested_task_title:TEXT(optional)`, `suggestion_updated_at:TEXT(optional)`, `rejection_reason:TEXT(optional)`, `accepted_task_id:TEXT(optional)` | `entry_status_check_insert/update` enforce lifecycle; `entry_accepted_task_id_check_insert/update` enforce task references; delete guards protect task and notification references.              |
| event             | `id:TEXT(optional)`, `title:TEXT(required)`, `start_at:TEXT(required)`, `end_at:TEXT(optional)`, `sync_state:TEXT(required)`, `created_at:TEXT(required)`, `updated_at:TEXT(required)`                                                                                                          | `event_sync_state_check_insert/update` enforce lifecycle; delete guards protect signal-conversion and notification references.                                                                  |
| job               | `id:TEXT(optional)`, `name:TEXT(required)`, `run_state:TEXT(required)`, `retry_count:INTEGER(required)`, `last_run_at:TEXT(optional)`, `last_success_at:TEXT(optional)`, `last_failure_at:TEXT(optional)`, `last_failure_reason:TEXT(optional)`, `diagnostics:TEXT(optional)`, `created_at:TEXT(required)`, `updated_at:TEXT(required)` | `job_run_state_check_insert/update` enforce lifecycle; delete guards protect notification and `job_run_history` references.                                                                     |
| job_run_history   | `id:TEXT(optional)`, `job_id:TEXT(required)`, `outcome:TEXT(required)`, `diagnostics:TEXT(required)`, `retry_count:INTEGER(required)`, `actor_id:TEXT(required)`, `actor_kind:TEXT(required)`, `at:TEXT(required)`, `created_at:TEXT(required)`                                                | `job_run_history_job_id_check_*` enforce parent job existence; `job_run_history_outcome_check_*` and `job_run_history_actor_kind_check_*` enforce enum contracts.                              |
| memory            | `id:TEXT(optional)`, `key:TEXT(required)`, `value:TEXT(required)`, `source:TEXT(required)`, `confidence:REAL(required)`, `created_at:TEXT(required)`, `updated_at:TEXT(required)`                                                                                                              | `memory_confidence_range_check_insert/update` enforce `[0,1]` confidence range; delete guards protect `memory_key_index` and notification references.                                          |
| memory_key_index  | `id:TEXT(optional)`, `key:TEXT(required)`, `memory_id:TEXT(required)`, `updated_at:TEXT(required)`                                                                                                                                                                                                 | `uq_memory_key_index_key` unique index enforces one row per key; `memory_key_index_memory_id_check_insert/update` enforce backing `memory` row.                                               |
| note              | `id:TEXT(optional)`, `body:TEXT(required)`, `linked_entity_refs:TEXT(required, default='[]')`, `created_at:TEXT(required)`, `updated_at:TEXT(required)`                                                                                                                                           | Delete guards protect signal-conversion and notification references that target notes.                                                                                                           |
| notification      | `id:TEXT(optional)`, `type:TEXT(required)`, `message:TEXT(required)`, `status:TEXT(required)`, `related_entity_type:TEXT(optional)`, `related_entity_id:TEXT(optional)`, `created_at:TEXT(required)`, `updated_at:TEXT(required)`                                                             | `notification_status_check_insert/update` enforce lifecycle; `notification_related_entity_pair/type/target_*` enforce valid optional relation pairs and target existence across entity tables. |
| outbound_draft    | `id:TEXT(optional)`, `payload:TEXT(required)`, `source_signal_id:TEXT(required)`, `status:TEXT(required)`, `execution_id:TEXT(optional)`, `created_at:TEXT(required)`, `updated_at:TEXT(required)`                                                                                              | `outbound_draft_status_check_insert/update` enforce lifecycle; `outbound_draft_source_signal_id_check_insert/update` enforce signal relation; delete guards protect references.                |
| project           | `id:TEXT(optional)`, `name:TEXT(required)`, `description:TEXT(optional)`, `lifecycle:TEXT(required)`, `created_at:TEXT(required)`, `updated_at:TEXT(required)`                                                                                                                                    | `project_lifecycle_check_insert/update` enforce lifecycle; delete guards protect task, signal-conversion, and notification references.                                                          |
| schema_migrations | `id:TEXT(optional)`, `name:TEXT(required)`, `checksum:TEXT(required)`, `applied_at:TEXT(required)`                                                                                                                                                                                                 | Migration ledger is append-only and checksummed by the sqlite migration runner.                                                                                                                  |
| signal            | `id:TEXT(optional)`, `source:TEXT(required)`, `payload:TEXT(required)`, `triage_state:TEXT(required)`, `triage_decision:TEXT(optional)`, `converted_entity_type:TEXT(optional)`, `converted_entity_id:TEXT(optional)`, `created_at:TEXT(required)`, `updated_at:TEXT(required)`              | `signal_triage_state_check_insert/update` enforce lifecycle; `signal_converted_entity_pair/type/target_*` enforce conversion relation integrity; delete guards protect outbound and notification references. |
| task              | `id:TEXT(optional)`, `title:TEXT(required)`, `description:TEXT(optional)`, `status:TEXT(required)`, `scheduled_for:TEXT(optional)`, `due_at:TEXT(optional)`, `project_id:TEXT(optional)`, `source_entry_id:TEXT(optional)`, `completed_at:TEXT(optional)`, `deferred_until:TEXT(optional)`, `created_at:TEXT(required)`, `updated_at:TEXT(required)` | `task_status_check_insert/update` enforce lifecycle; `task_project_id_check_*` and `task_source_entry_id_check_*` enforce relations; delete guards protect entry/signal/notification references. |
| view              | `id:TEXT(optional)`, `name:TEXT(required)`, `query:TEXT(required)`, `filters:TEXT(required, default='{}')`, `created_at:TEXT(required)`, `updated_at:TEXT(required)`                                                                                                                               | Delete guard trigger protects notification related-entity references pointing at views.                                                                                                           |

## Trigger Behavior Matrix

| Trigger Scope                                              | Enforced Contract                                                                                                                |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `task_status_check_insert`, `task_status_check_update`     | `task.status` must remain one of the allowed lifecycle states.                                                                  |
| `event_sync_state_check_insert`, `event_sync_state_check_update` | `event.sync_state` must stay in the declared sync lifecycle enum.                                                               |
| `project_lifecycle_check_insert`, `project_lifecycle_check_update` | `project.lifecycle` must stay in the declared lifecycle enum.                                                                   |
| `entry_status_check_insert`, `entry_status_check_update`   | `entry.status` transitions remain in the allowed entry lifecycle domain.                                                        |
| `signal_triage_state_check_insert`, `signal_triage_state_check_update` | `signal.triage_state` must stay in the declared triage lifecycle enum.                                                          |
| `job_run_state_check_insert`, `job_run_state_check_update` | `job.run_state` remains in the allowed run-state enum.                                                                          |
| `notification_status_check_insert`, `notification_status_check_update` | `notification.status` remains in the allowed notification lifecycle enum.                                                       |
| `checkpoint_status_check_insert`, `checkpoint_status_check_update` | `checkpoint.status` remains in the allowed checkpoint lifecycle enum.                                                           |
| `checkpoint_audit_cursor_integer_check_insert`, `checkpoint_audit_cursor_integer_check_update` | `checkpoint.audit_cursor` values must be SQLite integers on insert/update.                                                      |
| `outbound_draft_status_check_insert`, `outbound_draft_status_check_update` | `outbound_draft.status` remains in the allowed draft lifecycle enum.                                                            |
| `memory_confidence_range_check_insert`, `memory_confidence_range_check_update` | `memory.confidence` must remain in `[0.0, 1.0]`.                                                                                |
| `task_project_id_check_*`, `task_source_entry_id_check_*`, `entry_accepted_task_id_check_*`, `outbound_draft_source_signal_id_check_*`, `memory_key_index_memory_id_check_*` | Optional relation ids, when present, must point to existing target rows.                                                       |
| `signal_converted_entity_pair_*`, `signal_converted_entity_type_*`, `signal_converted_entity_target_*` | Converted signal target fields must be provided as valid pairs and resolve to existing entity rows of the declared type.       |
| `notification_related_entity_pair_*`, `notification_related_entity_type_*`, `notification_related_entity_target_*` | Notification related-entity fields must be provided as valid optional pairs and resolve to existing entities by type/id.       |
| `entry_delete_*`, `task_delete_*`, `event_delete_*`, `project_delete_*`, `note_delete_*`, `signal_delete_*`, `job_delete_*`, `notification_delete_*`, `view_delete_*`, `memory_delete_*`, `checkpoint_delete_*`, `outbound_draft_delete_*` | Deleting a referenced entity aborts when any dependent relation still points to that row.                                      |
| `audit_transitions_entity_type_check_insert`, `audit_transitions_entity_ref_check_insert`, `audit_transitions_entity_versions_after_insert` | Audit rows must target valid entity types/existing entities and advance per-entity version counters in `entity_versions`.      |
| `job_run_history_job_id_check_*`, `job_run_history_outcome_check_*`, `job_run_history_actor_kind_check_*`, `job_delete_job_run_history_ref_check` | Job run history rows must target a real job with valid enum fields, and parent jobs cannot be deleted while history exists.   |

## Trigger Contract

| Trigger Name                                                |
| ----------------------------------------------------------- |
| audit_transitions_entity_ref_check_insert                   |
| audit_transitions_entity_type_check_insert                  |
| audit_transitions_entity_versions_after_insert              |
| checkpoint_audit_cursor_integer_check_insert                |
| checkpoint_audit_cursor_integer_check_update                |
| checkpoint_delete_notification_related_entity_ref_check     |
| checkpoint_status_check_insert                              |
| checkpoint_status_check_update                              |
| entry_accepted_task_id_check_insert                         |
| entry_accepted_task_id_check_update                         |
| entry_delete_notification_related_entity_ref_check          |
| entry_delete_task_source_entry_ref_check                    |
| entry_status_check_insert                                   |
| entry_status_check_update                                   |
| event_delete_notification_related_entity_ref_check          |
| event_delete_signal_converted_entity_ref_check              |
| event_sync_state_check_insert                               |
| event_sync_state_check_update                               |
| job_delete_job_run_history_ref_check                        |
| job_delete_notification_related_entity_ref_check            |
| job_run_history_actor_kind_check_insert                     |
| job_run_history_actor_kind_check_update                     |
| job_run_history_job_id_check_insert                         |
| job_run_history_job_id_check_update                         |
| job_run_history_outcome_check_insert                        |
| job_run_history_outcome_check_update                        |
| job_run_state_check_insert                                  |
| job_run_state_check_update                                  |
| memory_confidence_range_check_insert                        |
| memory_confidence_range_check_update                        |
| memory_delete_memory_key_index_ref_check                    |
| memory_delete_notification_related_entity_ref_check         |
| memory_key_index_memory_id_check_insert                     |
| memory_key_index_memory_id_check_update                     |
| note_delete_notification_related_entity_ref_check           |
| note_delete_signal_converted_entity_ref_check               |
| notification_delete_notification_related_entity_ref_check   |
| notification_related_entity_pair_check_insert               |
| notification_related_entity_pair_check_update               |
| notification_related_entity_target_check_insert             |
| notification_related_entity_target_check_update             |
| notification_related_entity_type_check_insert               |
| notification_related_entity_type_check_update               |
| notification_status_check_insert                            |
| notification_status_check_update                            |
| outbound_draft_delete_notification_related_entity_ref_check |
| outbound_draft_delete_signal_converted_entity_ref_check     |
| outbound_draft_source_signal_id_check_insert                |
| outbound_draft_source_signal_id_check_update                |
| outbound_draft_status_check_insert                          |
| outbound_draft_status_check_update                          |
| project_delete_notification_related_entity_ref_check        |
| project_delete_signal_converted_entity_ref_check            |
| project_delete_task_project_ref_check                       |
| project_lifecycle_check_insert                              |
| project_lifecycle_check_update                              |
| signal_converted_entity_pair_check_insert                   |
| signal_converted_entity_pair_check_update                   |
| signal_converted_entity_target_check_insert                 |
| signal_converted_entity_target_check_update                 |
| signal_converted_entity_type_check_insert                   |
| signal_converted_entity_type_check_update                   |
| signal_delete_notification_related_entity_ref_check         |
| signal_delete_outbound_draft_source_ref_check               |
| signal_triage_state_check_insert                            |
| signal_triage_state_check_update                            |
| task_delete_entry_accepted_task_ref_check                   |
| task_delete_notification_related_entity_ref_check           |
| task_delete_signal_converted_entity_ref_check               |
| task_project_id_check_insert                                |
| task_project_id_check_update                                |
| task_source_entry_id_check_insert                           |
| task_source_entry_id_check_update                           |
| task_status_check_insert                                    |
| task_status_check_update                                    |
| view_delete_notification_related_entity_ref_check           |

## Index Contract

| Index Name                          |
| ----------------------------------- |
| idx_audit_transitions_entity_at     |
| idx_audit_transitions_entity_id_at  |
| idx_entity_versions_updated_at      |
| idx_entry_accepted_task_id          |
| idx_event_sync_state                |
| idx_job_run_history_created_at      |
| idx_job_run_history_job_id_at       |
| idx_memory_key_index_memory_id      |
| idx_notification_related_entity     |
| idx_outbound_draft_source_signal_id |
| idx_signal_converted_entity         |
| idx_task_project_id                 |
| idx_task_source_entry_id            |
| idx_task_status                     |
| uq_memory_key_index_key             |

## Traceability Matrix (Contract -> Implementation -> Tests)

| Contract Section                                | Implementation                                                                                                                         | Verification Tests                                                                                                                                                        |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Route Matrix + Validation + Error Mapping       | `src/api/workflows/contracts.ts`, `src/api/workflows/routes.ts`, `src/api/workflows/errors.ts`, `src/api/workflows/http-dispatch.ts`   | `tests/integration/api-contract-docs.integration.test.ts`, `tests/integration/workflow-api-http.integration.test.ts`, `tests/unit/api/workflows/workflow-api.test.ts`     |
| HTTP Dispatcher Contract                        | `src/api/workflows/http-dispatch.ts`                                                                                                   | `tests/integration/workflow-api-http.integration.test.ts`                                                                                                                 |
| Migration Ledger + Table/Trigger/Index Contract | `src/core/database/migrations/*.sql`, `src/core/repositories/sqlite/migrations.ts`, `src/core/repositories/sqlite/migration-runner.ts` | `tests/integration/api-contract-docs.integration.test.ts`, `tests/unit/core/repositories/sqlite-migrations.test.ts`, `tests/unit/core/repositories/sqlite-schema.test.ts` |

## Audit Verification Commands

```bash
bun test tests/unit/tooling/contract-doc-policy.test.ts
bun test tests/integration/api-contract-docs.integration.test.ts
bun test tests/integration/workflow-api-http.integration.test.ts
bun run typecheck
```
