# CORE-REV-005 Plan: Add and Pin Mandated Platform Dependencies (TDD First)

## Overview
This ticket is an architecture/configuration slice: ensure `package.json` explicitly includes the mandated platform stack from `docs/engineering.choices.md:7-12` and that every required dependency is pinned to an exact version.

Approach:
1. Add a small, pure dependency-policy helper so checks are deterministic and unit-testable.
2. Write unit tests first for policy mapping and pin validation.
3. Add integration tests that assert live repo compliance (`package.json` + `bun.lock`).
4. Only then update `package.json` and regenerate `bun.lock`.

Scope guardrails:
- No UI scaffolding or route work in this ticket.
- No behavior changes outside dependency declarations and lockfile refresh.
- Keep decisions low-prescription where the spec is not explicit.

## TDD Step Order (tests first, then implementation)

1. **Test:** `tests/unit/tooling/platform-dependency-policy.test.ts` -> `isExactVersionPin accepts exact pins and rejects ranges/tags`.
   **Implement:** `src/core/tooling/platform-dependency-policy.ts` -> `isExactVersionPin(version: string): boolean`.

2. **Test:** `tests/unit/tooling/platform-dependency-policy.test.ts` -> `buildMandatedDependencySpecs maps engineering stack requirements to concrete package names, sections, and pinned versions`.
   **Implement:** `src/core/tooling/platform-dependency-policy.ts` -> `buildMandatedDependencySpecs(versions: MandatedVersionSnapshot): readonly MandatedDependencySpec[]`.

3. **Test:** `tests/unit/tooling/platform-dependency-policy.test.ts` -> `findManifestDependencyViolations detects missing packages, wrong dependency section, and non-exact/mismatched versions`.
   **Implement:** `src/core/tooling/platform-dependency-policy.ts` -> `findManifestDependencyViolations(manifest: PackageJsonLike, specs: readonly MandatedDependencySpec[]): ManifestDependencyViolation[]`.

4. **Integration Test:** `tests/integration/platform-mandated-dependencies.integration.test.ts` -> `current package.json satisfies all mandated specs with exact versions`.
   **Implement:** modify `package.json` to add and pin missing required packages.

5. **Integration Test:** `tests/integration/platform-mandated-dependencies.integration.test.ts` -> `bun.lock contains resolved entries for each mandated package/version`.
   **Implement:** run `bun install` to refresh `bun.lock` after dependency edits.

6. **Integration Test:** `tests/integration/platform-mandated-dependencies.integration.test.ts` -> `core policy snapshot remains aligned with engineering choices source list`.
   **Implement:** add/confirm a focused test script in `package.json` (`test:integration:platform`) if needed for targeted gate execution.

7. **Verification:** run ticket-slice tests and typecheck after implementation changes.
   **Implement:** execute `bun test tests/unit/tooling/platform-dependency-policy.test.ts`, `bun test tests/integration/platform-mandated-dependencies.integration.test.ts`, and `bun run typecheck`.

## Files to Create/Modify (with specific function signatures)

### Create
- `src/core/tooling/platform-dependency-policy.ts`
  - `export type DependencySection = "dependencies" | "devDependencies"`
  - `export type PackageJsonLike = { dependencies?: Record<string, string>; devDependencies?: Record<string, string> }`
  - `export type MandatedStackItem = "electron" | "typescript" | "vite" | "react" | "shadcn" | "effect" | "pi-mono"`
  - `export type MandatedDependencySpec = { stackItem: MandatedStackItem; packageName: string; expectedSection: DependencySection; expectedVersion: string }`
  - `export type MandatedVersionSnapshot = { electron: string; typescript: string; vite: string; react: string; reactDom: string; shadcn: string; effect: string; piAi: string }`
  - `export type ManifestDependencyViolation = { packageName: string; issue: "missing" | "wrong-section" | "not-pinned" | "version-mismatch"; expectedSection: DependencySection; expectedVersion: string; actualSection?: DependencySection; actualVersion?: string }`
  - `export const isExactVersionPin: (version: string) => boolean`
  - `export const buildMandatedDependencySpecs: (versions: MandatedVersionSnapshot) => readonly MandatedDependencySpec[]`
  - `export const findManifestDependencyViolations: (manifest: PackageJsonLike, specs: readonly MandatedDependencySpec[]) => ManifestDependencyViolation[]`

