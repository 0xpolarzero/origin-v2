# E2E Test Implementation Prompt

## Goal
Implement comprehensive Playwright E2E tests for the Origin web app that verify all UI functionality works correctly from a user's perspective.

## Project Context

Origin is a local-first personal command center built with:
- React + TypeScript
- Vite (dev server on http://localhost:5173)
- Effect-TS for state management
- Basic CSS (no component library)

## UI Structure

The app has a sidebar navigation with 12 views:
- **Inbox** - Entry capture, AI suggestions, signal triage
- **Plan** - Combined timeline of tasks + events
- **Tasks** - Task lifecycle management
- **Events** - Calendar events with sync approvals
- **Projects** - Project management with lifecycle states
- **Notes** - Note editor with entity linking
- **Signals** - External feed ingestion
- **Jobs** - Automation status/history
- **Notifications** - Actionable items
- **Search** - Global cross-entity search
- **Settings** - AI configuration (enable, provider, model)
- **Activity** - Audit log

## Key Workflows to Test

### 1. Capture → Suggest → Accept Flow
```
User types in capture input → Entry created → AI suggests title (if enabled) → User accepts → Task created
```

### 2. Task Lifecycle
```
Create task → Complete → Verify status change
Create task → Defer → Verify deferred status
Create task → Reschedule → Verify new date
```

### 3. Project Management
```
Create project → Edit name → Change lifecycle (active→paused→completed)
```

### 4. Settings & AI
```
Enable AI → Set provider/model → Capture entry → Verify AI suggestion appears
```

### 5. Entity Linking (Notes)
```
Create note → Link to project → Verify link shown → Unlink → Verify removed
```

### 6. Navigation
```
Click each nav item → Verify correct view renders
Verify badge counts update (inbox, notifications)
```

## Setup Requirements

1. Install Playwright:
```bash
npm init playwright@latest
# OR
bun add -D @playwright/test
npx playwright install
```

2. Configure `playwright.config.ts`:
- Test against http://localhost:5173
- Use in-memory database (fresh for each test)
- Screenshot on failure
- Trace on failure

3. Create test helpers:
- `helpers/test-user.ts` - Test user setup
- `helpers/app-actions.ts` - Common app interactions
- `fixtures/app-fixtures.ts` - Test fixtures

## Test File Structure

Create in `e2e/` directory:

```
e2e/
├── playwright.config.ts
├── fixtures/
│   └── app-fixtures.ts
├── helpers/
│   ├── test-user.ts
│   └── app-actions.ts
├── tests/
│   ├── 01-auth-setup.spec.ts
│   ├── 02-inbox-capture.spec.ts
│   ├── 03-ai-suggestions.spec.ts
│   ├── 04-task-lifecycle.spec.ts
│   ├── 05-project-management.spec.ts
│   ├── 06-notes-linking.spec.ts
│   ├── 07-events-sync.spec.ts
│   ├── 08-signals-triage.spec.ts
│   ├── 09-settings-ai.spec.ts
│   ├── 10-search.spec.ts
│   ├── 11-navigation.spec.ts
│   └── 12-full-workflow.spec.ts
└── README.md
```

## Example Test Patterns

### Pattern 1: Basic Capture
```typescript
test('user can capture an entry', async ({ page }) => {
  // Arrange: Start at inbox
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Inbox' })).toBeVisible();
  
  // Act: Type and capture
  const captureInput = page.getByPlaceholder('Quick capture...');
  await captureInput.fill('Buy groceries');
  await page.getByRole('button', { name: 'Capture' }).click();
  
  // Assert: Entry appears in list
  await expect(page.getByText('Buy groceries')).toBeVisible();
  await expect(page.getByText('captured')).toBeVisible();
});
```

### Pattern 2: AI Suggestion Flow
```typescript
test('AI suggestion flow works end-to-end', async ({ page }) => {
  // Enable AI first
  await page.goto('/settings');
  await page.getByLabel('Enable AI').check();
  await page.getByLabel('Provider').selectOption('openai');
  await page.getByLabel('Model ID').fill('gpt-4');
  await page.getByRole('button', { name: 'Save' }).click();
  
  // Go to inbox and capture
  await page.goto('/inbox');
  await page.getByPlaceholder('Quick capture...').fill('Schedule team meeting tomorrow');
  await page.getByRole('button', { name: 'Capture' }).click();
  
  // Wait for AI suggestion (with timeout)
  await expect(page.getByText('AI Suggestion')).toBeVisible({ timeout: 10000 });
  await expect(page.getByRole('button', { name: 'Accept' })).toBeVisible();
  
  // Accept suggestion
  await page.getByRole('button', { name: 'Accept' }).click();
  
  // Verify task created
  await page.goto('/tasks');
  await expect(page.getByText('Schedule team meeting')).toBeVisible();
});
```

### Pattern 3: Navigation
```typescript
test('navigation between all views works', async ({ page }) => {
  await page.goto('/');
  
  const views = [
    { nav: 'Inbox', heading: 'Inbox' },
    { nav: 'Plan', heading: 'Plan' },
    { nav: 'Tasks', heading: 'Tasks' },
    { nav: 'Projects', heading: 'Projects' },
    // ... etc
  ];
  
  for (const view of views) {
    await page.getByRole('button', { name: view.nav }).click();
    await expect(page.getByRole('heading', { name: view.heading })).toBeVisible();
  }
});
```

## CSS Selectors / Test IDs

If elements don't have good ARIA labels, use these selectors:

```typescript
// Navigation
const navItem = (name: string) => page.locator(`[data-view="${name.toLowerCase()}"]`);

// Views
const viewContainer = page.locator('.view-container');
const viewHeader = page.locator('.view-header h1, .view-header h2');

// Capture
const captureInput = page.locator('.capture-input, input[placeholder*="capture" i]');
const captureButton = page.locator('.capture-submit-btn, button:has-text("Capture")');

// Lists
const listContainer = page.locator('.list-container');
const listItem = page.locator('.list-item');

// Status badges
const statusBadge = (status: string) => page.locator(`.badge-${status}`);
```

## Running Tests

```bash
# Start dev server in one terminal
bun run dev:web

# Run tests in another terminal
bunx playwright test

# Run specific test
bunx playwright test 02-inbox-capture.spec.ts

# Run with UI mode
bunx playwright test --ui

# Run in headed mode (see browser)
bunx playwright test --headed
```

## Critical Paths to Cover

1. **Entry Capture** - Must work with and without AI
2. **AI Suggestion** - Enable AI → Capture → See suggestion → Accept
3. **Task Management** - Create, complete, defer, reschedule
4. **Project Lifecycle** - Create, edit, pause, complete
5. **Notes** - Create, link entities, edit body
6. **Settings** - Save/load AI config, persist across reloads
7. **Navigation** - All 12 views accessible
8. **Error Handling** - Empty states, validation errors

## Definition of Done

- [ ] Playwright installed and configured
- [ ] At least 20 E2E tests covering all critical paths
- [ ] Tests run in CI (GitHub Actions)
- [ ] Screenshots on failure
- [ ] Tests clean up state between runs
- [ ] README with run instructions

## Current State to Test Against

The app currently has:
- Basic sidebar navigation (works)
- Capture input (should work after fixes)
- Settings page with AI config (storage format fixed)
- All 12 view components rendered via AppShell
- useInteractiveApp hook managing state

Known issues to verify are fixed:
1. Loading indicator should clear after init
2. Capture should create entries
3. Settings should persist AI configuration
4. AI suggestions should appear when enabled
