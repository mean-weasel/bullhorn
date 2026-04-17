# Bullhorn

Social media post scheduler for Twitter, LinkedIn, and Reddit.

## Stack

- **Framework**: Next.js 15 (App Router)
- **Database**: Supabase (PostgreSQL + Auth + Storage)
- **State**: Zustand stores
- **Styling**: Tailwind CSS with custom sticker bomb design system
- **Hosting**: Vercel
- **Production URL**: https://bullhorn.to
- **Supabase project ref**: `<your-supabase-project-ref>`

## Dev Commands

Prefer `make` commands. Run `make help` to see all targets.

```bash
make dev            # Start Next.js dev server (port 3000)
make dev-full       # Start Supabase + Next.js together
make build          # Build for production
make check          # Run ESLint + TypeScript type checking
make fix            # Auto-fix ESLint + Prettier
make format         # Format with Prettier
make test           # Unit tests (Vitest, watch mode)
make test-run       # Unit tests (single run)
make test-e2e       # E2E tests (Playwright)
make lint           # ESLint only
make typecheck      # TypeScript only
make knip           # Dead code / unused dependency check
make db-new name=x  # Create new migration
make db-push        # Push migrations to remote Supabase
make db-reset       # Reset local database
make clean          # Remove build artifacts
make ci             # Run full CI checks locally (lint + typecheck + tests)
make self-host-init # Clone Supabase Docker, create env files (first time)
make self-host-up   # Start self-hosted Supabase Docker stack
make self-host-down # Stop self-hosted Supabase Docker stack
make self-host-dev  # Start Supabase Docker + Next.js with internal cron
```

## Architecture

> See also: [docs/architecture.md](docs/architecture.md) for a standalone reference.

### App Router Structure

```
src/app/
  (auth)/           # Auth pages: login, signup, forgot-password, reset-password
    auth/callback/  # OAuth callback route
  (dashboard)/      # Authenticated pages with shared layout
    dashboard/      # Main dashboard
    posts/          # Post list
    new/            # Create post
    edit/[id]/      # Edit post
    campaigns/      # Campaign list + [id] detail
    projects/       # Project list + [id] detail
    launch-posts/   # Launch posts list + new + [id]
    blog/           # Blog drafts list + new + [id]
    settings/       # User settings
    profile/        # User profile
    components/     # Dashboard-scoped components (AppHeader, BottomNav, UserMenu)
  api/              # API routes (see pattern below)
  access-denied/    # Access denied page
```

### Components

```
src/components/
  ui/               # Shared UI: ConfirmDialog, MediaUpload, IOSActionSheet, IOSDateTimePicker, etc.
  projects/         # ProjectCard, ProjectSelector, CreateProjectModal, AccountPicker
  campaigns/        # MoveCampaignModal
  launch-posts/     # LaunchPostCard, LaunchPostForm
  analytics/        # AnalyticsDashboard, ConnectAnalyticsModal
```

### Libs (`src/lib/`)

| File | Purpose |
|------|---------|
| `auth.ts` | `requireAuth()`, `getOptionalAuth()`, ownership validators |
| `utils.ts` | `cn()`, `snakeToCamel/camelToSnake`, `transformXFromDb/ToDb` functions |
| `requestDedup.ts` | `dedup()`, `createDedupKey()` for Zustand request deduplication |
| `posts.ts` | Type definitions (Post, Campaign, Project, Platform, etc.) |
| `campaigns.ts` | Zustand store: `useCampaignsStore` |
| `projects.ts` | Zustand store: `useProjectsStore` |
| `blogDrafts.ts` | Zustand store: `useBlogDraftsStore` |
| `launchPosts.ts` | Zustand store: `useLaunchPostsStore` |
| `analyticsStore.ts` | Zustand store: `useAnalyticsStore` |
| `media.ts` | Media upload utilities |
| `storage.ts` | Supabase storage helpers |
| `profile.ts` | User profile utilities |
| `notifications.ts` | Notification system |
| `theme.tsx` | Theme provider (light/dark) |
| `supabase/server.ts` | Server-side Supabase client |
| `supabase/client.ts` | Browser-side Supabase client |
| `selfHosted.ts` | `isSelfHosted()` — runtime mode check for self-hosted vs SaaS |
| `scheduler.ts` | `node-cron` scheduler for self-hosted mode (publish + token refresh) |
| `tokenRefresh.ts` | OAuth token refresh + Reddit password grant (`refreshRedditViaPasswordGrant()`) |
| `cronAuth.ts` | `verifyCronSecret()` — timing-safe cron endpoint auth |
| `limits.ts` | `PlanType` (`free`, `pro`, `selfHosted`), `PLAN_LIMITS`, `PLAN_FEATURES` |
| `planEnforcement.ts` | `getUserPlan()`, `enforceResourceLimit()`, `enforceStorageLimit()` |

