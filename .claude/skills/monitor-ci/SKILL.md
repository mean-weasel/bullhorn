---
name: monitor-ci
description: Monitor CI status for the current branch, diagnose failures, and summarize results.
disable-model-invocation: true
---

Monitor CI for the current branch and diagnose any failures.

## Steps

1. **Identify the run** — Get the current branch name and find the latest CI run:
   - `gh run list --branch $(git branch --show-current) --limit 1 --json databaseId,status,conclusion,name`
2. **Poll if in progress** — If status is `in_progress` or `queued`:
   - Poll every 30 seconds with `gh run view <run-id> --json status,conclusion`
   - Show a brief status each cycle (e.g., "CI still running... 2m elapsed")
   - Max wait: 10 minutes — after that, report current state and stop
3. **On success** — If conclusion is `success`:
   - Report: "All CI checks passed" with run duration
   - List the jobs that ran
4. **On failure** — If conclusion is `failure`:
   - Fetch failed job logs: `gh run view <run-id> --log-failed`
   - **Categorize** the failure as one of:
     - **Lint/format error** — ESLint or Prettier issues
     - **Type error** — TypeScript compilation failure
     - **Unit test failure** — Vitest test assertion failed
     - **E2E test failure** — Playwright selector mismatch, timeout, or assertion
     - **Build error** — Next.js build failure
     - **Credential/secret issue** — Missing env vars or auth failures
     - **Dead code** — Knip detected unused exports/dependencies
     - **Other** — Anything that doesn't fit above
   - Summarize: what failed, which file/test, and the likely root cause
   - Suggest a fix if the cause is clear

## Important

- Do NOT attempt to fix anything automatically — just diagnose and report
- If logs are very long, focus on the first error and any "FAILED" or "Error:" lines
- If there's no CI run for the current branch, say so
