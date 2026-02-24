# global-command-capture-entry-pipeline Plan: Global Command Capture and Entry Pipeline (TDD First)

## Overview of the approach
Implement a headless command-capture pipeline (no UI component coupling) that:
1. Registers a global shortcut via a port interface.
2. Parses command-style input and submits capture through existing core capture services.
3. Persists Entry immediately with `capturedAt` + `source: "command"`.
4. Records richer capture context (`shortcut`, `originViewId`, `rawInput`) in audit metadata for traceability.
5. Exposes Inbox-facing untriaged query helpers so captured entries are visible immediately after write.
6. Preserves draft text on write failures and returns actionable retry errors.

This keeps implementation core-first and leverages existing `captureEntry` + transaction boundaries in `CorePlatform`.

## TDD step order (tests before implementation)
Each step is atomic: one failing test, then one function/route implementation.

1. **Test (RED):** `tests/unit/workflow/capture/command-parser.test.ts` -> `parseCommandCaptureInput` accepts plain text and `/capture` form.
   **Implement (GREEN):** `src/workflow/capture/command-parser.ts` -> `parseCommandCaptureInput(rawInput: string): Effect.Effect<ParsedCommandCapture, CommandCaptureParseError>`.
2. **Test (RED):** `tests/unit/workflow/capture/command-parser.test.ts` -> parser rejects empty/whitespace or command-without-body with actionable message.
   **Implement (GREEN):** `src/workflow/capture/command-parser.ts` -> `CommandCaptureParseError` and validation branches.
3. **Test (RED):** `tests/unit/workflow/capture/command-capture.test.ts` -> `registerGlobalCommandCaptureShortcut` registers default accelerator and invokes `onOpen` when triggered.
   **Implement (GREEN):** `src/workflow/capture/command-capture.ts` -> `registerGlobalCommandCaptureShortcut(...)`.
4. **Test (RED):** `tests/unit/workflow/capture/command-capture.test.ts` -> `makeInMemoryCommandCaptureDraftStore` saves/loads/clears by session id.
   **Implement (GREEN):** `src/workflow/capture/command-capture.ts` -> `makeInMemoryCommandCaptureDraftStore(): CommandCaptureDraftStore`.
5. **Test (RED):** `tests/unit/core/domain/entry.test.ts` -> `createEntry` supports `source: "command"` and keeps `capturedAt` deterministic.
   **Implement (GREEN):** `src/core/domain/entry.ts` -> extend `EntrySource` union and `CreateEntryInput.source`.
6. **Test (RED):** `tests/unit/core/services/entry-service.test.ts` -> `captureEntry` persists `source: "command"` and appends capture-context metadata into capture audit transition.
   **Implement (GREEN):** `src/core/services/entry-service.ts` -> extend `CaptureEntryInput` with `source?` and `captureContext?`, thread into `createEntry` + `createAuditTransition`.
7. **Test (RED):** `tests/unit/api/workflows/routes.test.ts` -> `capture.entry` accepts optional `source` and optional `captureContext` payload, still rejects invalid shapes.
   **Implement (GREEN):** `src/api/workflows/routes.ts` -> extend `validateCaptureEntryRequest(...)` parser for `source` and `captureContext`.
8. **Test (RED):** `tests/unit/workflow/capture/command-capture.test.ts` -> `submitCommandCapture` parses raw input and delegates to `platform.captureEntry` with command source + capture context.
   **Implement (GREEN):** `src/workflow/capture/command-capture.ts` -> `submitCommandCapture(...)`.
9. **Test (RED):** `tests/unit/workflow/capture/command-capture.test.ts` -> successful submit clears draft for session.
   **Implement (GREEN):** `src/workflow/capture/command-capture.ts` -> clear draft only after successful persistence.
10. **Test (RED):** `tests/unit/workflow/capture/command-capture.test.ts` -> write failure returns actionable `CommandCaptureSubmissionError` and preserves draft text.
    **Implement (GREEN):** `src/workflow/capture/command-capture.ts` -> error mapping and no-clear failure path.
11. **Test (RED):** `tests/unit/api/inbox/inbox-queries.test.ts` -> `listInboxUntriaged` returns captured/suggested entries and untriaged signals.
    **Implement (GREEN):** `src/api/inbox/inbox-queries.ts` -> `listInboxUntriaged(...)` with in-memory filtering.