### Custom Hooks (`src/hooks/`)

- `useKeyboardShortcuts.ts` — Global keyboard shortcuts
- `useUnsavedChanges.ts` — Unsaved changes warning
- `useAutoSave.ts` — Auto-save functionality

## Patterns

### API Route Pattern

Every API route follows this structure:

```typescript
import { requireAuth } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { transformXFromDb } from '@/lib/utils'

export async function GET() {
  try {
    const { userId } = await requireAuth()
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('table_name')
      .select('*')
      .eq('user_id', userId)

    if (error) throw error

    return Response.json({ items: data.map(transformXFromDb) })
  } catch (error) {
    if ((error as Error).message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

Key points:
- Always call `requireAuth()` first — returns `{ userId }` or throws `'Unauthorized'`
- Always filter by `.eq('user_id', userId)` for RLS-like ownership checks
- Always apply `transformXFromDb()` to map snake_case DB fields to camelCase
- Standard error status codes: 401 (unauthorized), 400 (bad request), 404 (not found), 500 (server error)

### Zustand Store Pattern

```typescript
import { create } from 'zustand'
import { dedup, createDedupKey } from './requestDedup'

interface XState {
  items: Item[]
  loading: boolean
  error: string | null
  initialized: boolean
}

interface XActions {
  fetchItems: () => Promise<void>
  addItem: (data: CreateInput) => Promise<Item>
  updateItem: (id: string, updates: Partial<Item>) => Promise<void>
  deleteItem: (id: string) => Promise<void>
}

export const useXStore = create<XState & XActions>()((set, get) => ({
  items: [],
  loading: false,
  error: null,
  initialized: false,

  fetchItems: async () => {
    const key = createDedupKey('fetchItems')
    return dedup(key, async () => {
      set({ loading: true, error: null })
      try {
        const res = await fetch('/api/items')
        if (!res.ok) throw new Error('Failed to fetch')
        const data = await res.json()
        set({ items: data.items, loading: false, initialized: true })
      } catch (error) {
        set({ error: (error as Error).message, loading: false })
      }
    })
  },
  // ... addItem, updateItem, deleteItem follow same pattern
}))
```

Key points:
- State shape: `{ items, loading, error, initialized }`
- CRUD actions: `fetchX`, `addX`, `updateX`, `deleteX`
- Use `dedup()` with `createDedupKey()` to prevent duplicate API requests
- Optimistic updates where appropriate

### Supabase

- **Server client**: `import { createClient } from '@/lib/supabase/server'` — for API routes and Server Components
- **Browser client**: `import { createClient } from '@/lib/supabase/client'` — for Client Components
- **RLS**: All tables enforce ownership via `user_id` column with `auth.uid() = user_id` policies
- **Migrations**: Create with `make db-new name=description`, apply with `make db-push`
- **Never edit existing migration files** — create new ones instead

### Data Transforms

All Supabase responses use snake_case. The frontend uses camelCase. Transform functions in `src/lib/utils.ts`:

- `transformPostFromDb()` / `transformPostToDb()`
- `transformCampaignFromDb()`
- `transformProjectFromDb()` / `transformProjectToDb()`
- `transformAnalyticsConnectionFromDb()` / `transformAnalyticsConnectionToDb()`
- Generic: `snakeToCamel()` / `camelToSnake()`

## Design System

**Sticker bomb aesthetic** — bold borders, offset shadows, vibrant colors.

### CSS Variables (from `src/index.css`)

- Primary (gold): `--primary: 38 92% 42%` (`#ce9a08`)
- Accent (pink): `--accent: 330 80% 60%` (`#ec4899`)
- Border: `--border: 220 20% 20%` (strong black)
- Gold variants: `--gold: 38 92% 42%`, `--gold-dark: 36 92% 30%`
- Font: Nunito (sans), JetBrains Mono (mono)

