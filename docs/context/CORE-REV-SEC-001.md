# CORE-REV-SEC-001 Research Context

## Ticket
- ID: `CORE-REV-SEC-001`
- Title: `Bind workflow actor identity to trusted auth/session context`
- Category: `security`
- Priority: `critical`
- Description: `Update workflow HTTP dispatch/route handling to derive actor from authenticated request context (or signed internal context), reject spoofed payload actor identities, and add regression tests proving non-user spoofing cannot approve outbound actions.`

## Relevant Files Field
- `CORE-REV-SEC-001` is present in `.super-ralph/workflow.db` (`category_review.suggested_tickets`).
- Ticket metadata includes `id/title/category/description/priority`, but `relevantFiles` and `referenceFiles` are absent (`json_type(...)` null).
- Effective implementation scope is derived from current workflow API/dispatcher/approval sources and tests.

Example query used:

```sql
SELECT
  json_extract(value,'$.id') AS id,
  json_extract(value,'$.title') AS title,
  json_extract(value,'$.category') AS category,
  json_extract(value,'$.description') AS description,
  json_extract(value,'$.priority') AS priority,
  json_type(value,'$.relevantFiles') AS relevant_files_type,
  json_type(value,'$.referenceFiles') AS reference_files_type
FROM category_review, json_each(category_review.suggested_tickets)
WHERE json_extract(value,'$.id')='CORE-REV-SEC-001';
```

## Paths Reviewed

