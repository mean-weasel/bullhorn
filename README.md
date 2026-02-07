# Bullhorn

**Bold scheduling for bold brands.** A social media post scheduler for Twitter, LinkedIn, and Reddit -- built with a sticker bomb aesthetic that is as loud as your content.

Bullhorn lets you draft, organize, and schedule social media posts across multiple platforms from a single dashboard. Group posts into campaigns, manage them under projects, and track performance with built-in analytics.

## Features

- **Multi-platform scheduling** -- compose and schedule posts for Twitter, LinkedIn, and Reddit from one place
- **Campaigns** -- group related posts into campaigns for coordinated launches and themed content runs
- **Projects** -- organize campaigns and posts under projects to keep workspaces clean
- **Launch posts** -- dedicated workflow for product launches with platform-specific variants
- **Blog drafts** -- write and manage long-form blog content alongside your social posts
- **Analytics** -- connect accounts and track engagement metrics from the analytics dashboard
- **Media uploads** -- attach images and media to posts with Supabase Storage
- **Dark mode** -- toggle between light and dark themes
- **Mobile-ready** -- responsive UI with iOS Capacitor support

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | [Next.js 14](https://nextjs.org) (App Router) |
| Database | [Supabase](https://supabase.com) (PostgreSQL + Auth + Storage) |
| State management | [Zustand](https://zustand-demo.pmnd.rs) |
| Styling | [Tailwind CSS](https://tailwindcss.com) with custom sticker bomb design system |
| Hosting | [Vercel](https://vercel.com) |
| Testing | [Vitest](https://vitest.dev) (unit) + [Playwright](https://playwright.dev) (E2E) |
| Mobile | [Capacitor](https://capacitorjs.com) (iOS) |

## Getting Started

### Prerequisites

- Node.js 18+
- npm
- [Supabase CLI](https://supabase.com/docs/guides/cli) (for local development)

### Installation

```bash
# Clone the repository
git clone https://github.com/mean-weasel/bullhorn.git
cd bullhorn

# Install dependencies
npm install
```

### Environment Setup

Copy the example environment file and fill in your Supabase credentials:

```bash
cp .env.example .env.local
```

See [`.env.example`](.env.example) for the required variables. For local development, run `supabase start` and grab the values from `supabase status`.

### Start the Dev Server

```bash
make dev
```

The app will be available at [http://localhost:3000](http://localhost:3000).

To start Supabase and Next.js together:

```bash
make dev-full
```

## Available Commands

This project uses a Makefile for common tasks. Run `make help` to see all available targets.

```
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
make ci             # Full CI checks (lint + typecheck + tests)
```

## Testing

**Unit tests** are written with Vitest. Test files live alongside source code at `src/**/*.test.ts`.

```bash
make test       # Watch mode
make test-run   # Single run (CI)
```

**End-to-end tests** use Playwright. Test files are in the `e2e/` directory.

```bash
make test-e2e   # Run E2E tests
```

## Project Structure

```
src/
  app/
    (auth)/         # Login, signup, password reset
    (dashboard)/    # Authenticated pages (dashboard, posts, campaigns, projects, etc.)
    api/            # API routes
  components/
    ui/             # Shared UI components
    projects/       # Project-related components
    campaigns/      # Campaign-related components
    launch-posts/   # Launch post components
    analytics/      # Analytics components
  hooks/            # Custom React hooks
  lib/              # Utilities, stores, Supabase clients, auth helpers
```

## Production

Bullhorn is live at [https://bullhorn.to](https://bullhorn.to).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on how to contribute to this project.

## Security

To report a vulnerability, see [SECURITY.md](SECURITY.md).

## License

See [LICENSE](LICENSE) for details.