### Utility Classes

| Class | Effect |
|-------|--------|
| `.sticker-card` | 3px border, 4px shadow, rounded-lg |
| `.sticker-card-hover` | Same + hover lift effect |
| `.sticker-button` | 3px border, 3px shadow, rounded-md, bold |
| `.sticker-input` | 3px border, 3px shadow, focus ring |
| `.sticker-badge` | Inline pill badge with 2px border |

### Tailwind Colors

Platform colors: `twitter` (blue), `linkedin` (blue), `reddit` (orange) — each with `DEFAULT`, `soft`, and `border` variants.

Sticker palette: `sticker-yellow`, `sticker-pink`, `sticker-purple`, `sticker-green`, `sticker-blue`, `sticker-orange`, `sticker-black`.

### Component Conventions

- Use `'use client'` directive for interactive components
- Use `cn()` from `@/lib/utils` for conditional class merging
- Type all props with explicit interfaces
- Follow sticker design system for consistency

## LSP Usage

When navigating code, always prefer the LSP tool (`goToDefinition`, `findReferences`, `documentSymbol`, `hover`) over Grep/Glob for symbol lookup. Use Grep only for text patterns that are not code symbols (e.g. string literals, comments, config values).

If the LSP tool is unavailable or returns errors, stop and inform the user. Either the `typescript-lsp` plugin needs to be reinstalled (`/plugin` → Discover → `typescript-lsp`) or the language server binary is missing (`npm install -g typescript-language-server typescript`). Do not silently fall back to Grep.

## Code Quality

### Prettier Config (`.prettierrc`)

```json
{ "semi": false, "singleQuote": true, "tabWidth": 2, "trailingComma": "es5", "printWidth": 100 }
```

### ESLint Config (`.eslintrc.cjs`)

- Extends: `eslint:recommended`, `@typescript-eslint/recommended`, `react-hooks/recommended`
- Plugins: `react-refresh`, `security`
- Limits: 300 lines/file, 50 lines/function, 120 chars/line
- Security rules: `detect-unsafe-regex` (error), `detect-buffer-noassert` (error), `detect-eval-with-expression` (error), `detect-possible-timing-attacks` (warn)

### Path Alias

`@/*` maps to `./src/*` (configured in `tsconfig.json`)

## Testing

- **Unit tests**: Vitest — files at `src/**/*.test.ts`
- **E2E tests**: Playwright — files at `e2e/*.spec.ts`
- **Self-hosted E2E**: `e2e/self-hosted.spec.ts` — runs with `SELF_HOSTED=true`, separate CI job
- **Test mode**: `E2E_TEST_MODE=true` bypasses auth in non-production (uses test user `00000000-0000-0000-0000-000000000001`)
- Run `make test-run` for CI, `make test` for watch mode, `make test-e2e` for E2E

## Git Conventions

Commit format: `<type>: <description>`

**Every commit MUST start with an allowed type prefix.** These prefixes drive automatic
versioning via semantic-release. Using the wrong type will create an incorrect version bump.
Commits are validated by a commitlint git hook — invalid messages will be rejected.