| Path | Summary | Relevance to CORE-REV-SEC-001 |
| --- | --- | --- |
| `.super-ralph/generated/PROMPT.md` | Generated autonomous prompt with core-first/test and outbound-approval constraints. | Confirms non-negotiable safety and testing constraints for this security slice. |
| `.super-ralph/generated/workflow.tsx` | Generated run config; `referenceFiles` for research are `PROMPT.md`, `README.md`, and `docs`. | Confirms why these paths are required inputs for this research step. |
| `README.md` | Canonical repo map, including authoritative contract docs. | Identifies normative docs that must stay aligned when API/auth behavior changes. |
| `docs/design.spec.md` | Requires explicit user control for risky/outbound actions and forbids autonomous outbound sending without approval. | Product-level requirement behind actor-trust hardening. |
| `docs/engineering.choices.md` | Core-first, deterministic logic, side effects at boundaries, and slice-level test/typecheck rules. | Implementation and verification guardrails for this ticket. |
| `docs/references.md` | Required external references under `docs/references/*`. | Declares reference policy; local submodule paths are currently absent. |
| `docs/super-ralph.prompt.md` | Canonical prompt mirrors generated constraints, including explicit outbound approval requirements. | Reinforces outbound safety requirements at workflow level. |
| `docs/contracts/workflow-api-schema-contract.md` | Canonical API+schema contract; currently defines request `actor: ActorRef` in payload matrix and dispatcher sanitization behavior. | Contract likely affected if actor shifts from payload to trusted request context. |
| `docs/contracts/workflow-api-routes.md` | Compatibility pointer to canonical contract doc. | Must be kept in sync if canonical contract metadata/date changes. |
| `docs/contracts/persisted-schema.md` | Compatibility pointer to canonical contract doc. | Same compatibility pointer constraints as routes pointer. |
| `AGENTS.md` | Repo policy: low-prescription decisions, core-first, Effect preference, jj checkpoints, atomic commits. | Process constraints for implementation phase following this research. |
| `docs/plans/API-003.md` | Prior plan that introduced current approval hardening at API boundaries. | Historical pattern for approval/auth enforcement and test targeting. |
| `docs/context/API-003.md` | Prior research context mapping current approval/error/HTTP behavior. | Useful baseline for what exists vs. what this ticket adds (trusted identity binding). |
| `src/api/workflows/http-dispatch.ts` | Dispatcher accepts `{ method, path, body }` and calls `route.handle(request.body)` with no auth/session context. | Primary trust-boundary gap; no source for trusted actor identity. |
| `src/api/workflows/contracts.ts` | Route request types currently model `actor` as payload field for many endpoints. | Type contract likely needs updates or context-aware wrapper types. |
| `src/api/workflows/routes.ts` | Route validators parse `actor` from request body (`parseActorField`) and forward it to API handlers. | Primary spoofing seam: payload actor is treated as authoritative. |
| `src/api/workflows/workflow-api.ts` | API wrappers delegate actor-bearing inputs to `CorePlatform` methods. | Needs alignment if actor derivation moves to dispatcher/request context layer. |
| `src/api/workflows/errors.ts` | Maps service/domain errors to API error codes/statuses (`forbidden`, `conflict`, etc.). | Error model surface for spoof-detection failures (likely 403/400 paths). |
| `src/core/app/core-platform.ts` | Platform delegates approval/event/outbound flows to services inside transaction boundaries. | Core execution path receiving actor once API layer resolves identity. |
| `src/core/services/approval-service.ts` | Enforces `actor.kind === "user"` for outbound approvals, explicit approval flag, and preconditions. | Current authorization check is strong but still depends on trusted actor input. |
| `src/core/services/event-service.ts` | Event sync request transition to `pending_approval` with audit actor. | Actor provenance matters for audit integrity after context binding. |
| `src/core/services/outbound-draft-service.ts` | Outbound draft approval-request transition with audit actor. | Same audit/actor provenance dependency. |
| `src/ui/workflows/workflow-surface-client.ts` | Client forwards request payloads directly to dispatcher; mutation calls include actor in body. | Likely downstream impact if actor is removed/ignored in payloads. |
| `src/ui/workflows/jobs-surface.ts` | Surface helper accepts actor for retry and forwards to client payload. | Potential call-site updates depending on request-context strategy. |
| `src/ui/workflows/activity-surface.ts` | Surface helper accepts actor for keep/recover and forwards to client payload. | Same potential impact as jobs surface. |
| `tests/unit/api/workflows/routes.test.ts` | Verifies approval validators including `actor.id` checks from payload. | Must be updated to assert trusted-context derivation and spoof rejection behavior. |
| `tests/unit/api/workflows/http-dispatch.test.ts` | Verifies path/method/status mapping and sanitized failures. | Primary unit surface for auth-context extraction and spoof regression cases. |
| `tests/unit/api/workflows/workflow-api.test.ts` | Verifies wrapper delegation and error normalization. | May require fixture/type updates if API route input contracts change. |
| `tests/integration/workflow-api-http.integration.test.ts` | HTTP-level integration for approval statuses and sanitized bodies; currently actor supplied by payload. | Key regression location for non-user spoofing cannot approve outbound actions. |
| `tests/integration/workflow-automation-edge-cases.integration.test.ts` | Integration coverage for approval denial/auth failure and no side effects; currently actor from payload. | Additional regression anchor for spoofing and no-execution guarantees. |
| `tests/integration/workflow-surfaces.integration.test.ts` | End-to-end surface integration currently posts actor values in body for mutations. | Reveals impact radius for route/dispatcher contract changes. |
| `tests/unit/ui/workflows/workflow-surface-client.test.ts` | Verifies body mapping for client methods, including actor-carrying mutation payloads. | Must align with any new auth-context-driven request shape. |
| `tests/integration/api-contract-docs.integration.test.ts` | Enforces runtime/docs contract parity and required contract sections. | Required when canonical contract docs are updated for auth-context behavior. |

## Reference Materials Reviewed (Patterns)
- `docs/references/*` submodules are not present in this workspace (`docs/references` missing), so in-repo patterns were used.
- Prior in-repo approval hardening references were used for precedent:
  - `docs/plans/API-003.md`
  - `docs/context/API-003.md`

## Current Implementation Snapshot (Security-Relevant)

1. **Actor trust boundary is payload-driven today**
   - Dispatcher does not carry auth/session identity (`src/api/workflows/http-dispatch.ts`).
   - Route validation reads `actor` directly from payload (`src/api/workflows/routes.ts`).
   - Approval/service authorization therefore consumes payload-derived actor.

