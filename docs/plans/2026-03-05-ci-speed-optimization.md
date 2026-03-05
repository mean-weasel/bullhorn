# CI Speed Optimization Plan

**Date**: 2026-03-05
**Status**: Revised after multi-perspective review

## Problem

The CI workflow takes ~26 minutes wall-clock on every push/PR to `main`. The bottleneck is E2E tests (3 shards, up to 26 min each). Fast jobs (lint, typecheck, knip, unit tests) finish in under 2 minutes but each pay their own setup overhead. Total billed minutes per run: ~78 min.

## Current Pipeline Analysis

### Job Timing (from recent runs)

| Job | Duration | Billed Min | Status |
|-----|----------|------------|--------|
| Knip (Dead Code) | ~0.7 min | 1 | Fine |
| Lint | ~0.7 min | 1 | Fine |
| Type Check | ~0.8 min | 1 | Fine |
| Unit Tests | ~2.0 min | 2 | Fine |
| E2E Shard 1/3 | ~25.4 min | 26 | **Bottleneck** |
| E2E Shard 2/3 | ~26.2 min | 27 | **Bottleneck** |
| E2E Shard 3/3 | ~18.0 min | 19 | Unbalanced — finishes 8 min early |
| Release | after all above | 1 | Only on main push |
| **Total** | **~26 min wall-clock** | **~78 billed** | |

### Per-Job Overhead Breakdown (estimated)

Each job independently pays:
- `actions/checkout`: ~5s
- `actions/setup-node` + npm cache restore: ~10s
- **`npm ci`: ~30-60s** (76 dependencies, 22k-line lockfile)

Each E2E shard additionally pays:
- `supabase start`: ~60-90s (pulls Docker images, starts PostgreSQL + GoTrue + etc.)
- `supabase db push --local`: ~10-20s
- **`npx playwright install --with-deps chromium`**: ~60-90s (downloads ~130MB browser binary)
- **Next.js dev server cold start**: ~30-60s (compiles on first request)

**Estimated per-shard overhead: ~3-5 min before any test runs.**

### Cache Storage (current)

The repo currently uses **6.46 GB / 10 GB** of GitHub Actions cache. All 27 entries are npm caches (`node-cache-Linux-x64-npm-*`), ~245 MB each — one per branch. This is a problem that must be addressed before adding new caches.

### E2E Test Distribution (20 spec files, 329 total tests)

Largest files by test count:
- blog-drafts.spec.ts: 41 tests
- launch-posts.spec.ts: 33 tests
- auth.spec.ts: 25 tests
- profile.spec.ts: 25 tests
- projects.spec.ts: 21 tests
- media-features.spec.ts: 21 tests

Playwright's default sharding splits by file, so shard 3 likely gets fewer/smaller files — explaining the 8-minute gap.

### E2E Test Isolation Model

- Each test calls `resetDatabase()` in `beforeEach` (hits POST /api/posts/reset)
- 7 out of 20 spec files use `test.describe.serial()` — tests within serial blocks depend on execution order
- All tests share a single test user (E2E_TEST_MODE)
- 20+ `waitForTimeout()` calls across spec files (hard waits of 500ms-5000ms) — classic flake sources
- A `generateTestId()` helper exists in helpers.ts but is unused
- **Verdict: Tests are isolated between files but NOT safe for in-process parallelism without refactoring**

### Current Playwright Config

```typescript
fullyParallel: false,    // no parallelism within shards
workers: 1,              // single worker per shard
retries: process.env.CI ? 2 : 0,  // up to 3 attempts per test
timeout: 120_000,        // 2 min per test
webServer: {
  command: 'npm run dev',  // dev server (not production build)
}
```

---

## Recommendations

Ordered by implementation priority. Items rejected during review are documented in the Rejected section below.

### 1. Add concurrency groups to cancel stale runs

**Impact**: Biggest aggregate runner-minute saver for active PRs
**Risk**: None — only cancels outdated PR runs, not main branch
**Complexity**: Trivial

When a developer pushes twice quickly to a PR, the first CI run is now irrelevant. Cancel it:

```yaml
concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: ${{ github.event_name == 'pull_request' }}
```

This does NOT cancel runs on `main` (the `cancel-in-progress` expression evaluates to `false` for push events).

### 2. Add path-based filtering

