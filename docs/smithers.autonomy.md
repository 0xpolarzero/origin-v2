# Smithers-Driven Autonomous Implementation Plan

Status: Required execution model for Origin v2  
Constraint: We only have Codex CLI for unattended implementation.

## 0. Preflight Requirement (Mandatory)

Before any implementation work starts, agents must understand Smithers behavior from local reference source:

- Local source path: `references/smithers`
- Minimum required reading: execution model, workflow components, CLI-agent integration, JJ/revert behavior, and production project structure
- If Smithers behavior is unclear for a workflow decision, stop and resolve that ambiguity first

## 1. Confirmed Smithers Model (from source/docs)

Smithers is the orchestration runtime for autonomous work:

- Workflow is a React component tree (execution graph, not UI).
- Tasks are durable and schema-validated (Zod) with persisted outputs.
- Engine re-renders after each step and resumes from persisted state.
- `Sequence`, `Parallel`, `Branch`, and `Ralph` compose deterministic execution.
- Approval gates are first-class for risky actions.
- `jj` pointers can be captured per attempt to support revert/debug.

This matches our need for agentic, resumable, fully-auditable implementation.

## 2. Project-Level Agentic Goal

Given specs/docs/references, agents should be able to:

- Plan work end-to-end.
- Implement core features.
- Run tests and validations.
- Review/fix iteratively until acceptance criteria are met.
- Produce auditable reports without manual supervision.

## 3. Execution Policy

- Primary implementation agent path: Codex CLI (via Smithers CLI-agent integration).
- AI/provider integration in app code: pi-mono with Codex/ChatGPT subscription as primary route.
- Every implementation task must include explicit test commands and expected pass criteria.
- Every workflow run must emit structured outputs for traceability.

## 4. Mandatory Pipeline Shape

Define Smithers workflows that enforce this order:

1. Discover
2. Plan
3. Core Implement
4. Core Validate (tests, typecheck, lint, integration checks)
5. Review
6. Review Fix
7. Report

Use `Ralph` loops for `implement -> validate -> review -> fix` until objective approval criteria are satisfied or max iterations is reached.

## 5. Core-First UI Gate

- UI tasks are blocked until all targeted core features for that slice are implemented and fully tested.
- Workflow should encode this as a hard gate (branch condition), not as a soft convention.

## 6. Suggested Workflow Layout

Use Smithers production structure (adapted from upstream patterns):

```text
automation/smithers/
  workflow.tsx
  smithers.ts
  agents.ts
  config.ts
  system-prompt.ts
  preload.ts
  components/
  prompts/
```

## 7. Prompt and Schema Discipline

- Keep prompts in MDX (`prompts/`, `components/*.mdx`).
- Keep each task output schema in `components/*.schema.ts`.
- Keep workflow composition thin; place task logic in components.
- Ensure schemas include fields for changed files, commands run, results, and unresolved risks.

## 8. Human Interaction Model

- Default mode is autonomous execution.
- Human input is required only for explicit approval gates, ambiguity in requirements, or policy conflicts.
- If ambiguity blocks correctness, stop and ask for clarification immediately.
