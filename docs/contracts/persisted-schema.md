# Persisted Schema Contract

## Migration Ledger

| Migration ID                 |
| ---------------------------- |
| 001_core_schema              |
| 002_core_constraints_indexes |
| 003_relation_integrity       |
| 004_audit_entity_versions    |
| 005_job_run_history          |

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

## Trigger Contract

| Trigger Name                                                |
| ----------------------------------------------------------- |
| audit_transitions_entity_ref_check_insert                   |
| audit_transitions_entity_type_check_insert                  |
| audit_transitions_entity_versions_after_insert              |
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