**Impact**: Skip entire CI on docs-only changes; skip E2E when only non-code files change
**Risk**: None for the workflow-level filter; low for E2E-specific filter
**Complexity**: Low

**Workflow-level** — skip CI entirely for docs-only PRs:

```yaml
on:
  push:
    branches: [main]
    paths-ignore:
      - '**.md'
      - 'docs/**'
      - '.vscode/**'
      - 'LICENSE'
  pull_request:
    branches: [main]
    paths-ignore:
      - '**.md'
      - 'docs/**'
      - '.vscode/**'
      - 'LICENSE'
```

**E2E-specific** — skip E2E shards when only non-app files change (using `dorny/paths-filter`):

```yaml
changes:
  name: Detect Changes
  runs-on: ubuntu-latest
  outputs:
    e2e-relevant: ${{ steps.filter.outputs.src }}
  steps:
    - uses: actions/checkout@v6
    - uses: dorny/paths-filter@v3
      id: filter
      with:
        filters: |
          src:
            - 'src/**'
            - 'e2e/**'
            - 'supabase/**'
            - 'package*.json'
            - 'playwright.config.ts'
            - 'next.config.js'

e2e-tests:
  needs: [changes]
  if: needs.changes.outputs.e2e-relevant == 'true'
  # ...
```

### 3. Cache Playwright browsers

**Impact**: Save ~60-90s per E2E shard (~5-8 billed min total)
**Risk**: None
**Complexity**: Low

Cache the Playwright browser binary with a correct key that includes `runner.os` and uses `restore-keys` for resilience against unrelated lockfile changes:

```yaml
- name: Get Playwright version
  id: pw-version
  run: echo "version=$(npx playwright --version)" >> $GITHUB_OUTPUT

- name: Cache Playwright browsers
  id: cache-playwright
  uses: actions/cache@v4
  with:
    path: ~/.cache/ms-playwright
    key: playwright-${{ runner.os }}-${{ steps.pw-version.outputs.version }}
    restore-keys: |
      playwright-${{ runner.os }}-

- name: Install Playwright browsers
  if: steps.cache-playwright.outputs.cache-hit != 'true'
  run: npx playwright install --with-deps chromium

- name: Install Playwright system deps (on cache hit)
  if: steps.cache-playwright.outputs.cache-hit == 'true'
  run: npx playwright install-deps chromium
```

The `restore-keys` fallback means even after a lockfile change from an unrelated dependency, previously cached browsers are restored. The version-specific primary key ensures cache invalidation when Playwright actually updates.

### 4. Switch E2E from dev server to production build

**Impact**: Eliminates on-demand compilation; faster page loads throughout all tests (~2-3 min per shard)
**Risk**: Medium — behavioral differences between dev and prod (see Blockers below)
**Complexity**: Medium

Build per shard (NOT shared artifact — see Rejected section). Each shard runs `npm run build` then `npm start`.

**Critical blockers that MUST be addressed:**

1. **`NODE_ENV=production` kills the E2E auth bypass.** The `isTestMode()` function in `src/lib/auth.ts` explicitly returns `false` when `NODE_ENV === 'production'`. Since `next start` defaults to `NODE_ENV=production`, all E2E tests would fail with auth errors. The webServer command must set `NODE_ENV=test`.

2. **`NEXT_PUBLIC_*` variables are baked in at build time.** The build command must include the correct Supabase URL and anon key (the local Supabase dev keys are deterministic), and `NEXT_PUBLIC_E2E_TEST_MODE=true`.

**Change to `playwright.config.ts`:**

```typescript
webServer: {
  command: process.env.CI
    ? [
        'E2E_TEST_MODE=true',
        'NEXT_PUBLIC_E2E_TEST_MODE=true',
        `NEXT_PUBLIC_SUPABASE_URL=${process.env.NEXT_PUBLIC_SUPABASE_URL || ''}`,
        `NEXT_PUBLIC_SUPABASE_ANON_KEY=${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''}`,
        'npm run build &&',
        `NODE_ENV=test E2E_TEST_MODE=true SUPABASE_SERVICE_ROLE_KEY=${process.env.SUPABASE_SERVICE_ROLE_KEY || ''} npm start -- --port ${PORT}`,
      ].join(' ')
    : `E2E_TEST_MODE=true NEXT_PUBLIC_E2E_TEST_MODE=true npm run dev -- --port ${PORT}`,
  url: `http://localhost:${PORT}`,
  reuseExistingServer: !process.env.CI,
  timeout: process.env.CI ? 180_000 : 120_000,
  env: {
    E2E_TEST_MODE: 'true',
    NEXT_PUBLIC_E2E_TEST_MODE: 'true',
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  },
},
```

**Additional change — add `make test-e2e-prod` to Makefile:**

```makefile
test-e2e-prod: build ## Run E2E tests against production build (matches CI)
	CI=true npm run test:e2e
