# Beta Audit Iteration 2 — Design

Addresses all remaining HIGH and MEDIUM code findings from iteration 1, plus manual to-dos.

---

## 1. Error Handling

### request.json() try-catch (HIGH, ~20 API routes)

Create `parseJsonBody<T>(request: Request)` helper in `src/lib/auth.ts` that wraps `request.json()` with try-catch, returning `{ data: T } | { error: Response }`. Apply across all POST/PATCH/PUT API routes.

### Store error states in UI (HIGH, 3 pages)

Add error banners to posts, campaigns, and launch-posts pages. Follow the pattern in `src/app/(dashboard)/projects/page.tsx` which already displays store errors correctly.

---

## 2. UX & Accessibility

### Focus trap in modals (HIGH)

Use the `inert` attribute on background content when modals are open. Apply in `ResponsiveDialog` — when open, set `inert` on the main content behind the dialog. No new dependency needed.

### Header nav touch targets (HIGH)

Increase padding and add `min-h-[44px] min-w-[44px]` to header nav buttons in `AppHeader.tsx`. WCAG 2.5.5 / Apple HIG require 44x44px minimum.

### Backdrop click protection (HIGH)

Add `preventBackdropClose` prop to `ResponsiveDialog`. When true (e.g., form has unsaved changes), clicking backdrop shows a confirm prompt instead of closing. Callers pass their dirty state.

### Email notifications "Coming Soon" (HIGH)

Grey out email toggles in `NotificationSections.tsx`. Add "Email notifications coming soon" subtitle. Keep DB preference storage — when email service is added, preferences will already exist.

### Media publish warning (HIGH)

Show a warning banner in the editor when a post has media attachments: "Media attachments are not yet supported for publishing. Your text will be published without images/videos." Display when post has media AND status is being set to scheduled.

### ARIA labels on form sections (MEDIUM)

Add `aria-label` attributes to form section groups in `ContentEditor.tsx` and related editor components.

### Dead AccountPicker UI (MEDIUM)

Change "This feature is under development" to "Connect social accounts in Settings to publish from this project." with a link to Settings.

---

## 3. Performance

### Campaign detail / edit page sequential fetches (MEDIUM)

Combine sequential useEffects into single `Promise.all()` in `campaigns/[id]/page.tsx` and `edit/[id]/page.tsx`.

### searchDrafts() deduplication (MEDIUM)

Wrap `searchDrafts()` in blogDrafts store with `dedup()`. Add input debounce (300ms) in the blog page search handler.

---

## 4. Database & Ops

### Database indexes (MEDIUM)

Create a Supabase migration adding indexes:
- `posts(user_id, status, scheduled_at)`
- `campaigns(user_id, project_id, status)`
- `blog_drafts(user_id, status)`
- `launch_posts(user_id, status)`
- `reminders(user_id, remind_at)`

### Env var documentation (MEDIUM)

Update `docs/plans/beta-manual-todos.md` with step-by-step Vercel instructions for:
- Setting `CRON_SECRET`
- Verifying `NEXT_PUBLIC_SENTRY_DSN`
- Enabling Vercel Analytics for Core Web Vitals

---

## Not Changing

- **Rate limiting fail-open** — intentional per CLAUDE.md
- **Pro plan upgrade flow** — "Coming Soon" is acceptable for beta
- **OAuth callback connection ID in URL** — low risk, deferred
