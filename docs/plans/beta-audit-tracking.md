# Beta Audit Tracking

Holistic beta-readiness audit across feature completeness, error handling, UX polish, ops readiness, and performance.

---

## Iteration Log

### Iteration 1 (2026-03-01)

**Findings:** 40+ total (15 HIGH, 20 MEDIUM, 15+ LOW)
**Code fixes applied:** 9
**Manual to-dos added:** 5
**Deferred:** 25+

#### Fixed (Code)

- [x] CRON_SECRET fail-open allows unauthenticated cron triggers — changed to fail-closed across all 4 cron routes (dimension: ops, severity: HIGH)
- [x] Blog draft null safety crash — `d.title.toLowerCase()` crashes when title is null during search filtering (dimension: error-handling, severity: HIGH)
- [x] Media remove button inaccessible on mobile — hover-only `opacity-0 group-hover:opacity-100` invisible on touch devices, now always visible on mobile (dimension: ux, severity: HIGH)
- [x] Missing X-Frame-Options header — clickjacking protection for older browsers that ignore CSP frame-ancestors (dimension: ops, severity: MEDIUM)
- [x] Campaign page O(n²) project lookup — `projects.find()` inside `.map()` replaced with pre-computed Map lookup (dimension: performance, severity: HIGH)
- [x] Missing alt text on avatar images — empty `alt=""` on AccountPicker avatars now includes account name (dimension: ux, severity: HIGH)
- [x] Missing video controls on media previews — uploaded videos had no play/pause controls (dimension: ux, severity: MEDIUM)
- [x] Env validation only ran in production — staging/preview deployments skipped validation, now runs in all non-dev environments (dimension: ops, severity: MEDIUM)
- [x] Dashboard sequential store fetches — 4 separate useEffects replaced with single parallel Promise.all() (dimension: performance, severity: MEDIUM)

#### Manual To-Dos Added

- Email service setup needed before enabling notification UI (dimension: feature, severity: HIGH)
- Sentry DSN must be configured in Vercel production env vars (dimension: ops, severity: MEDIUM)
- CRON_SECRET must be set in Vercel production env vars (dimension: ops, severity: HIGH)
- Core Web Vitals monitoring via Vercel Analytics (dimension: performance, severity: MEDIUM)
- Database index review for posts, campaigns, blog_drafts tables (dimension: performance, severity: MEDIUM)

#### Deferred

- [ ] Email notification UI with no backend — needs full email service implementation (dimension: feature, severity: HIGH, reason: too large for single iteration)
- [ ] Media upload skipped in publishers — Twitter/LinkedIn/Reddit publishers drop media on publish (dimension: feature, severity: HIGH, reason: requires platform API work)
- [ ] Pro plan upgrade flow disabled — Stripe integration needed (dimension: feature, severity: HIGH, reason: external service integration)
- [ ] request.json() no try-catch in 20+ API routes — systematic fix needed (dimension: error-handling, severity: HIGH, reason: too many files for one iteration)
- [ ] Store error states not displayed in UI — posts, campaigns, launch-posts pages silently fail (dimension: error-handling, severity: HIGH, reason: multi-page fix)
- [ ] Missing focus trap in modals — WCAG violation, needs focus-trap library (dimension: ux, severity: HIGH, reason: requires new dependency evaluation)
- [ ] Header nav touch targets too small — 36px instead of 44px minimum (dimension: ux, severity: HIGH, reason: layout redesign needed)
- [ ] Backdrop click closes dialog without confirmation — data loss risk (dimension: ux, severity: HIGH, reason: UX design decision needed)
- [ ] Campaign detail / edit page sequential fetches — parallelize with Promise.all (dimension: performance, severity: MEDIUM, reason: deferred to next iteration)
- [ ] searchDrafts() not deduplicated — rapid typing sends multiple API requests (dimension: performance, severity: MEDIUM, reason: deferred)
- [ ] Rate limiting fail-open when Upstash not configured (dimension: ops, severity: MEDIUM, reason: intentional per CLAUDE.md)
- [ ] OAuth callback connection ID in URL query string (dimension: ops, severity: MEDIUM, reason: low risk)
- [ ] Inconsistent button sizing across breakpoints (dimension: ux, severity: MEDIUM, reason: deferred)
- [ ] Missing ARIA labels on form sections (dimension: ux, severity: MEDIUM, reason: deferred)
- [ ] Dead feature UI in AccountPicker — shows "under development" (dimension: ux, severity: MEDIUM, reason: feature roadmap decision)
- [ ] Various LOW severity items across all dimensions (reason: polish items for later iterations)
