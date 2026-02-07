# Bullhorn

Social media post scheduler for Twitter, LinkedIn, and Reddit.

## Stack

- **Framework**: Next.js 14 (App Router)
- **Database**: Supabase (PostgreSQL + Auth + Storage)
- **State**: Zustand stores
- **Styling**: Tailwind CSS with custom sticker bomb design system
- **Hosting**: Vercel
- **Production URL**: https://bullhorn.to
- **Supabase project ref**: `jvoppjybagyeffklbohr`

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
```

## Architecture

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

- Primary (gold): `--primary: 43 96% 56%` (`#fbbf24`)
- Accent (pink): `--accent: 330 80% 60%` (`#ec4899`)
- Border: `--border: 220 20% 20%` (strong black)
- Gold variants: `--gold: 43 96% 56%`, `--gold-dark: 38 89% 45%`
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
- **Test mode**: `E2E_TEST_MODE=true` bypasses auth in non-production (uses test user `00000000-0000-0000-0000-000000000001`)
- Run `make test-run` for CI, `make test` for watch mode, `make test-e2e` for E2E

## Git Conventions

Commit format: `<type>: <description> [(#PR)]`

Types: `feat`, `fix`, `test`, `docs`, `chore`, `security`, `perf`

Examples:
- `feat: add campaign detail page (#45)`
- `fix: resolve auth redirect loop`
- `test: add E2E tests for launch posts (#73)`

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

### Agents

| Agent | Purpose | When to invoke |
|-------|---------|----------------|
| `code-reviewer` | Review code against project conventions | After completing a feature or PR |
| `security-reviewer` | Focused security audit (OWASP, auth, RLS) | After auth/API/database changes |
| `ios-tester` | Test workflows on iOS Simulator | After UI changes affecting mobile |

### Hooks (automatic)

- **protect-files** (PreToolUse): Blocks edits to `.env.local`, `package-lock.json`, and existing migrations
- **auto-format** (PostToolUse): Runs Prettier on `.ts`, `.tsx`, `.css` files after edits
- **typecheck** (PostToolUse): Runs `tsc --noEmit` after `.ts`/`.tsx` edits to surface type errors

### MCP Servers

| Server | Purpose |
|--------|---------|
| `context7` | Library documentation lookup |
| `playwright` | Browser automation for E2E testing |
| `github` | GitHub API (PRs, issues, repos) |
| `supabase` | Database queries, migrations, edge functions |

## Guardrails

### General

- When a tool or approach fails 3+ times in a row (e.g., simulator crashes, browser click failures), stop retrying and suggest an alternative approach or escalate to the user instead of repeating the same failing command.
- Before starting, review this file for project constraints. If unsure about the approach, present 2-3 options with tradeoffs BEFORE implementing.

### Debugging

- When debugging auth/webhook 401 errors, check infrastructure-level blocks first (Vercel Authentication, Cloudflare bot protection, iframe restrictions) before assuming application-level secret mismatches.
- When debugging build or runtime errors, check environment configuration before blaming application code.

### Environment & Secrets

- This project uses Doppler for secrets management. Always ensure the session/environment is started with `doppler run` when Supabase, Vercel, or other service credentials are needed. Never suggest redundant secret storage across Doppler and Vercel — Doppler is the source of truth.

### CI/CD

- When CI/E2E tests require secrets or credentials, always verify they are configured before running. Never let CI jobs run indefinitely with placeholder credentials — fail fast with clear error messages.
- Always run `prettier --write` on changed files before committing. Ensure all reformatted files are included in commits.

### Database

- When deploying database changes, always verify migrations are applied to ALL environments (production AND staging). After applying migrations, verify the schema cache is refreshed and RLS policies are updated.
- Never edit existing migration files — create new ones with `make db-new name=description`.

## Known Issues

- **Invisible gold buttons**: Gold/yellow buttons (#fbbf24) on cream background have near-zero contrast. Affects: New Campaign, Create Campaign submit, CTA empty state buttons.
- **Dark theme**: May not render correctly in production.
