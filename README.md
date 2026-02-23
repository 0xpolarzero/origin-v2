# origin-v2

Minimal repo for implementing Origin with Super Ralph.

## What is in this repo

- `docs/design.spec.md` - product scope (features and views)
- `docs/engineering.choices.md` - stack and delivery guardrails
- `docs/references.md` - reference repositories to use as submodules
- `docs/super-ralph.prompt.md` - single prompt for autonomous implementation
- `AGENTS.md` - instructions for coding agents in this repo

## Run Super Ralph

```bash
bun install
bunx super-ralph ./docs/super-ralph.prompt.md
```

Super Ralph may generate runtime artifacts such as `PROGRESS.md`; they are gitignored.
