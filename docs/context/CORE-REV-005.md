# CORE-REV-005 Research Context

## Ticket
- ID: `CORE-REV-005`
- Title: `Add and pin mandated platform dependencies`
- Category: `architecture`
- Priority: `high`
- Description: Configure and pin required stack components (Electron, TypeScript, Vite, React/shadcn, Effect, pi-mono) currently missing from `package.json`, per `docs/engineering.choices.md:7-12`.

## Relevant Files Field
- No explicit `relevantFiles` payload is present for `CORE-REV-005` in repository-stored ticket metadata.
- Evidence:
  - Ticket metadata is stored in `.super-ralph/workflow.db` under `category_review.suggested_tickets`.
  - The `CORE-REV-005` object contains `id`, `title`, `description`, `category`, and `priority`.
  - `json_type(ticket, '$.relevantFiles')` for `CORE-REV-005` resolves to null/empty.

## Paths Reviewed

| Path | Summary | Relevance to CORE-REV-005 |
| --- | --- | --- |
| `.super-ralph/generated/PROMPT.md` | Generated autonomous prompt (ticket input listed this path twice). Reiterates latest-stable+pinning requirement and core-first workflow. | Confirms non-negotiable delivery constraints for dependency pinning work. |
| `README.md` | Repo overview pointing to canonical source docs. | Confirms authoritative documents to follow for stack decisions. |
| `AGENTS.md` | Project rules require latest stable versions at implementation time, pinning, and atomic `jj` commits. | Direct process and versioning constraints for this ticket. |
| `docs/design.spec.md` | Product scope and workflows, currently core-first and local-first with strict auditability. | Explains why runtime/tooling dependencies should be added without prematurely forcing UI architecture. |
| `docs/engineering.choices.md` | Normative stack list (`Bun`, `Electron`, `TypeScript + Vite`, `React + shadcn/ui`, `Effect`, `pi-mono`). | Primary acceptance source for which dependencies must be represented in `package.json`. |
| `docs/references.md` | Reference repos expected under `docs/references/*` (Effect, pi-mono, etc.). | Confirms upstream reference sources for dependency/package decisions. |
| `docs/super-ralph.prompt.md` | Prompt mirror of generated prompt; repeats latest-stable exact pinning requirement. | Reinforces dependency pinning policy. |
| `.super-ralph/workflow.db` | Contains ticket metadata (`CORE-REV-005`) and proves `relevantFiles` is absent. | Source-of-truth evidence for ticket metadata and derived file focus. |
| `package.json` | Current direct deps: `effect`, `smithers-orchestrator`, `super-ralph`; dev deps include `typescript`; missing Electron/Vite/React/shadcn/pi-mono integration package(s). | Primary file to change for this ticket. |
| `bun.lock` | Existing lockfile already pins resolved versions for current deps. | Must be updated to keep newly added dependencies pinned/resolved. |
| `tsconfig.json` | Strict TypeScript baseline (`strict: true`, noEmit) already in place. | Confirms TS setup is present; ticket mainly adds missing platform deps. |
| `.super-ralph/generated/workflow.tsx` | Current generated fallback config has empty `PACKAGE_SCRIPTS`; unrelated to dependency pinning but useful context for existing runtime assumptions. | Secondary context; no direct dependency declaration here. |
| `docs/context/CORE-REV-004.md` | Existing research template and evidence style for architecture/testing tickets. | Format and evidence precedent for this context file. |

## External Reference Materials Reviewed

| Source | Key extracted guidance | Relevance |
| --- | --- | --- |
| `https://raw.githubusercontent.com/electron/electron/main/docs/tutorial/tutorial-2-first-app.md` | Electron tutorial installs Electron as a **devDependency** (`npm install electron --save-dev`) and emphasizes lockfile-pinned installs. | Clarifies correct dependency section for `electron` and pinning expectations. |
| `https://raw.githubusercontent.com/vitejs/vite/main/docs/guide/index.md` | Vite docs show `npm create vite@latest` with `react-ts` template and manual install `npm install -D vite`. | Confirms `vite` belongs in dev dependencies and React+TS template alignment. |
| `https://raw.githubusercontent.com/shadcn-ui/ui/main/apps/v4/content/docs/installation/vite.mdx` | shadcn Vite install flow uses React+TS via Vite and runs `npx shadcn@latest init`; `shadcn` is CLI-driven rather than a single runtime UI package. | Clarifies how to represent shadcn requirement (CLI package + generated components). |
| `https://raw.githubusercontent.com/Effect-TS/effect/main/packages/effect/README.md` | Effect core package install command is `npm install effect`; TS strict mode is required. | Confirms existing `effect` dependency is appropriate and should remain pinned. |
| `https://raw.githubusercontent.com/badlogic/pi-mono/main/README.md` | pi-mono monorepo package table includes `@mariozechner/pi-ai` and `@mariozechner/pi-agent-core`. | Confirms pi-mono integration is via scoped packages, not a top-level `pi-mono` npm package. |
| `https://raw.githubusercontent.com/badlogic/pi-mono/main/packages/ai/README.md` | Installation for AI integration package is `npm install @mariozechner/pi-ai`. | Strong candidate for satisfying `pi-mono` requirement in app deps. |