```

This closes the local/CI parity gap so developers can reproduce CI failures locally.

### 5. Increase E2E shards from 3 to 4

**Impact**: Reduces wall-clock from ~26 min to ~17-19 min
**Risk**: None — just matrix change
**Complexity**: Trivial

```yaml
strategy:
  fail-fast: false
  matrix:
    shardIndex: [1, 2, 3, 4]
    shardTotal: [4]
```

With 20 spec files across 4 shards, each shard gets 5 files — evenly distributed. This provides ~75% of the wall-clock benefit of 5 shards while adding only 1 extra runner instead of 2.

**Why 4 and not 5**: Going from 3→4 saves ~7-9 min wall-clock at +4-5 billed minutes. Going from 3→5 saves ~9-11 min but costs +8-10 billed minutes. Diminishing returns — the largest spec file (`blog-drafts.spec.ts`, 41 tests) dominates its shard regardless of count.

### 6. Add job-level timeouts

**Impact**: Prevents runaway jobs from consuming 6 hours (GitHub default)
**Risk**: None
**Complexity**: Trivial

```yaml
knip:
  timeout-minutes: 5
lint:
  timeout-minutes: 5
typecheck:
  timeout-minutes: 5
unit-tests:
  timeout-minutes: 10
e2e-tests:
  timeout-minutes: 30
