# API-006 TDD Audit Log

Date: February 24, 2026
Ticket: API-006
Phase: review fix

## Review Finding

Spec review noted that API-006 contract policy files were introduced together in commit
`85af656`, so RED-to-GREEN test-first ordering was not directly auditable from commit
history.

## TDD Evidence

### 1. Duplicate persisted schema contract entries

RED:
- Command: `bun test tests/unit/tooling/contract-doc-policy.test.ts`
- Failure: `findPersistedSchemaContractViolations reports duplicated documented values as extra rows`

GREEN:
- Command: `bun test tests/unit/tooling/contract-doc-policy.test.ts`
- Result: pass after adding multiplicity-aware matching in
  `src/core/tooling/contract-doc-policy.ts`.

### 2. Contract-doc integration tests from non-repo CWD

RED:
- Command: `bun test tests/integration/api-contract-docs.cwd.integration.test.ts`
- Failure: `ENOENT` while reading `docs/contracts/*.md` when child test process cwd was a temp directory.

GREEN:
- Command: `bun test tests/integration/api-contract-docs.cwd.integration.test.ts`
- Result: pass after deriving `repositoryRoot` from `import.meta.url` in
  `tests/integration/api-contract-docs.integration.test.ts`.

## JJ Change Mapping

- `🐛 fix(contract-doc-policy): detect duplicate persisted schema contract rows`
- `🐛 fix(api-contract-tests): make contract doc tests cwd-independent`
- `📝 docs(api-contracts): add API-006 TDD audit evidence` (this change)
