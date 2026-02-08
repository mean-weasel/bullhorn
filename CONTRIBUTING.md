# Contributing to Bullhorn

Thanks for your interest in contributing to Bullhorn, a social media post scheduler for Twitter, LinkedIn, and Reddit. This guide covers everything you need to get started.

## Development Setup

1. Clone the repository and install dependencies:

```bash
git clone https://github.com/<org>/bullhorn.git
cd bullhorn
npm install
```

2. Copy the environment template and fill in the required values:

```bash
cp .env.example .env.local
```

3. Start the development server:

```bash
make dev
```

The app will be available at `http://localhost:3000`.

## Make Commands

This project uses a Makefile for all common tasks. Run `make help` to see every target.

| Command | Description |
|---------|-------------|
| `make dev` | Start Next.js dev server (port 3000) |
| `make build` | Build for production |
| `make check` | Run ESLint + TypeScript type checking |
| `make fix` | Auto-fix ESLint + Prettier issues |
| `make test` | Unit tests in watch mode (Vitest) |
| `make test-run` | Unit tests, single run |
| `make test-e2e` | End-to-end tests (Playwright) |
| `make lint` | ESLint only |
| `make typecheck` | TypeScript type checking only |
| `make ci` | Full CI checks locally (lint + typecheck + tests) |

## Code Style

### Prettier

The project uses Prettier with the following configuration:

- No semicolons
- Single quotes
- 2-space indentation
- Trailing commas in ES5 positions
- 100-character print width

Run `make fix` to auto-format all files.

### ESLint

Key rules enforced by ESLint:

- **300 lines per file** maximum
- **50 lines per function** maximum
- **120 characters per line** maximum
- Security rules are enabled (`detect-unsafe-regex`, `detect-buffer-noassert`, `detect-eval-with-expression`)

Run `make lint` to check for violations.

## Commit Conventions

Use the format: `<type>: <description>`

| Type | Use for |
|------|---------|
| `feat` | New features |
| `fix` | Bug fixes |
| `test` | Adding or updating tests |
| `docs` | Documentation changes |
| `chore` | Build, config, dependency updates |
| `security` | Security-related changes |
| `perf` | Performance improvements |

Examples:

```
feat: add campaign detail page (#45)
fix: resolve auth redirect loop
test: add E2E tests for launch posts (#73)
```

## Pull Request Process

1. Create a feature branch from `main`.
2. Make your changes, keeping commits focused and following the conventions above.
3. Run `make ci` and ensure it passes (lint, typecheck, and tests).
4. Run `make fix` to format all changed files before committing.
5. Open a pull request against `main`.

## Architecture Overview

### App Router Structure

The project uses Next.js 14 with the App Router. Pages are organized under `src/app/`:

- `(auth)/` -- Login, signup, password reset, OAuth callback
- `(dashboard)/` -- All authenticated pages (dashboard, posts, campaigns, projects, settings, etc.)
- `api/` -- API route handlers

### API Route Pattern

Every API route follows a consistent structure:

1. Call `requireAuth()` first -- returns `{ userId }` or throws `'Unauthorized'`.
2. Create a Supabase server client with `createClient()`.
3. Filter all queries by `.eq('user_id', userId)` for ownership enforcement.
4. Transform database responses from snake_case to camelCase using `transformXFromDb()`.
5. Use standard HTTP status codes: 401 (unauthorized), 400 (bad request), 404 (not found), 500 (server error).

### Zustand Store Pattern

Client-side state uses Zustand stores with a consistent shape:

- State: `{ items, loading, error, initialized }`
- Actions: `fetchX`, `addX`, `updateX`, `deleteX`
- All fetch actions use `dedup()` with `createDedupKey()` to prevent duplicate API requests.

### Data Transforms

The database uses snake_case column names. The frontend uses camelCase. Transform functions live in `src/lib/utils.ts`:

- `transformPostFromDb()` / `transformPostToDb()`
- `transformCampaignFromDb()`
- `transformProjectFromDb()` / `transformProjectToDb()`
- Generic helpers: `snakeToCamel()` / `camelToSnake()`

### Path Alias

The alias `@/*` maps to `./src/*`, configured in `tsconfig.json`. Use it for all imports:

```typescript
import { requireAuth } from '@/lib/auth'
import { cn } from '@/lib/utils'
```

## Testing

### Unit Tests (Vitest)

- Test files live alongside source files at `src/**/*.test.ts`.
- Run with `make test` (watch mode) or `make test-run` (single run).

### End-to-End Tests (Playwright)

- Test files live at `e2e/*.spec.ts`.
- Run with `make test-e2e`.
- Setting `E2E_TEST_MODE=true` bypasses authentication in non-production environments, using a fixed test user ID.

### Database Migrations

- Create new migrations with `make db-new name=description`.
- Apply migrations with `make db-push`.
- Never edit existing migration files. Always create new ones.

## Security

To report a security vulnerability, please see [SECURITY.md](./SECURITY.md).
