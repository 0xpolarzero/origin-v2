# Super Ralph Autonomous Implementation Plan

Status: Required execution model for Origin v2
Constraint: Codex CLI is our primary agent path.

## 1. Preflight

Before running campaigns:

- Read `references/super-ralph/README.md`.
- Confirm `jj` is installed and repository is jj-colocated.
- Confirm Codex CLI is authenticated and uses `gpt-5.3-codex` by default.

## 2. Execution model

Use prompt-driven campaigns via `automation/super-ralph/run.sh`.

- Campaign prompt file is the contract.
- Super Ralph generates and runs a workflow automatically.
- Built-in monitoring is displayed in terminal.

## 3. Required policy

- Core-first delivery remains mandatory.
- Implement and test core behavior before UI integration.
- Keep work deterministic and resumable.
- Use explicit validation commands per chunk.
- Commit every atomic piece of work after validation.
- Use `jj` checkpoints during longer iterative loops.

## 4. Campaign structure

Run in order:

1. Core foundation
2. UI integration
3. Hardening and fixes
4. Readiness

Do not advance to the next campaign while blocking failures remain in the current one.

## 5. Human interaction

- Default mode is autonomous execution.
- Intervene only for approvals, policy conflicts, or ambiguous requirements.
- If ambiguity risks correctness, stop and request clarification.
