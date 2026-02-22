# Reference Repositories Policy

Status: Required research inputs for implementation

## 1. Required Repositories

These repositories are mandatory references for architecture, patterns, and implementation quality:

- `https://github.com/Effect-TS/effect`
- `https://github.com/tim-smart/cheffect`
- `https://github.com/mikearnaldi/accountability`
- `https://github.com/jj-vcs/jj`
- `https://github.com/badlogic/pi-mono`
- `https://github.com/evmts/super-ralph/`

## 2. Local Clone Convention

Clone under `origin-v2/references/` with stable directory names:

- `references/effect`
- `references/cheffect`
- `references/accountability`
- `references/jj`
- `references/pi-mono`
- `references/super-ralph`

## 3. Bootstrap Commands

```bash
mkdir -p references

git clone --depth=1 https://github.com/Effect-TS/effect references/effect
git clone --depth=1 https://github.com/tim-smart/cheffect references/cheffect
git clone --depth=1 https://github.com/mikearnaldi/accountability references/accountability
git clone --depth=1 https://github.com/jj-vcs/jj references/jj
git clone --depth=1 https://github.com/badlogic/pi-mono references/pi-mono
git clone --depth=1 https://github.com/evmts/super-ralph references/super-ralph
```

## 4. Usage Rules

- Treat references as source material, not copy-paste targets.
- Before implementing significant behavior, inspect at least one relevant reference implementation.
- Record key reference decisions in spec/workflow outputs when they affect architecture.
- Keep references refreshable (`git pull`) and avoid modifying them locally.
