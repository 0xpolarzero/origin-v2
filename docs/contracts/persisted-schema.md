# Persisted Schema Contract (Compatibility Pointer)

The canonical workflow API and persisted-schema contract now lives at:

- `docs/contracts/workflow-api-schema-contract.md`

This compatibility document is intentionally non-authoritative to prevent route/schema drift across multiple sources.

## Version + Update Guidance

- Canonical contract version source: `docs/contracts/workflow-api-schema-contract.md`.
- Current pointer verification date: `2026-02-24`.
- Do not add persisted-schema details in this compatibility file; keep all normative updates in the canonical contract.
- When the canonical contract changes, update this pointer in the same change and rerun `bun test tests/integration/api-contract-docs.integration.test.ts`.