| Type | Version Bump | When to Use |
|------|-------------|-------------|
| `feat` | Minor (1.0→1.1) | New feature or user-facing capability |
| `fix` | Patch (1.0.0→1.0.1) | Bug fix |
| `perf` | Patch | Performance improvement |
| `security` | Patch | Security fix |
| `docs` | No release | Documentation only |
| `test` | No release | Adding/updating tests |
| `chore` | No release | Maintenance, deps, config |
| `refactor` | No release | Code restructure, no behavior change |
| `ci` | No release | CI/CD pipeline changes |
| `style` | No release | Formatting, whitespace |

For breaking changes, add `!` after the type: `feat!: redesign auth flow`
This triggers a major version bump (1.0→2.0).

Guidelines:
- First line: 50 chars max, imperative mood ("add feature" not "added feature")
- Use `feat` only for genuinely new capabilities — not for extending existing ones (use `fix` or `refactor`)
- Use `chore` for dependency updates, config changes, and anything that doesn't affect the shipped product
- When in doubt between `feat` and `fix`, prefer `fix` — it's safer (patch bump vs minor bump)

## Automations

### Skills

| Command | Purpose | When to use |
|---------|---------|-------------|
| `/db-migrate <name>` | Create and apply a Supabase migration | Adding/changing database schema |
| `/audit-rls` | Scan tables for missing RLS policies | After `/db-migrate`, or periodically |
| `/scaffold-api <path> <methods>` | Generate boilerplate API route | Creating new API endpoints |
| `/gen-test <file>` | Generate unit tests for a file | After implementing new code |
| `/ship` | Build, lint, typecheck, and deploy | Ready to deploy changes |
| `/monitor-ci` | Watch CI pipeline and debug failures | After pushing to remote |
| `/deploy-check` | Check Vercel deployment status and drift | After merging or to verify production state |
| `/e2e-debug` | Systematic Playwright failure diagnosis | A CI E2E shard fails and you need to find root cause |

### Agents

| Agent | Purpose | When to invoke |
|-------|---------|----------------|
| `code-reviewer` | Review code against project conventions | After completing a feature or PR |
| `security-reviewer` | Focused security audit (OWASP, auth, RLS) | After auth/API/database changes |
| `ios-tester` | Test workflows on iOS Simulator | After UI changes affecting mobile |
| `performance-analyzer` | Find query, store, and bundle performance issues | After adding API routes, stores, or heavy components |
| `e2e-reviewer` | Review Playwright specs for selector stability, race conditions, prod-vs-dev fragility | After writing or modifying E2E tests |

### Hooks (automatic)

