---
name: gen-test
description: Generate Vitest tests for a file following project conventions. Use when asked to create tests for a source file.
disable-model-invocation: true
---

Generate tests for: $ARGUMENTS

## Test Stack

- **Runner**: Vitest (`vitest run`)
- **React**: `@testing-library/react` with `@testing-library/jest-dom`
- **Assertions**: Vitest `expect` for everything, `@testing-library/jest-dom` for DOM matchers
- **Mocking**: `vi.mock()` for modules, `vi.fn()` for functions

## Conventions

1. Read the source file specified in `$ARGUMENTS`
2. Place the test file adjacent to the source: `<filename>.test.ts` or `<filename>.test.tsx`
3. Use `describe` blocks grouped by function/component, with `it` for individual cases
4. Mock Supabase client when testing code that uses `@supabase/supabase-js` or `@supabase/ssr`
5. Mock `process.env` in `beforeEach`, restore in `afterEach`
6. For Zustand stores: test actions by calling them and checking resulting state via `getState()`
7. For API routes: test `requireAuth()` call, request validation, success paths, and error handling
8. For React components: test user interactions, rendered output, and edge cases
9. For utility functions: test happy paths, edge cases, and error conditions
10. For transform functions (`transformXFromDb/ToDb`): test snake_case <-> camelCase conversion

## Project-Specific Patterns

- Auth mocking: mock `requireAuth()` from `@/lib/auth` to return `{ userId: 'test-user-id' }`
- Supabase mocking: mock `createClient` from `@/lib/supabase/server` to return chainable query builder
- Request dedup: mock `dedup` from `@/lib/requestDedup` when testing store fetch actions

## After Generation

Run the tests to verify they pass:

```bash
npx vitest run --reporter=verbose <test-file-path>
```

Fix any failures before finishing.
