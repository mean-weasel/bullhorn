# Contributing to Bullhorn

Thanks for your interest in contributing to Bullhorn! This guide will help you get set up.

## Prerequisites

- Node.js 20+
- A [Supabase](https://supabase.com) project (free tier works)
- A [Vercel](https://vercel.com) account (for deployment, optional for local dev)

## Local Development Setup

1. **Fork and clone** the repository

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up environment variables:**
   ```bash
   cp .env.example .env.local
   ```
   Fill in your Supabase URL, anon key, and service role key. See `docs/environment-variables.md` for all options.

4. **Set up MCP config (optional, for Claude Code users):**
   ```bash
   cp .mcp.json.example .mcp.json
   ```
   Fill in your Supabase project ref.

5. **Start the dev server:**
   ```bash
   make dev
   ```

6. **Run checks before committing:**
   ```bash
   make ci    # lint + typecheck + tests
   ```

## Code Style

- **Prettier** handles formatting (runs automatically via pre-commit hook)
- **ESLint** enforces code quality rules
- **TypeScript** strict mode — no `any` types
- Run `make fix` to auto-fix lint and formatting issues

## Commit Messages

We use [Conventional Commits](https://www.conventionalcommits.org/). A commitlint hook validates your messages.

| Prefix | When to use |
|--------|-------------|
| `feat:` | New feature |
| `fix:` | Bug fix |
| `chore:` | Maintenance, deps |
| `refactor:` | Code restructure |
| `docs:` | Documentation |
| `test:` | Tests |

## Testing

```bash
make test          # Unit tests (watch mode)
make test-run      # Unit tests (single run)
make test-e2e      # E2E tests (Playwright)
```

## Project Structure

See `CLAUDE.md` for a detailed architecture overview including:
- App Router structure
- API route patterns
- Zustand store patterns
- Design system (sticker bomb aesthetic)

## Forking — Values You Must Change

If you're forking Bullhorn to run your own instance, update these project-specific values:

| Value | Location | What to set |
|-------|----------|-------------|
| Bundle ID | `capacitor.config.ts` → `appId` | Your own reverse-domain ID (e.g. `com.yourorg.app`) |
| `APNS_TEAM_ID` | Environment variable | Your Apple Developer Team ID |
| `APNS_KEY_ID` | Environment variable | Your APNs auth key ID |
| `APNS_PRIVATE_KEY` | Environment variable | Your APNs `.p8` key contents |
| `GOOGLE_IOS_CLIENT_ID` | Environment variable | Your Google OAuth iOS client ID |
| `GOOGLE_WEB_CLIENT_ID` | Environment variable | Your Google OAuth web client ID |
| `NEXT_PUBLIC_APP_URL` | Environment variable | Your production URL |

See `docs/environment-variables.md` for the full list of environment variables.

## iOS Development (Optional)

The iOS app is a Capacitor 8 wrapper. To work on it:
1. Set `GOOGLE_IOS_CLIENT_ID` and `GOOGLE_WEB_CLIENT_ID` in your environment
2. Run `npx cap sync ios` to generate the Xcode project
3. You'll need your own Apple Developer account for signing

## Pull Requests

1. Create a feature branch from `main`
2. Make your changes with tests
3. Run `make ci` to verify everything passes
4. Open a PR with a clear description
5. PRs require passing CI before merge

## License

By contributing, you agree that your contributions will be licensed under the [AGPL-3.0 License](LICENSE).
