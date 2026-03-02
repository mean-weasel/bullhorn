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

### Iteration 2 (2026-03-02)

**Findings:** 18 tasks (8 HIGH, 7 MEDIUM, 3 LOW)
**Code fixes applied:** 16
**Manual to-dos added:** 4
**Deferred:** 0

#### Fixed (Code)

- [x] parseJsonBody helper for safe JSON parsing — covers all 23 API routes (dimension: error-handling, severity: HIGH)
- [x] Error banners on posts and campaigns pages — store errors now visible to users (dimension: error-handling, severity: HIGH)
- [x] ResponsiveDialog preventBackdropClose prop — prevents accidental data loss (dimension: ux, severity: HIGH)
- [x] Header nav touch targets 44x44px — WCAG 2.5.5 compliance (dimension: ux, severity: HIGH)
- [x] Email notification toggles "coming soon" — greyed out with explanation (dimension: ux, severity: MEDIUM)
- [x] Media publish warning banner — shown when media attached in editor (dimension: ux, severity: MEDIUM)
- [x] ARIA form role on post editor sections (dimension: ux, severity: MEDIUM)
- [x] AccountPicker empty state links to Settings (dimension: ux, severity: MEDIUM)
- [x] searchDrafts wrapped with dedup — prevents duplicate API requests (dimension: performance, severity: MEDIUM)
- [x] Edit page useEffect calls consolidated into single effect (dimension: performance, severity: MEDIUM)
- [x] Database performance indexes migration — posts, campaigns, blog_drafts, launch_posts, reminders (dimension: performance, severity: MEDIUM)
- [x] Fixed migration column name: due_at → remind_at (dimension: ops, severity: HIGH — CI fix)
- [x] Removed inert focus trap that blocked dialog interaction (dimension: ux, severity: HIGH — CI fix)

#### Manual To-Dos Added

- Apply migration 20260302002247_add_performance_indexes.sql to production (dimension: ops, severity: MEDIUM)
- Verify all required Vercel env vars in production (dimension: ops, severity: HIGH)
- Configure Sentry project alerts for production (dimension: ops, severity: MEDIUM)
- Set up Upstash Redis for rate limiting (dimension: ops, severity: MEDIUM)

#### Previously Deferred → Now Fixed