```

### 7. Add cache key version prefix

**Impact**: Provides manual cache invalidation escape hatch
**Risk**: None
**Complexity**: Trivial

Prefix all cache keys with `v1-`. When caches go stale or corrupt, increment to `v2-` to force a clean slate:

```yaml
key: v1-playwright-${{ runner.os }}-${{ steps.pw-version.outputs.version }}
key: v1-deps-${{ runner.os }}-${{ hashFiles('package-lock.json') }}
```

Document the invalidation process: increment prefix in `ci.yml` or use `gh actions-cache delete`.

---

## Rejected Recommendations (with rationale)

### ~~Cache npm with a gating `install` job~~

**Rejected by**: CI/DevOps review, Cost review

The original plan proposed a dedicated `install` job that all downstream jobs depend on. Problems:
- **Adds serial dependency**: All jobs wait ~15-20s for the install job to spin up, even on cache hit. Currently all 6 jobs start simultaneously.
- **`node_modules` caching is an anti-pattern for npm**: Contains platform-specific binaries that can break across runner OS updates. `npm ci` is designed to be reproducible; caching `node_modules` bypasses its integrity guarantees.
- **Current `setup-node` cache is sufficient**: `actions/setup-node@v6` with `cache: 'npm'` already caches the npm global store, making `npm ci` ~10-15s on cache hit.

**Instead**: Keep the current `cache: 'npm'` on `actions/setup-node` for all jobs. No gating job.

### ~~Build once, share `.next` as artifact (Option A)~~

**Rejected by**: All four reviews

Problems:
- **`NEXT_PUBLIC_*` variables baked at build time**: Using `placeholder` for `NEXT_PUBLIC_SUPABASE_ANON_KEY` means the client-side Supabase client sends `placeholder` as the auth key, breaking all client-side API calls.
- **1 GB artifact size**: Upload ~30-60s, download ~15-30s per shard. Partially negates the time savings.
- **No `retention-days` specified**: Without `retention-days: 1`, the artifact persists for 90 days — creating ~135 GB/month of artifact storage.
- **Single point of failure**: If artifact upload is partially corrupted, shards fail with obscure errors.

**Instead**: Use Option B — build in each shard. Safer, simpler, approximately neutral on billing.

### ~~Reduce E2E retries from 2 to 1~~

**Rejected by**: Testing Reliability review

Problems:
- **20+ `waitForTimeout()` calls** across spec files — classic flake sources (hard waits of 500ms-5000ms)
- **7 files with `test.describe.serial()` blocks** — one flaky test cascades failures to all subsequent tests in the block
- With 329 tests and even 1% per-test flake rate: `1 - (0.99^2)^329 = ~87%` chance of false failure per run with 1 retry vs `~62%` with 2 retries
- Playwright's own docs recommend `retries: 2` in CI

**Instead**: Keep `retries: 2` until `waitForTimeout` calls are replaced with proper `waitFor` conditions. Add this as a prerequisite in Future Work.

### ~~Merge fast static-analysis jobs into one~~

**Rejected by**: All four reviews

Problems:
- **Saves 0 billed minutes** — rounding eliminates any savings (1+1+1 min = 3 min billed either way)
- **Slightly worsens wall-clock** — jobs run sequentially within merged job instead of in parallel
- **Loses granular GitHub status checks** — developer sees "Static Analysis: failed" instead of knowing immediately whether it was lint vs typecheck vs knip

**Instead**: Keep separate jobs. The DX benefit of granular checks outweighs the marginal overhead.

### ~~Cache Supabase Docker images~~

**Rejected by**: CI/DevOps review, Cost review, DX review

Problems:
- **`docker save $(docker images -q)` saves ALL images**, not just Supabase — tar file could be 1-2 GB+
- **Cache key `supabase-${{ hashFiles('supabase/config.toml') }}` is wrong** — Docker image versions are determined by the Supabase CLI version, not the config file
- **~600 MB cache entry** with 6.46 GB already used — would accelerate cache eviction thrashing
- **Highest debugging-cost-to-savings ratio** in the entire plan — opaque failures when CLI version changes but cache key doesn't invalidate

**Instead**: Skip for now. The 60-90s of `supabase start` is primarily container startup time. Revisit only after cache budget is cleaned up and if other optimizations prove insufficient.

---

## Projected Impact

| Optimization | Wall-Clock Saved | Billed Min Change |
|-------------|-----------------|-------------------|
| Baseline | — | 78 min/run |
| Concurrency groups (rec 1) | Avoids duplicate runs | Major savings on active PRs |
| Path filtering (rec 2) | Skips CI on docs PRs | Saves full run on non-code changes |
| Cache Playwright (rec 3) | ~1 min wall-clock | -5 to -8 min |
| Production build (rec 4) | ~2 min wall-clock | ~0 (neutral) |
| 4 shards (rec 5) | ~7-9 min wall-clock | +4 to +5 min |
| Timeouts (rec 6) | Prevents runaways | Prevents worst-case billing |
| Cache key prefix (rec 7) | — | Enables quick cache fixes |

**Projected result: ~14-18 min wall-clock** (down from ~26 min), a ~35-45% reduction.
**Projected billed minutes: ~72-76 min/run** (down from ~78), a ~3-8% reduction.
**Projected cache storage: ~1 GB** (down from 6.46 GB after cleanup).

The revised plan trades slightly less aggressive wall-clock savings for correctness, reduced billing, and lower maintenance burden.

---

## Future Work (not in scope)

These would provide additional gains but require larger refactoring:

1. **Clean up `waitForTimeout` calls, then reduce retries to 1**
   - Replace 20+ hard waits with proper `waitFor` conditions
   - Then safely reduce `retries` from 2 to 1
   - Prerequisite for reliable CI with lower retry overhead

2. **Enable E2E parallelism within shards** (`workers: 2-3`, `fullyParallel: true`)
   - Requires per-worker test user isolation
   - Refactoring `database-state.spec.ts` serial blocks
   - Using `generateTestId()` throughout (helper already exists)
   - Could reduce E2E time by another 30-50%

3. **Playwright test sharding by timing** — Use `--shard` with blob reporter and `merge-reports` to balance shards by actual duration rather than file count

4. **Increase shards to 5** — Once the benefits of 4 shards are measured, evaluate whether the incremental cost of a 5th shard is justified

---

## Files to Modify

| File | Change |
|------|--------|
| `.github/workflows/ci.yml` | Recommendations 1, 2, 3, 5, 6, 7 |
| `playwright.config.ts` | Recommendation 4 (production build + NODE_ENV=test) |
| `Makefile` | Add `test-e2e-prod` target |

No test code changes required. No CI checks removed.