12. **Test (RED):** `tests/unit/api/inbox/inbox-queries.test.ts` -> Inbox ordering is deterministic (`occurredAt desc`, then `id desc`) across mixed entry/signal rows.
    **Implement (GREEN):** `src/api/inbox/inbox-queries.ts` -> stable sorting + optional pagination (`limit`, `beforeAt`).
13. **Integration Test (RED):** `tests/integration/capture-to-inbox.test.ts` -> global shortcut trigger + command submit results in persisted Entry immediately visible via `listInboxUntriaged`.
    **Implement (GREEN):** wire command-capture module to `buildCorePlatform()` in test helpers; fix glue code only.
14. **Integration Test (RED):** `tests/integration/capture-to-inbox.test.ts` -> forced write error keeps draft and supports retry that later succeeds.
    **Implement (GREEN):** finalize failure path behavior in `submitCommandCapture` and error messaging contract.
15. **Contract/Docs Test (RED):** `tests/integration/api-contract-docs.integration.test.ts` and route contract assertions stay green with capture payload extension.
    **Implement (GREEN):** `docs/contracts/workflow-api-schema-contract.md` update `capture.entry` request/response row to include optional `source` + `captureContext`.

## Files to create/modify (with specific function signatures)

### Create
- `src/workflow/capture/command-parser.ts`
  - `export interface ParsedCommandCapture { content: string; rawInput: string; command: "capture" }`
  - `export class CommandCaptureParseError extends Data.TaggedError("CommandCaptureParseError")<{ message: string; code: "invalid_request" }>`
  - `export const parseCommandCaptureInput(rawInput: string): Effect.Effect<ParsedCommandCapture, CommandCaptureParseError>`
- `src/workflow/capture/command-capture.ts`
  - `export interface GlobalShortcutRegistrar { registerGlobalShortcut(accelerator: string, onTrigger: () => void): Effect.Effect<() => void, unknown> }`
  - `export interface CommandCaptureDraftStore { saveDraft(sessionId: string, draft: string): Effect.Effect<void>; loadDraft(sessionId: string): Effect.Effect<string | undefined>; clearDraft(sessionId: string): Effect.Effect<void> }`
  - `export class CommandCaptureSubmissionError extends Data.TaggedError("CommandCaptureSubmissionError")<{ message: string; code: "invalid_request" | "persistence"; draftText: string; retryable: true }>`
  - `export const makeInMemoryCommandCaptureDraftStore(): CommandCaptureDraftStore`
  - `export const registerGlobalCommandCaptureShortcut(registrar: GlobalShortcutRegistrar, onOpen: () => void, accelerator?: string): Effect.Effect<() => void, CommandCaptureSubmissionError>`
  - `export const submitCommandCapture(platform: Pick<CorePlatform, "captureEntry">, draftStore: CommandCaptureDraftStore, input: SubmitCommandCaptureInput): Effect.Effect<Entry, CommandCaptureSubmissionError | CommandCaptureParseError>`
- `src/api/inbox/inbox-queries.ts`
  - `export interface ListInboxUntriagedInput { limit?: number; beforeAt?: Date }`
  - `export type InboxItem = InboxEntryItem | InboxSignalItem`
  - `export const listInboxUntriaged(platform: Pick<CorePlatform, "listEntities">, input?: ListInboxUntriagedInput): Effect.Effect<ReadonlyArray<InboxItem>, InboxQueriesError>`
- `tests/unit/workflow/capture/command-parser.test.ts`
- `tests/unit/workflow/capture/command-capture.test.ts`
- `tests/unit/api/inbox/inbox-queries.test.ts`
- `tests/integration/capture-to-inbox.test.ts`

### Modify
- `src/core/domain/entry.ts`
  - `EntrySource` add `"command"`.
  - `CreateEntryInput` keep optional `source?: EntrySource`.
- `src/core/services/entry-service.ts`
  - `CaptureEntryInput` add `source?: EntrySource` and `captureContext?: { shortcut?: string; originViewId?: string; rawInput?: string }`.
  - `captureEntry(repository, input)` writes capture-context metadata into the capture audit transition.