2. **Approval service authorization exists but is downstream of that trust boundary**
   - `approveOutboundAction(...)` enforces `actor.kind === "user"` (`src/core/services/approval-service.ts`).
   - This blocks explicit non-user payloads, but does not prove actor authenticity.

3. **Existing tests cover forbidden non-user payloads, not spoofed identity mismatches**
   - Current integration tests assert 403 when payload actor is `system` for approval routes.
   - There is no regression test where authenticated/internal context is non-user but payload claims user identity.

4. **Contract/docs currently encode payload actor as required request field**
   - Canonical route payload matrix documents `actor: ActorRef` for most mutating routes (`docs/contracts/workflow-api-schema-contract.md`).
   - Any shift to trusted request context will require contract+parity test updates.

## Security Gaps This Ticket Should Close
- No first-class authenticated request context in workflow HTTP dispatch.
- No signed internal context path for trusted non-user actors (system/ai) at dispatcher boundary.
- No mismatch detection between payload actor and trusted context actor.
- No regression tests proving spoofed payload actors cannot approve outbound actions when trusted context actor is non-user.

## Derived File Focus for Implementation
(derived because ticket metadata has no `relevantFiles`)

### Primary implementation surfaces
- `src/api/workflows/http-dispatch.ts`
- `src/api/workflows/contracts.ts`
- `src/api/workflows/routes.ts`
- `src/api/workflows/workflow-api.ts`
- `src/api/workflows/errors.ts`

### Core authorization/audit validation surfaces
- `src/core/services/approval-service.ts`
- `src/core/services/event-service.ts`
- `src/core/services/outbound-draft-service.ts`
- `src/core/app/core-platform.ts`

### Contract and parity surfaces
- `docs/contracts/workflow-api-schema-contract.md`
- `docs/contracts/workflow-api-routes.md`
- `docs/contracts/persisted-schema.md`
- `tests/integration/api-contract-docs.integration.test.ts`

### Regression test surfaces
- `tests/unit/api/workflows/http-dispatch.test.ts`
- `tests/unit/api/workflows/routes.test.ts`
- `tests/unit/api/workflows/workflow-api.test.ts`
- `tests/integration/workflow-api-http.integration.test.ts`
- `tests/integration/workflow-automation-edge-cases.integration.test.ts`
- `tests/integration/workflow-surfaces.integration.test.ts`
- `tests/unit/ui/workflows/workflow-surface-client.test.ts`

## Regression Cases to Add During Implementation
1. Approval route request with trusted non-user auth context and spoofed payload user actor is rejected (no outbound execution).
2. Approval route request with trusted user auth context and mismatched payload actor is rejected as spoof attempt.
3. Approval route request without trusted auth/internal context cannot rely on payload actor for authorization.
4. Signed internal context path is accepted only when signature/context verification passes.
5. Rejected spoof attempts return sanitized error bodies and do not mutate approval state or audit transitions as approved/executed.

## Open Questions for Implementation Phase
1. Should payload `actor` be fully removed from approval-route request schema, or retained only for strict equality checks against trusted context?
2. Should trusted context derivation apply only to approval routes or uniformly to all actor-bearing workflow mutation routes?
3. What exact signed-internal-context format/verification primitive should be used in this codebase (and where should secrets/keys live)?
4. For routes with currently optional actor (`job.create`), should trusted context be mandatory, optional with explicit fallback, or disallowed for external calls?

## Research Summary
- `CORE-REV-SEC-001` has no ticket-provided `relevantFiles`; scope is derived from workflow API/dispatcher/contracts/tests.
- Current workflow HTTP boundary trusts payload `actor`; this is the key spoofing risk seam.
- Approval service authorization (`user`-only) exists, but it does not establish actor authenticity without trusted request context.
- Highest-impact implementation path is to add trusted auth/session (or signed internal) context at dispatcher/route boundary, reject actor spoof mismatches, and lock behavior with approval-specific spoofing regressions.