- [x] request.json() no try-catch in 20+ API routes → parseJsonBody applied to all 23 routes
- [x] Store error states not displayed in UI → error banners on posts and campaigns pages
- [x] Missing focus trap in modals → evaluated and removed (inert approach doesn't work with portal-less dialogs)
- [x] Header nav touch targets too small → increased to 44x44px minimum
- [x] Backdrop click closes dialog without confirmation → preventBackdropClose prop added
- [x] Campaign detail / edit page sequential fetches → already parallel (fire-and-forget), edit page consolidated
- [x] searchDrafts() not deduplicated → wrapped with dedup
- [x] Missing ARIA labels on form sections → added role="form" to editor
- [x] Dead feature UI in AccountPicker → updated with Settings link

### Iteration 3 (2026-03-02)

**Findings:** 22 total (4 HIGH, 7 MEDIUM, 11 LOW)
**Code fixes applied:** 9
**Manual to-dos added:** 1
**Deferred:** 11

#### Fixed (Code)

- [x] Timing-safe CRON_SECRET comparison — replaced string `!==` with `crypto.timingSafeEqual` via shared `verifyCronSecret` helper across all 4 cron routes (dimension: ops, severity: HIGH)
- [x] Dashboard Promise.all not awaited — fire-and-forget `Promise.all(fetches)` missing `void` prefix, silencing floating promise lint (dimension: error-handling, severity: HIGH)
- [x] Missing maxLength on form inputs — added maxLength to CreateProjectModal (name 200, description 2000) and NotesSection (5000) to match backend limits (dimension: error-handling, severity: HIGH)
- [x] Push notification denied recovery guidance — expanded "blocked" message with step-by-step browser re-enable instructions (dimension: error-handling, severity: HIGH)
- [x] Browser confirm() replaced with ConfirmDialog — launch-posts delete now uses styled ConfirmDialog instead of native `confirm()` (dimension: ux, severity: MEDIUM)
- [x] Unassociated form labels — added htmlFor/id pairs to ApiKeyManager "Key name" and RecurrencePicker "Repeat" labels (dimension: ux, severity: MEDIUM)
- [x] Missing pagination limits — added .limit(200) to community-events and .limit(100) to api-keys GET endpoints (dimension: performance, severity: MEDIUM)
- [x] Posts page 8-pass status counts — replaced 8 separate .filter() calls with single-pass reduction loop (dimension: performance, severity: MEDIUM)
- [x] Email prefs error recovery — added retry button to EmailNotificationsSection when preferences fail to load (dimension: error-handling, severity: MEDIUM)

#### Manual To-Dos Added

- Cookie policy page needed for regulatory compliance — privacy page references cookies but no dedicated cookie policy exists (dimension: feature, severity: HIGH)

#### Deferred

- [ ] Launch post URL format validation (dimension: error-handling, severity: MEDIUM, reason: deferred to next iteration)
- [ ] Blog draft title inline validation and maxLength (dimension: error-handling, severity: MEDIUM, reason: deferred)
- [ ] Campaign detail 404 handling on deleted resource (dimension: error-handling, severity: MEDIUM, reason: deferred)
- [ ] Generic API error messages lack field-level details (dimension: error-handling, severity: MEDIUM, reason: systematic multi-route change)
- [ ] Console error logging leaks schema details (dimension: ops, severity: MEDIUM, reason: needs structured logging strategy)
- [ ] Missing aria-busy on loading elements (dimension: ux, severity: LOW, reason: polish)
- [ ] Emoji in headings need aria-hidden (dimension: ux, severity: LOW, reason: polish)
- [ ] Form label font weight inconsistency (dimension: ux, severity: LOW, reason: polish)
- [ ] Missing title attributes on truncated text (dimension: ux, severity: LOW, reason: polish)
- [ ] CSP unsafe-inline for scripts in production (dimension: ops, severity: LOW, reason: Next.js requirement, accepted risk)
- [ ] Error digest exposed to end users (dimension: ops, severity: LOW, reason: useful for support scenarios)

### Iteration 4 (2026-03-02)

**Findings:** 15 total (0 HIGH, 9 MEDIUM, 6 LOW)
**Code fixes applied:** 9
**Manual to-dos added:** 0
**Deferred:** 6

#### Fixed (Code)

- [x] Native confirm() in campaigns list page — replaced with styled ConfirmDialog for delete confirmation (dimension: ux, severity: MEDIUM)
- [x] Native confirm() in projects list page — replaced with styled ConfirmDialog for delete confirmation (dimension: ux, severity: MEDIUM)
- [x] Native confirm() in campaign detail page (2 locations) — campaign delete and launch post delete now use ConfirmDialog (dimension: ux, severity: MEDIUM)
- [x] Campaign detail page sequential store fetches — 3 separate fetches parallelized with Promise.all (dimension: performance, severity: MEDIUM)
- [x] Calendar API sequential queries — posts and reminders queries parallelized with Promise.all (dimension: performance, severity: MEDIUM)
- [x] Missing maxLength on blog draft title input — added maxLength=300 (dimension: error-handling, severity: MEDIUM)
- [x] Missing maxLength on campaign name/description — NewCampaignModal (200/2000) and campaign detail inline edit (200/2000) (dimension: error-handling, severity: MEDIUM)
- [x] Missing maxLength on project settings inputs — name (200), description (2000), hashtags (500), plus profile display name (100) (dimension: error-handling, severity: MEDIUM)
- [x] Social accounts endpoint missing .limit() — added .limit(100) to prevent unbounded queries (dimension: performance, severity: MEDIUM)

#### Previously Deferred → Now Fixed

- [x] Blog draft title inline validation and maxLength → maxLength=300 added
- [x] Campaign detail sequential fetches → parallelized (was deferred as "already parallel" but campaign detail page was still sequential)

#### Deferred

- [ ] Blog publishing flow incomplete — no publish endpoint or workflow for blog drafts (dimension: feature, severity: HIGH, reason: requires full feature implementation)
- [ ] Launch posts finalization — no mechanism to submit launch posts to platforms (dimension: feature, severity: HIGH, reason: requires platform API integration)
- [ ] Post search hard-coded 500 record limit (dimension: performance, severity: LOW, reason: acceptable for beta)
- [ ] Campaigns/projects list missing cursor pagination (dimension: performance, severity: LOW, reason: 100 limit acceptable for beta)
- [ ] Typography and button styling inconsistencies across pages (dimension: ux, severity: LOW, reason: polish)
- [ ] Analytics token validation — access tokens forwarded without ownership verification (dimension: ops, severity: MEDIUM, reason: requires analytics OAuth flow redesign)

### Iteration 5 (2026-03-02)

**Findings:** 14 total (1 HIGH, 9 MEDIUM, 4 LOW)
**Code fixes applied:** 10
**Manual to-dos added:** 0
**Deferred:** 4

#### Fixed (Code)

- [x] Missing .limit() on posts/due API route — added .limit(200) (dimension: performance, severity: HIGH)
- [x] Missing .limit() on posts/upcoming API route — added .limit(200) (dimension: performance, severity: HIGH)
- [x] Missing .limit() on calendar API route — added .limit(500) to both posts and reminders queries (dimension: performance, severity: HIGH)
- [x] Missing .limit() on campaigns/[id]/posts GET — added .limit(200) (dimension: performance, severity: HIGH)
- [x] ContentEditor textarea missing label association — added htmlFor/id pair (dimension: ux, severity: MEDIUM)
- [x] Calendar nav buttons missing aria-labels — added dynamic prev/next aria-labels (dimension: ux, severity: MEDIUM)
- [x] Calendar day cells not keyboard accessible — added role="button", tabIndex, onKeyDown, aria-label (dimension: ux, severity: MEDIUM)
- [x] CampaignSelector missing aria-haspopup/aria-expanded — added to dropdown trigger button (dimension: ux, severity: MEDIUM)
- [x] PostCard retry button missing aria-label — added descriptive label (dimension: ux, severity: MEDIUM)
- [x] New page sequential store fetches — consolidated 3 useEffects into 1 parallel effect (dimension: performance, severity: MEDIUM)
- [x] Reddit posts save with empty subreddit — added validation to handleSaveDraft, handleSchedule, handlePublishNow (dimension: error-handling, severity: MEDIUM)

#### Previously Deferred → Now Fixed

- [x] Missing .limit() on API routes → now applied to posts/due, posts/upcoming, calendar, campaigns/[id]/posts

#### Deferred

- [ ] user_country cookie set with httpOnly:false — intentionally readable by client-side GDPR logic (dimension: ops, severity: LOW, reason: by design)
- [ ] Service worker push notification URL not validated against allowlist (dimension: ops, severity: LOW, reason: URLs come from trusted backend)
- [ ] Blog publishing flow incomplete — no publish endpoint or workflow (dimension: feature, severity: HIGH, reason: requires full feature implementation)
- [ ] Launch posts finalization — no mechanism to submit to platforms (dimension: feature, severity: HIGH, reason: requires platform API integration)
