# CORE-REV-DOC-001 Plan: Materialize or reconcile docs/references submodule contract (TDD First)

## Overview of the approach
This ticket resolves a contract mismatch: `docs/references.md` currently documents `docs/references/*` git submodules, but this repository has no `.gitmodules` and no `docs/references/` directory. The implementation will be TDD-first and contract-driven:

1. Add tests that fail when docs and repository reference strategy diverge.
2. Implement a small reference-doc policy module that parses the documented strategy and validates it against repository state.
3. Reconcile docs to the strategy the repo actually uses (expected default: checked-in links/remote references without local submodules), and update cross-doc wording for consistency.

If the team chooses to materialize submodules instead, the same tests support that path by requiring `.gitmodules` plus existing `docs/references/*` paths.

## TDD step order (tests before implementation)

### Phase 1: RED (write failing tests first)
1. Create unit tests for markdown parsing in `tests/unit/tooling/reference-doc-policy.test.ts`:
   - parse strategy mode (`submodules` vs `repository-links`)
   - parse repository rows and optional expected local paths
   - fail on malformed/missing required section

2. Create unit tests for contract validation in `tests/unit/tooling/reference-doc-policy.test.ts`:
   - returns no violations when docs mode and filesystem state align
   - returns `missing-gitmodules` and `missing-path` violations when mode is `submodules` but repo structure is absent
   - returns `stale-submodule-claim` when mode is non-submodule but docs still claim mandatory submodule paths

3. Create integration test `tests/integration/reference-docs-contract.integration.test.ts`:
   - reads live `docs/references.md`
   - validates repo state (`.gitmodules`, `docs/references/*`) against declared strategy
   - fails on any violation

4. Create integration test for cross-doc consistency:
   - `README.md` and `docs/super-ralph.prompt.md` reference the same strategy language as `docs/references.md`
   - fails if they still assert mandatory submodules after reconciliation

### Phase 2: GREEN (minimal implementation after failures)
5. Add `src/core/tooling/reference-doc-policy.ts` with parser + validator functions:
   - `export interface ReferenceRepository { name: string; url: string; expectedPath?: string }`
   - `export type ReferenceStrategyMode = "submodules" | "repository-links"`
   - `export interface ReferenceDocContract { mode: ReferenceStrategyMode; repositories: ReadonlyArray<ReferenceRepository> }`
   - `export const parseReferenceDocContract = (markdown: string): ReferenceDocContract`
   - `export const findReferenceDocContractViolations = (params: { contract: ReferenceDocContract; repoRoot: string }): ReadonlyArray<{ code: "missing-gitmodules" | "missing-path" | "stale-submodule-claim"; detail: string }>`

6. Reconcile docs content to chosen strategy (expected: non-submodule repository-links strategy):
   - update `docs/references.md`
   - update `README.md` wording for references section
   - update `docs/super-ralph.prompt.md` reference instructions where needed

7. If team decides to materialize submodules instead of reconciling language:
   - add `.gitmodules`
   - add `docs/references/` entries (or equivalent tracked pointers)
   - keep docs wording in explicit submodule mode

### Phase 3: REFACTOR + VERIFY
8. Refactor test helpers for deterministic filesystem fixtures (temporary directories for unit validation cases).

9. Run focused tests:
   - `bun test tests/unit/tooling/reference-doc-policy.test.ts`
   - `bun test tests/integration/reference-docs-contract.integration.test.ts`

10. Run broader regression gates:
   - `bun test tests/integration/platform-mandated-dependencies.integration.test.ts`
   - `bun run typecheck`

## Files to create/modify (with specific function signatures)

### Create
- `docs/plans/CORE-REV-DOC-001.md`
- `src/core/tooling/reference-doc-policy.ts`
  - `parseReferenceDocContract(markdown: string): ReferenceDocContract`
  - `findReferenceDocContractViolations(params: { contract: ReferenceDocContract; repoRoot: string }): ReadonlyArray<{ code: "missing-gitmodules" | "missing-path" | "stale-submodule-claim"; detail: string }>`
- `tests/unit/tooling/reference-doc-policy.test.ts`
- `tests/integration/reference-docs-contract.integration.test.ts`

### Modify
- `docs/references.md`
- `README.md`
- `docs/super-ralph.prompt.md`

## Tests to write (unit + integration)

### Unit tests
- `parseReferenceDocContract` parses explicit strategy mode and repository entries.
- `parseReferenceDocContract` throws for missing strategy heading/table.
- `findReferenceDocContractViolations` reports `missing-gitmodules` in submodule mode when `.gitmodules` is absent.
- `findReferenceDocContractViolations` reports `missing-path` for absent declared `docs/references/*` directories.
- `findReferenceDocContractViolations` reports `stale-submodule-claim` when non-submodule mode still includes mandatory submodule wording.

### Integration tests
- Live repo contract test: declared strategy in `docs/references.md` matches repository reality.
- Cross-doc wording test: `README.md` and `docs/super-ralph.prompt.md` remain consistent with `docs/references.md` strategy declaration.
- Optional hardening: if submodule mode is declared, assert each expected path is present and mapped in `.gitmodules`.

## Risks and mitigations
1. Risk: ambiguous strategy language causes parser fragility.
   Mitigation: use a clearly labeled "Reference Strategy" section with a constrained enum value (`submodules` or `repository-links`).

2. Risk: tests become brittle to copy edits.
   Mitigation: parse section/table structure and mode token instead of exact prose matching.

3. Risk: adding submodules significantly increases clone/setup complexity.
   Mitigation: default to reconciled docs strategy unless explicit requirement to vendor submodules is approved.

4. Risk: cross-doc drift reappears.
   Mitigation: keep integration consistency test as a permanent guard.

## How to verify against acceptance criteria
1. Confirm one coherent strategy is implemented:
   - Either submodule structure exists and is documented, or docs are updated to non-submodule reference strategy.

2. Run:
   - `bun test tests/unit/tooling/reference-doc-policy.test.ts`
   - `bun test tests/integration/reference-docs-contract.integration.test.ts`
   - `bun test tests/integration/platform-mandated-dependencies.integration.test.ts`
   - `bun run typecheck`

3. Acceptance mapping:
   - "Materialize docs/references submodule contract": satisfied when docs declare `submodules` and repo contains `.gitmodules` + expected paths.
   - "Reconcile docs/references strategy": satisfied when docs declare non-submodule strategy and contract tests pass with current repo state.
