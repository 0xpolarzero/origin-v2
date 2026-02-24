# Workflow API Route Contract

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

## Shared Validation Rules

- Date fields accept either a Date instance or an ISO-8601 string with timezone (`Z` or offset).
- Timezone-less date strings are rejected by route validators.
- Fields documented as non-empty strings reject blank values after trimming.
- Positive integer fields (for example list limits) must be integers greater than zero.

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
- Mapped route failures return a sanitized body shape: `{ error, route, message }`.
- Unexpected dispatch defects return `500` with a generic internal server error message.

## Source of Truth

- `src/api/workflows/contracts.ts`
- `src/api/workflows/routes.ts`
- `src/api/workflows/errors.ts`
- `src/api/workflows/http-dispatch.ts`
