# Open-Source Launch Plan

## Phase 1: Dependabot PR Triage (next session)

Merge or close the 6 open Dependabot PRs on main:

| PR | Update | Action |
|----|--------|--------|
| #214 | `@commitlint/cli` 20.4.2 → 20.4.3 | Merge (safe patch) |
| #212 | `knip` 5.82.1 → 5.86.0 | Merge (safe minor) |
| #180 | `actions/upload-artifact` v6 → v7 | Merge (CI action) |
| #184 | Supabase group (2 packages) | Review changelog, merge if non-breaking |
| #182 | typescript-eslint group (6 packages) | Review, merge if lint passes |
| #187 | `tailwindcss` 3.4.19 → 4.2.1 | Close — major version, needs dedicated migration |

## Phase 2: Pre-Squash Fixes

Apply these fixes to main before squashing history, so they're included in the clean initial commit.

### Security fixes

- [ ] Add `auth.uid()` check inside `SECURITY DEFINER` RPC functions (`increment/decrement_storage_used`) — new migration
- [ ] Scope post media signed URLs to `userId/` prefix (`src/app/api/posts/[id]/media/route.ts`)
- [ ] Remove `state` from analytics auth URL response body (`src/app/api/analytics/auth/url/route.ts`)
- [ ] Add Zod validation to push-subscriptions route (`src/app/api/push-subscriptions/route.ts`)
- [ ] Limit OAuth error logging to `error` + `error_description` fields only (5 callback routes)
- [ ] Fix Supabase edge function to return generic error message (`supabase/functions/send-push/index.ts`)
- [ ] Add Sentry `beforeSend` hooks to scrub Authorization headers (3 sentry config files)

### Code cleanup

- [ ] Add `plans/`, `.xcodebuildmcp/`, `docs/plans/plan-refine-tracking.md` to `.gitignore`
- [ ] Remove `@octokit/rest` from production dependencies
- [ ] Run `npm audit fix` for `tar` vulnerability
- [ ] Reconcile GitHub org references (`mean-weasel` vs `neonwatty`) to actual launch org
- [ ] Document Apple Team ID / Bundle ID / Google Client ID as fork-must-change in CONTRIBUTING.md

### Documentation

- [ ] Create `docs/self-hosting.md` — Supabase setup, env vars, Vercel deploy (one-click button), cron config
- [ ] Overhaul `README.md` — screenshots/GIF, features, deploy button, self-hosting link, badges
- [ ] Add `CODE_OF_CONDUCT.md` (Contributor Covenant)
- [ ] Add `.github/ISSUE_TEMPLATE/bug_report.yml` and `feature_request.yml`
- [ ] Add `.github/PULL_REQUEST_TEMPLATE.md`
- [ ] Extract architecture docs from CLAUDE.md into `docs/architecture.md`
- [ ] Clean up or remove stale `docs/ROADMAP.md`

## Phase 3: Squash History

After all Phase 2 items are on main:

1. Backup branch already exists at `archive/pre-open-source`
2. Close any remaining open PRs
3. Create orphan branch from current main:
   ```bash
   git checkout --orphan fresh-main
   git add -A
   git commit -m "Initial open-source release"
   ```
4. Force-push to main:
   ```bash
   git branch -M fresh-main main
   git push --force origin main
   ```
5. Re-tag as `v1.5.0` (or whatever version)
6. Delete `archive/pre-open-source` from remote once confirmed clean

## Phase 4: Post-Squash Verification

- [ ] `git log --all -p` on fresh repo shows no leaked secrets
- [ ] `make ci` passes
- [ ] Dependabot auto-creates new PRs against clean history
- [ ] Deploy to Vercel succeeds from new history
- [ ] Self-hosting guide works from fresh clone

## Phase 5: Launch

- [ ] Wire up Stripe billing
- [ ] Prepare launch content (HN, Reddit, Twitter, Product Hunt)
- [ ] Make repo public
