# Beta Readiness Remediation Plan

**Date:** 2026-02-16
**Status:** Approved

## Context

A comprehensive audit of Bullhorn identified 9 priority action items across security, testing, MCP, and infrastructure. This plan addresses all findings to prepare for beta launch.

## Decisions

- **CSP**: Conditional — remove `unsafe-eval` in production, keep in dev
- **Rate limiting**: Fail closed in production when Redis unavailable
- **Error tracking**: Deferred (Sentry integration skipped for now)
- **Test scope**: Full — security, API routes, stores, hooks, components, MCP tools
- **MCP docs**: Update both README and /docs/mcp page

## Work Streams

### Group A — Security Fixes (parallel, no dependencies)

1. **Fix CSP** — Make `script-src` conditional on `NODE_ENV` in `next.config.js`. Production removes `unsafe-eval` and `unsafe-inline`. Dev keeps them for hot reload.

2. **Fix rate limiting** — In `src/lib/rateLimit.ts`, return `{ success: false }` when Redis is unavailable in production instead of allowing requests through.

3. **Add `force-dynamic`** — Add `export const dynamic = 'force-dynamic'` to all 29 GET API routes currently missing it. Only `media/route.ts` and `plan/route.ts` have it today.

### Group B — MCP Improvements (parallel, independent of A)

4. **MCP content validation** — Add platform-specific validation in MCP tool handlers: Twitter requires `text`, Reddit requires `subreddit` + `title`, LinkedIn requires `text` + `visibility`. Return clear errors with expected shape.

5. **MCP documentation** — Update `mcp-server/README.md` and the `/docs/mcp` page with: rate limit info (10 req/10s), plan limits table, tool argument examples for each domain.

### Group C — CI Fix (independent, trivial)

6. **Remove `--passWithNoTests`** — Remove flag from `.github/workflows/ci.yml` and `Makefile` (lines 217, 229).

### Group D — Tests (parallel, all independent of each other)

7. **Security-critical tests** — Unit tests for `planEnforcement.ts`, `rateLimit.ts`, media upload validation (file type, size, storage quota).

8. **API route tests** — Unit tests for all 37 untested API routes: blog drafts (7), launch posts (2), projects (6), analytics (6), post actions (4), campaigns detail (3), media (3), reminders (2), notifications (1), push tokens (1), plan (1), health (1).

9. **Store tests** — Unit tests for `analyticsStore.ts` and `planStore.ts`.

10. **Hook tests** — Unit tests for `useAutoSave`, `useKeyboardShortcuts`, `usePushNotifications`.

11. **Component tests** — Unit tests for critical interactive components: MediaUpload, ApiKeyManager, IOSDateTimePicker, IOSActionSheet, MarkdownEditor, ResponsiveDialog.

12. **MCP tool tests** — Unit tests for all 40 untested MCP tools across posts, blog drafts, projects, launch posts, and media domains.

## Parallelization

Groups A, B, C are fully independent — all can run simultaneously. Group D tasks are all independent of each other and of A/B/C — all 6 test streams can run in parallel.

## Out of Scope

- Sentry/error tracking integration
- iOS session persistence fix (blocked on Apple Developer Account)
- `/.well-known/security.txt`
- CI coverage threshold enforcement
- Component tests beyond critical interactive ones