- `src/core/app/core-platform.ts`
  - keep `captureEntry(input: CaptureEntryInput)` surface; no UI coupling added.
- `src/api/workflows/routes.ts`
  - `validateCaptureEntryRequest` accepts optional `source` + optional `captureContext`.
- `tests/unit/core/domain/entry.test.ts`
- `tests/unit/core/services/entry-service.test.ts`
- `tests/unit/api/workflows/routes.test.ts`
- `docs/contracts/workflow-api-schema-contract.md`
  - update capture route payload contract for new optional fields.

## Tests to write

### Unit tests
- Parser:
  - parses plain text and explicit `/capture` command.
  - rejects empty command payloads with actionable parse errors.
- Shortcut + draft store:
  - shortcut registration calls open handler from any invoking context.
  - draft store save/load/clear semantics are deterministic.
- Capture submission:
  - submit delegates to `captureEntry` with `source: "command"` and capture context metadata.
  - success clears draft.
  - persistence failure returns retryable error and preserves draft.
- Core capture persistence:
  - `createEntry` accepts command source.
  - `captureEntry` persists source and capture-context audit metadata.
- Inbox query:
  - untriaged entries/signals are returned.
  - mixed rows are sorted deterministically and paginated correctly.
- API validation:
  - `capture.entry` route validation accepts/normalizes optional `source` and `captureContext`.
  - malformed `captureContext` fields fail with `validation` error semantics.

### Integration tests
- `capture-to-inbox` happy path:
  - register shortcut -> trigger open callback -> submit command -> persisted Entry exists -> Inbox query returns new untriaged item immediately.
- `capture-to-inbox` failure path:
  - inject write failure -> actionable error is surfaced -> draft remains available -> retry succeeds and Inbox now contains captured entry.

## Risks and mitigations
1. **Risk:** Global shortcut behavior can vary by host runtime.
   **Mitigation:** keep shortcut logic behind `GlobalShortcutRegistrar` port and test behavior via deterministic fakes.
2. **Risk:** Backend ordering differences (`in-memory` vs `sqlite`) could produce flaky Inbox assertions.
   **Mitigation:** sort in `listInboxUntriaged` by normalized timestamp + id, not repository insertion order.
3. **Risk:** Capture metadata contract drifts between parser, service, and route validation.
   **Mitigation:** add focused tests at parser layer, route layer, and service layer with one canonical `captureContext` shape.
4. **Risk:** Draft recovery regressions on partial failure.
   **Mitigation:** keep “clear draft only on success” invariant in a dedicated test and an integration failure/retry test.
5. **Risk:** Workflow contract doc drift.
   **Mitigation:** update canonical contract doc in same slice and run `api-contract-docs` integration checks.

## How to verify against acceptance criteria
1. **Global keyboard shortcut opens command capture from any view**
   - `tests/unit/workflow/capture/command-capture.test.ts` asserts shortcut registration + trigger -> open callback.
2. **Submitting capture persists Entry with timestamp and source metadata**
   - `tests/unit/core/services/entry-service.test.ts` and `tests/integration/capture-to-inbox.test.ts` assert `capturedAt` + `source: "command"` persistence.
3. **Captured Entries are queryable by Inbox immediately**
   - `tests/integration/capture-to-inbox.test.ts` asserts immediate visibility via `listInboxUntriaged`.
4. **Write failures provide actionable feedback and preserve draft for retry**
   - unit + integration failure tests assert retryable error text and unchanged draft state.
5. **Integration tests validate capture-to-Inbox flow and error recovery**
   - `tests/integration/capture-to-inbox.test.ts` includes both happy-path and failure/retry scenarios.

## Verification commands for this slice
- `bun test tests/unit/workflow/capture/command-parser.test.ts`
- `bun test tests/unit/workflow/capture/command-capture.test.ts`
- `bun test tests/unit/api/inbox/inbox-queries.test.ts`
- `bun test tests/unit/core/services/entry-service.test.ts`
- `bun test tests/unit/api/workflows/routes.test.ts`
- `bun test tests/integration/capture-to-inbox.test.ts`
- `bun test tests/integration/api-contract-docs.integration.test.ts`
- `bun run typecheck`