- **protect-files** (PreToolUse, Edit|Write): Blocks edits to `.env.local`, `package-lock.json`, and existing migrations
- **enforce-pr-review** (PreToolUse, Bash): Blocks `gh pr create` until `/pr-review-toolkit:review-pr all` has run; append ` # reviewed` to the command after running the review to bypass. Copied verbatim from [neonwatty/pr-review-hooks](https://github.com/neonwatty/pr-review-hooks) for clean upstream pulls.
- **auto-format** (PostToolUse): Runs Prettier on `.ts`, `.tsx`, `.css` files after edits
- **typecheck** (PostToolUse): Runs `tsc --noEmit` after `.ts`/`.tsx` edits to surface type errors
- **lint-security** (PostToolUse): Runs ESLint security rules on edited `.ts`/`.tsx` files
- **run-related-tests** (PostToolUse): Runs sibling `.test.ts`/`.test.tsx` files after source edits
- **pre-commit** (git): Runs lint, typecheck, unit tests, and format check before every commit. Install with `make install-hooks`

### MCP Servers

| Server | Purpose |
|--------|---------|
| `context7` | Library documentation lookup |
| `playwright` | Browser automation for E2E testing |
| `github` | GitHub API (PRs, issues, repos) |
| `supabase` | Database queries, migrations, edge functions |
## Self-Hosted Mode

Bullhorn supports self-hosting with BYOK (Bring Your Own Keys). See [docs/self-hosting.md](docs/self-hosting.md) for the full setup guide.

### How it works

Self-hosted mode is activated by the runtime env var `SELF_HOSTED=true`. The single utility function `isSelfHosted()` in `src/lib/selfHosted.ts` gates all behavioral differences — no code forks, no separate build.

### Key differences from SaaS mode

| Behavior | SaaS | Self-Hosted |
|----------|------|-------------|
| Plan type | `free` or `pro` (from DB) | `selfHosted` (hardcoded, no DB query) |
| Resource limits | Enforced per plan tier | All unlimited (`Number.MAX_SAFE_INTEGER`) |
| Reddit auth | OAuth (authorization_code grant) | Script auth (password grant) — no browser redirect |
| Cron scheduling | Vercel Cron (external) | `node-cron` in `instrumentation.ts` (internal) |
| Auto-publish | Pro only, excludes Reddit | All platforms including Reddit |
| Token refresh | Skips accounts without `refresh_token` | Falls back to password grant for Reddit |

### Pattern: `isSelfHosted()` gate

When adding self-hosted-specific behavior, always use the `isSelfHosted()` function — never check `process.env.SELF_HOSTED` directly:

```typescript
import { isSelfHosted } from '@/lib/selfHosted'

if (isSelfHosted()) {
  // Self-hosted behavior
} else {
  // SaaS behavior
}
```

### Plan enforcement

`getUserPlan()` in `planEnforcement.ts` short-circuits to `'selfHosted'` when `isSelfHosted()` is true, bypassing the DB query entirely. The `selfHosted` entry in `PLAN_LIMITS` uses `Number.MAX_SAFE_INTEGER` for all fields, so existing `enforceResourceLimit()` / `enforceStorageLimit()` calls work without modification.

### Reddit script auth

Self-hosted Reddit uses password grant instead of OAuth. Key files:
- `src/app/api/social-accounts/reddit/connect/route.ts` — POST endpoint for password grant
- `src/app/api/social-accounts/reddit/auth/route.ts` — delegates to connect when self-hosted + `REDDIT_USERNAME` and `REDDIT_PASSWORD` are set
- `src/lib/tokenRefresh.ts` — `refreshRedditViaPasswordGrant()` shared between connect and token refresh

### Internal cron scheduler

`src/instrumentation.ts` starts `node-cron` when `SELF_HOSTED=true`. The scheduler itself requires `CRON_SECRET` to be set (checked in `scheduler.ts`). Two jobs run every 5 minutes:
- `/api/cron/publish` — auto-publishes due posts
- `/api/cron/refresh-tokens` — rotates expiring OAuth tokens

### E2E testing

Self-hosted mode has a dedicated CI job (`e2e-self-hosted`) that runs `e2e/self-hosted.spec.ts` with `SELF_HOSTED=true`. It reuses the same `.next` build artifact as SaaS E2E tests because `SELF_HOSTED` is a server-side runtime env var (not `NEXT_PUBLIC_`). To run locally:

```bash
SELF_HOSTED=true npx playwright test e2e/self-hosted.spec.ts
```

## iOS App (Capacitor)

- **Mode**: Remote URL — WKWebView loads `bullhorn.to`, not a local bundle
- **Platform detection**: User agent marker `BullhornCapacitor` via `isNativePlatform()` in `src/lib/capacitor.ts`
- **Bundle ID**: `to.bullhorn.app`
- **Team ID**: Set via `APNS_TEAM_ID` env var
- **Apple App ID**: Set in App Store Connect

### Local iOS Testing

Test server-side changes (CSP, headers, API routes, components) in the Capacitor WebView **before** deploying:

```bash
make dev                                              # Start Next.js dev server (port 3000)
CAPACITOR_SERVER_URL=http://localhost:3000 npx cap sync ios   # Point WebView at localhost
npx cap open ios                                      # Open Xcode, then Cmd+R to run on Simulator
```

Debug the WebView: Safari → Develop menu → Simulator → inspect page (full console/network/DOM).

Reset to production when done: `npx cap sync ios` (no env var defaults to `bullhorn.to`).

**Note**: Server-side-only fixes (CSP, headers) don't require an iOS rebuild — the existing TestFlight build loads from `bullhorn.to`, so deploying to Vercel is enough.

### iOS Build & Deploy

See `DEPLOY.md` (gitignored) for build commands, TestFlight upload, and signing configuration.

Contributors: You will need your own Apple Developer account and App Store Connect API key. See [CONTRIBUTING.md](CONTRIBUTING.md) for setup instructions.

## Guardrails

### General

- When a tool or approach fails 3+ times in a row (e.g., simulator crashes, browser click failures), stop retrying and suggest an alternative approach or escalate to the user instead of repeating the same failing command.
- Before starting, review this file for project constraints. If unsure about the approach, present 2-3 options with tradeoffs BEFORE implementing.

### Debugging

- When debugging auth/webhook 401 errors, check infrastructure-level blocks first (Vercel Authentication, Cloudflare bot protection, iframe restrictions) before assuming application-level secret mismatches.
- When debugging build or runtime errors, check environment configuration before blaming application code.

### Environment & Secrets

- **Vercel is the source of truth** for all secrets. Runtime secrets (Supabase keys, Google OAuth client IDs, etc.) live in Vercel environment variables across Production/Preview/Development.
- **Supabase CLI auth**: `SUPABASE_ACCESS_TOKEN` is set in the local shell environment (e.g. `~/.zshrc`). Used by `supabase db push` and other CLI commands. Not a runtime secret.
- **App Store Connect API keys** (`ASC_KEY_ID`, `ASC_ISSUER_ID`) are stored in Vercel. The `.p8` private key file is stored locally at `~/.appstoreconnect/private_keys/` and registered with the `asc` CLI keychain.
- **Environment variables are validated on startup** - see `src/lib/envValidation.ts` and `docs/environment-variables.md` for details
- **Upstash Redis** (`UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`) is **recommended but optional** - enables rate limiting (10 req/10sec per IP). If not configured, rate limiting is disabled with warnings logged.

### CI/CD

- When CI/E2E tests require secrets or credentials, always verify they are configured before running. Never let CI jobs run indefinitely with placeholder credentials — fail fast with clear error messages.
- Always run `prettier --write` on changed files before committing. Ensure all reformatted files are included in commits.

### Database

- When deploying database changes, always verify migrations are applied to ALL environments (production AND staging). After applying migrations, verify the schema cache is refreshed and RLS policies are updated.
- Never edit existing migration files — create new ones with `make db-new name=description`.

## Playwright Profiles

Authenticated browser profiles are available at `.playwright/profiles/`.
Available profiles:
- **free-user**: Free plan user — default tier with standard limits
  Test files: valid-image.png (valid), valid-video.mp4 (valid), oversized-image.png (error case), corrupted-file.jpg (error case)
  Acceptance: upload accepted, processing completes
- **pro-user**: Pro plan user — premium tier with expanded limits
  Test files: valid-image.png (valid), valid-video.mp4 (valid), oversized-image.png (error case), corrupted-file.jpg (error case)
  Acceptance: upload accepted, processing completes

Config: `.playwright/profiles.json`
To load a profile, use `playwright-cli -s={session} state-load .playwright/profiles/<role>.json` to restore cookies and localStorage. Restore sessionStorage entries individually with `sessionstorage-set` if the profile includes them.
Run `/setup-profiles` to create new profiles or refresh expired sessions.

## Known Issues

- **~~Invisible gold buttons~~**: Fixed. Gold darkened from `#fbbf24` to `#ce9a08` (WCAG AA compliant).
- **Dark theme**: May not render correctly in production.