## Current Dependency Baseline (From `package.json`)
- `dependencies`
  - `effect@3.19.19`
  - `smithers-orchestrator@0.8.5`
  - `super-ralph@github:evmts/super-ralph#ef8726d`
- `devDependencies`
  - `typescript@5.9.3`
  - `bun-types@1.3.7`
  - `prettier@3.8.1`

## Gap Analysis Against `docs/engineering.choices.md:7-12`

| Mandated stack item | Current status | Notes |
| --- | --- | --- |
| Bun | Present (`packageManager: bun@1.3.7`) | Already pinned. |
| Electron | Missing | Should be added; Electron docs place it in `devDependencies`. |
| TypeScript | Present (`5.9.3`) | Already pinned exactly. |
| Vite | Missing | Should be added in `devDependencies`. |
| React | Missing | `react` + `react-dom` are expected direct deps for UI stack. |
| shadcn/ui | Missing | `shadcn` CLI package not present; components are generated into repo by CLI. |
| Effect | Present (`3.19.19`) | Already pinned exactly. |
| pi-mono | Missing as direct integration package | `pi-mono` package name is not published on npm; likely use scoped package(s), especially `@mariozechner/pi-ai`. |

## Latest Stable Version Snapshot (queried on 2026-02-23)

| Package | Latest stable | Evidence |
| --- | --- | --- |
| `electron` | `40.6.0` | `npm view electron version` |
| `typescript` | `5.9.3` | `npm view typescript version` |
| `vite` | `7.3.1` | `npm view vite version` |
| `@vitejs/plugin-react` | `5.1.4` | `npm view @vitejs/plugin-react version` |
| `react` | `19.2.4` | `npm view react version` |
| `react-dom` | `19.2.4` | `npm view react-dom version` |
| `shadcn` (CLI) | `3.8.5` | `npm view shadcn version` |
| `effect` | `3.19.19` | `npm view effect version` |
| `@mariozechner/pi-ai` | `0.54.2` | `npm view @mariozechner/pi-ai version` |

## Derived File Focus for Implementation
(derived because `relevantFiles` is absent)

### Primary files
- `package.json`
- `bun.lock`

### Potential supporting files
- `tsconfig.json` (only if Vite/React scaffolding decisions require config updates in same slice)
- `docs/context/CORE-REV-005.md` (this research artifact)

## Open Decisions / Risks for Implementation
1. **pi-mono package selection:** the ticket names `pi-mono`, but npm package is not `pi-mono`; the most direct AI package appears to be `@mariozechner/pi-ai`.
2. **shadcn representation:** shadcn is CLI-first, so dependency pinning likely means adding `shadcn` (CLI) now and generating component deps later when UI slice begins.
3. **Scope control:** this ticket should likely limit itself to dependency declarations + lockfile updates, without introducing UI scaffolding files prematurely (to preserve core-first sequencing).

## Suggested Verification for the Implementation Ticket
- `bun install` (to refresh `bun.lock` with exact resolved versions)
- `bun run typecheck`
- `bun run test` (or ticket-relevant subset if dependency changes are isolated and validated)

## Research Summary
- `CORE-REV-005` metadata has no `relevantFiles`; implementation scope must be derived from stack requirements and current dependency state.
- `package.json` already pins `typescript` and `effect`, but is missing explicit entries for `electron`, `vite`, `react`/`react-dom`, `shadcn`, and a concrete pi-mono integration package.
- Registry and upstream docs were reviewed to identify current stable versions and clarify packaging conventions (notably Electron as devDependency and pi-mono via scoped packages such as `@mariozechner/pi-ai`).
