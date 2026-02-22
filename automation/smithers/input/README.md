# Smithers Campaign Inputs

Use these inputs in order for full app delivery:

1. `campaign-01-core-foundation.json`
2. `campaign-02-ui-integration.json`
3. `campaign-03-hardening-and-fixes.json`
4. `campaign-04-readiness.json`

Run a campaign:

```bash
cd ../
bun run run -- ./input/campaign-01-core-foundation.json
```

Resume a run:

```bash
bun run resume -- <run-id>
```

Recommended rule:
- Do not run campaign 2+ until campaign 1 has stable passing core validation.
