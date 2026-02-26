# Bullhorn

> Social media post scheduler for Twitter, LinkedIn, and Reddit.

Bullhorn helps builders, indie hackers, and product engineers plan, draft, and schedule their social media content. Organize posts into campaigns and projects, schedule publish dates, and manage your content pipeline from idea to published.

**Live at [bullhorn.to](https://bullhorn.to)**

## Features

- **Multi-platform drafting** — Write posts for Twitter, LinkedIn, and Reddit with platform-specific formatting and character limits
- **Campaigns & projects** — Organize posts into campaigns, group campaigns into projects
- **Scheduling** — Set publish dates and track your content pipeline
- **Blog drafts** — Write long-form content with Markdown support
- **Launch posts** — Dedicated workspace for product launch announcements
- **Media uploads** — Attach images to posts with Supabase Storage
- **API & MCP** — Programmatic access via API keys, plus an MCP server for AI-native workflows
- **iOS app** — Native iOS app via Capacitor (TestFlight)

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router) |
| Database | Supabase (PostgreSQL + Auth + Storage) |
| State | Zustand |
| Styling | Tailwind CSS |
| Hosting | Vercel |
| iOS | Capacitor 8 |
| Monitoring | Sentry |

## Getting Started

```bash
# Install dependencies
npm install

# Set up environment
cp .env.example .env.local
# Fill in your Supabase credentials

# Start dev server
make dev
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for detailed setup instructions.

## Development

```bash
make dev          # Start dev server
make check        # Lint + typecheck
make test         # Unit tests (watch)
make test-e2e     # E2E tests
make ci           # Full CI checks
```

Run `make help` to see all available commands.

## Architecture

See [CLAUDE.md](CLAUDE.md) for detailed architecture documentation including app structure, API patterns, store patterns, and design system.

## License

[AGPL-3.0](LICENSE)

Copyright (C) 2026 Mean Weasel LLC