- `tests/unit/tooling/platform-dependency-policy.test.ts`
- `tests/integration/platform-mandated-dependencies.integration.test.ts`

### Modify
- `package.json`
  - Add missing mandated dependencies with exact versions.
  - Keep already-pinned required entries (`typescript`, `effect`) unchanged unless a latest-stable refresh is intentionally performed.
  - Optionally add `test:integration:platform` script for targeted execution.
- `bun.lock`
  - Refresh to pin resolved versions for all newly added packages.

## Tests to Write

### Unit tests
- `tests/unit/tooling/platform-dependency-policy.test.ts`
  - `isExactVersionPin` returns `true` for exact versions like `40.6.0` and `false` for ranges/tags (`^40.6.0`, `~7.3.1`, `latest`, `github:...`).
  - `buildMandatedDependencySpecs` includes all required stack entries from `docs/engineering.choices.md:7-12` mapped to npm package names.
  - `buildMandatedDependencySpecs` maps:
    - `Electron` -> `electron` (`devDependencies`)
    - `TypeScript` -> `typescript` (`devDependencies`)
    - `Vite` -> `vite` (`devDependencies`)
    - `React + shadcn/ui` -> `react`, `react-dom` (`dependencies`) and `shadcn` (`devDependencies`)
    - `Effect` -> `effect` (`dependencies`)
    - `pi-mono` -> `@mariozechner/pi-ai` (`dependencies`)
  - `findManifestDependencyViolations` returns deterministic violations for missing package, wrong section, and mismatched/unpinned version.

### Integration tests
- `tests/integration/platform-mandated-dependencies.integration.test.ts`
  - Reads root `package.json` and asserts zero violations against mandated specs.
  - Reads root `bun.lock` and asserts each mandated package/version pair exists as a resolved lock entry.
  - (If script is added) verifies `package.json` exposes `test:integration:platform`.

## Risks and Mitigations

1. **Risk:** Ambiguity in what satisfies `pi-mono` requirement (no `pi-mono` npm package).
   **Mitigation:** encode explicit mapping to `@mariozechner/pi-ai` in policy helper + tests; document rationale inline.

2. **Risk:** `shadcn/ui` is CLI-driven and not a single runtime dependency.
   **Mitigation:** treat `shadcn` CLI as the mandated pinned package for this ticket; defer generated UI component deps to future UI tickets.

3. **Risk:** Latest versions can drift between planning and implementation.
   **Mitigation:** at implementation start, re-run version checks (`npm view <pkg> version`) and update policy snapshot before editing manifests.

4. **Risk:** Lockfile assertions can be brittle if lock format changes.
   **Mitigation:** keep integration assertions focused on package/version presence (not full lockfile structure).

5. **Risk:** Adding dependency-policy helper may feel heavier than pure manifest edits.
   **Mitigation:** keep helper minimal/pure and scoped to testability; avoid introducing runtime coupling.

## How to Verify Against Acceptance Criteria

1. **Mandated stack dependencies are configured in `package.json`**
   - Confirm integration test passes for required package set from `docs/engineering.choices.md:7-12`.

2. **Versions are pinned (exact, not ranges)**
   - Confirm unit pin-validation tests and integration compliance test both pass.

3. **Resolved versions are pinned in lockfile**
   - Confirm `bun.lock` integration assertions pass after `bun install`.

4. **Quality gates for changed slice pass**
   - Run:
     - `bun test tests/unit/tooling/platform-dependency-policy.test.ts`
     - `bun test tests/integration/platform-mandated-dependencies.integration.test.ts`
     - `bun run typecheck`

5. **Core-first remains intact**
   - Confirm no UI integration or route behavior changes are introduced in this ticket.
