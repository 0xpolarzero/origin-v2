# Engineering Choices and Guardrails

Status: Normative

## 1. Stack
Use latest stable versions at implementation time:
- Runtime/package manager: Bun
- Desktop shell: Electron
- Language/build: TypeScript + Vite
- UI: React + shadcn/ui
- Effect system: Effect (use wherever practical)
- AI integration: pi-mono (primary); Codex/ChatGPT subscription flows as primary coding path
- Agent orchestrator: Super Ralph
- Checkpointing: jj

## 2. Core-first gate (hard rule)
For any feature that appears in UI:
1. Implement core/domain logic first.
2. Add comprehensive tests for that core behavior.
3. Integrate UI only after all targeted core tests pass.

## 3. Quality requirements
- Prefer deterministic, testable core logic.
- Keep side effects at boundaries.
- Run typecheck and relevant tests on each implementation slice.
- Make small, reviewable commits.

## 4. References to study before major implementations
- https://github.com/Effect-TS/effect
- https://github.com/tim-smart/cheffect
- https://github.com/mikearnaldi/accountability
- https://github.com/jj-vcs/jj
- https://github.com/badlogic/pi-mono
- https://github.com/evmts/smithers
- https://github.com/evmts/super-ralph

## 5. Autonomous execution expectation
Super Ralph runs should be able to:
- plan work slices,
- implement in core-first order,
- validate (typecheck/tests),
- self-review and fix,
- checkpoint and commit atomic progress.
