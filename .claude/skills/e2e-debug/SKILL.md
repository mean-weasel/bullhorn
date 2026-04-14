---
name: e2e-debug
description: Systematic walkthrough for diagnosing Playwright E2E failures in the Bullhorn repo — production build mismatches, auth gate regressions, navigation races, schema drift, test isolation.
disable-model-invocation: true
---

Diagnose a failing Playwright test in the Bullhorn repo. This skill assumes
you have a specific failed shard or spec to investigate — get the run ID or
job ID from the user before starting.

## Context you need before touching anything

- **How E2E runs in CI.** `ci.yml` builds the app once with `next build`
  with `NEXT_PUBLIC_E2E_TEST_MODE=true` and `E2E_TEST_MODE=true` in the
  step env, so the client bundle is compiled with E2E paths inlined. It
  uploads `.next` as an artifact, then each shard downloads that artifact
  and runs `playwright.config.ts` which spawns `npm start` (production
  server, `NODE_ENV=production`). Locally, the webServer spawns `npm run
  dev` instead. Anything that behaves differently between dev and prod in
  Next.js — hydration, CSP, SSG — is a plausible dev-vs-prod failure cause.

- **The auth-bypass gate.** Four files gate E2E test mode on
  `E2E_TEST_MODE === 'true' && CI === 'true' && VERCEL !== '1'`:
  `src/lib/auth.ts` (via `isTestMode()`),
  `src/app/(dashboard)/layout.tsx` (inline),
  `src/lib/supabase/server.ts` (inline, *also* requires
  `SUPABASE_SERVICE_ROLE_KEY`), and `src/app/api/posts/reset/route.ts`
  (inline). `src/app/page.tsx` has an equivalent inline gate that
  redirects anonymous visitors to `/dashboard` in test mode.
  If any new code adds a `NODE_ENV !== 'production'` check, it will
  break in CI (`next start` forces `NODE_ENV=production`) and every
  page will redirect to `/login`. Symptom: `toBeVisible()` times out
  waiting for a dashboard heading.

- **The sharding model.** Playwright round-robin shards by file. Tests
  run with `workers: 1` per shard, so within-shard parallelism is zero.
  If one shard is much slower than the others, it's not shard imbalance
  — it's a specific test hanging.

## Step-by-step diagnosis

1. **Fetch the failed log.**
   ```
   gh run view <run-id> --log --job <job-id> > /tmp/shard.log
   ```
   `gh pr checks <pr>` lists job IDs. The log is append-only and huge;
   save to a file and grep into it.

2. **Look for the test summary line.** `grep -E "[0-9]+ (failed|passed)" /tmp/shard.log`. If you see
   `3 failed, 119 passed`, the failures are narrow and test-specific. If
   you see `51 failed`, something systemic broke — auth gate, a shared
   helper, or the webServer itself. Treat those differently.

3. **Systemic failures (most tests fail with the same error):**

   a. **`Failed to reset database: Forbidden`** in the shard log →
      `src/app/api/posts/reset/route.ts` is returning 403. Check the
      gate at the top of that file. If the CI/E2E_TEST_MODE/VERCEL gate
      was accidentally tightened (e.g. someone added a `NODE_ENV !==
      'production'` clause on top), that's the cause.

   b. **Every test waits for a dashboard heading that never appears** →
      auth bypass is dead. Check `isTestMode()` in `src/lib/auth.ts`,
      plus the inline gates in `src/app/(dashboard)/layout.tsx`,
      `src/lib/supabase/server.ts`, `src/app/api/posts/reset/route.ts`,
      and `src/app/page.tsx`. All five sites must agree on the same
      env gate — they diverge silently if only some are updated.

   c. **`upstream image response failed` errors on `/_next/image?url=...`
      pointing at `http://127.0.0.1:54321/storage/...`** → local Supabase
      doesn't have the bucket content that production expects. Usually
      NOT the cause of test failure, just noise. Don't chase it unless
      every other theory is ruled out.

4. **Narrow failures (a handful of specific tests):**

   a. **Toast/message races.** Any test that asserts on a success message
      right before a `router.push` / `router.replace` is a prime suspect.
      In dev mode the setState-then-navigate race resolves in favor of
      render; in prod mode it resolves in favor of navigation. Fix by
      using `react-hot-toast` (persists across navigation) instead of
      component-local state. See `src/app/(dashboard)/blog/BlogEditorForm.tsx`
      for the pattern.

   b. **CSP violations in prod mode.** Dev mode allows `unsafe-eval` in
      `next.config.js`; prod mode doesn't. If a test fails with CSP
      violations in the browser console, check whether the failing code
      invokes dynamic code evaluation. Rare.

   c. **Minification changed selector text.** If a selector looks for
      an auto-generated className or a function display name, it can
      resolve in dev and fail in prod. Use `getByRole`, `getByText`, or
      `data-testid` instead.

5. **Cannot determine the cause from logs alone:**
   - Download the Playwright trace from the run's failure artifact.
     `gh run download <run-id> -n playwright-report-shard-<N>` pulls
     the report directory. Open `trace.zip` via the hosted viewer or
     `npx playwright show-trace <path>`.
   - The trace shows the exact page state, network calls, and DOM at
     each step — faster than squinting at screenshots.

## What NOT to do

- **Don't disable or `.skip` flaky tests.** That's the escape hatch that
  makes the next failure harder to diagnose. If a test is genuinely
  wrong, fix or delete it. If it's correct but racy, fix the product code.
- **Don't add arbitrary `page.waitForTimeout(N)`.** Use `waitForSelector`
  / `toBeVisible` with a real condition.
- **Don't change the shard count or workers setting** to "fix" timing
  issues. The shard count is a CI-side tunable; the real fix is almost
  always in the product code or the specific test.

## Stop conditions

- You've identified the root cause and have a specific fix in mind →
  present it and ask before changing code.
- After 3 diagnostic passes you still don't know what failed → surface
  the evidence you have and escalate to the user.
- Logs show network errors against `127.0.0.1:54321` that are not the
  app's own endpoint → that's Supabase, out of scope for this skill.
