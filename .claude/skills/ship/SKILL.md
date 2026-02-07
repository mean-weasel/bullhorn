---
name: ship
description: Check CI, merge PR, pull main, and verify deployment. Use when ready to ship the current branch.
disable-model-invocation: true
---

Ship the current branch by checking CI, merging, and verifying deployment.

## Steps

1. **Check CI status** — Run `gh pr checks` on the current branch
2. **Wait if pending** — If any checks are still running, poll every 30 seconds (max 5 minutes). Show a brief status update each cycle.
3. **Handle failure** — If any check fails:
   - Run `gh run view <run-id> --log-failed` to get the failure logs
   - Summarize what failed and why
   - Stop and report — do NOT merge
4. **Merge** — If all checks pass:
   - Run `gh pr merge --squash --delete-branch`
   - If merge fails, report the error
5. **Update local** — Switch to main and pull:
   - `git checkout main && git pull`
6. **Verify deployment** — Check Vercel deployment status:
   - `gh api repos/{owner}/{repo}/deployments --jq '.[0] | {state, environment, created_at}'`
   - Report deployment state
7. **Summarize** — Output what was shipped: PR title, number of commits, deployment status

## Important

- Never force-merge or skip CI checks
- If CI has been running for more than 10 minutes total, stop waiting and report
- If there's no open PR for the current branch, say so and stop
