# Origin v2 Smithers Automation

This workspace runs autonomous implementation loops against the Origin v2 spec.

## Pipeline

- Discover
- Plan
- CoreImplement
- CoreValidate
- Review
- ReviewFix
- Report

The `CoreImplement -> CoreValidate -> Review -> ReviewFix` segment runs in a Ralph loop until approved or max iterations.
Plan/Implement/Report outputs also track installed skill selection/application gaps.

## Commands

```bash
bun install
bun run run
bun run run -- ./input/default.json
bun run resume -- <run-id>
bun run typecheck
```

## Agent mode

- Default: Codex CLI agent
- Optional: PI CLI agent when `SMITHERS_USE_PI=1` and `pi` command exists

## Environment

Copy `.env.example` to `.env` and adjust as needed.

## Policy

- Core-only work first.
- No UI integration unless explicitly allowed and core gates are passed.
