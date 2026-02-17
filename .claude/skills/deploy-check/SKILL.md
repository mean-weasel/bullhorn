---
name: deploy-check
description: Check Vercel deployment status, compare deployed vs main, and report recent errors. Usage: /deploy-check
disable-model-invocation: true
---

Check the current deployment status for Bullhorn on Vercel.

## Steps

1. **Get latest deployment** — Fetch the most recent deployment from GitHub:

   ```bash
   gh api repos/mean-weasel/bullhorn/deployments --jq '.[0] | {id, sha, ref, environment, created_at, description}'
   ```

2. **Get deployment status** — Check the state of the latest deployment:

   ```bash
   gh api repos/mean-weasel/bullhorn/deployments/<id>/statuses --jq '.[0] | {state, description, created_at, target_url}'
   ```

3. **Compare deployed vs HEAD** — Show what's on main vs what's deployed:

   ```bash
   git log --oneline <deployed-sha>..HEAD
   ```

   If the deployed SHA matches HEAD, report "Production is up to date."
   If there are commits ahead, list them as "Undeployed changes."

4. **Check recent failed deployments** — Look for any failures in the last 5 deployments:

   ```bash
   gh api repos/mean-weasel/bullhorn/deployments --jq '.[0:5] | .[] | {sha: .sha[0:7], env: .environment, created: .created_at}'
   ```

   For each deployment, check its status. Flag any with state `failure` or `error`.

5. **Report** — Output a summary:

   ```
   ## Deployment Status

   **Environment**: production
   **State**: [active | pending | failure | error]
   **Deployed commit**: [sha] — [commit message]
   **Deployed at**: [timestamp]

   ### Undeployed Changes
   [list of commits on main not yet deployed, or "None — production is current"]

   ### Recent Failures
   [list of failed deployments in last 5, or "None"]
   ```

## Constraints

- This is read-only — never trigger deployments
- If the GitHub API returns no deployments, report that and suggest checking Vercel dashboard directly
- Use `gh api` for all GitHub API calls (authentication is handled by gh CLI)
