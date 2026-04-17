# Self-Hosting Guide

Run Bullhorn entirely on your own infrastructure — no Vercel account, no cloud Supabase project, no third-party dependencies beyond the social platform APIs you want to use.

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) and [Docker Compose](https://docs.docker.com/compose/install/) (v2+)
- Node.js 20+
- npm
- Git

## Quick Start

```bash
git clone https://github.com/neonwatty/bullhorn.git
cd bullhorn
npm install
make self-host-init    # Clones Supabase Docker, creates env files
# Edit self-hosted/.env with generated secrets
# Edit .env.local with your platform API keys
make self-host-up      # Start Supabase Docker stack
# Link the Supabase CLI to your local Docker database:
supabase link --project-ref local --db-url postgresql://postgres:your-postgres-password@localhost:5432/postgres
make db-push           # Apply database migrations
make self-host-dev     # Start Next.js with internal cron
```

Open [http://localhost:3000](http://localhost:3000) and sign up for your first account.

## Platform App Setup

Bullhorn needs OAuth apps registered with each social platform you want to publish to. Complete only the platforms you intend to use.

### Twitter / X

1. Go to [https://developer.x.com/en/portal/dashboard](https://developer.x.com/en/portal/dashboard)
2. Create a new **Project**, then create an **App** within it
3. Under **User Authentication Settings**, enable **OAuth 2.0**
4. Set **App permissions** to **Read and Write**
5. Add a callback URL: `http://localhost:3000/api/social-accounts/twitter/callback`
6. Set the website URL to: `http://localhost:3000`
7. Copy **Client ID** and **Client Secret** to `.env.local`:

```bash
TWITTER_CLIENT_ID=your-client-id
TWITTER_CLIENT_SECRET=your-client-secret
```

### LinkedIn

1. Go to [https://www.linkedin.com/developers/apps](https://www.linkedin.com/developers/apps)
2. Create a new app. You will need a LinkedIn Company Page — create a personal one if you do not already have one.
3. Under **Products**, request access to:
   - **Share on LinkedIn**
   - **Sign In with LinkedIn using OpenID Connect**
4. Under the **Auth** tab, add a redirect URL: `http://localhost:3000/api/social-accounts/linkedin/callback`
5. Copy **Client ID** and **Client Secret** to `.env.local`:

```bash
LINKEDIN_CLIENT_ID=your-client-id
LINKEDIN_CLIENT_SECRET=your-client-secret
```

> Note: LinkedIn product access requests are reviewed manually and may take a day or two to approve.

### Reddit

Reddit self-hosted mode uses **script auth** (password grant) rather than OAuth, which means no redirect flow — your credentials are stored directly in `.env.local` and used to authenticate silently when you connect your account.

1. Go to [https://www.reddit.com/prefs/apps](https://www.reddit.com/prefs/apps)
2. Click **create another app...** at the bottom of the page
3. Select **script** as the app type
4. Set the redirect URI to `http://localhost:3000` (required by Reddit but not used for script auth)
5. Click **create app**
6. Copy the **Client ID** (shown under the app name, below "personal use script") and **Client Secret**
7. Add all Reddit credentials to `.env.local`:

```bash
REDDIT_CLIENT_ID=your-client-id
REDDIT_CLIENT_SECRET=your-client-secret
REDDIT_USERNAME=your-reddit-username
REDDIT_PASSWORD=your-reddit-password
REDDIT_USER_AGENT=web:bullhorn-scheduler:v1.0.0 (by /u/your-reddit-username)
```

> With script auth, connecting Reddit in the Settings page auto-authenticates immediately without any OAuth redirect.

## Architecture

Self-hosted mode runs everything locally in Docker:

**Supabase Docker** (5 services managed by Docker Compose):
- **PostgreSQL** — primary database
- **GoTrue** — authentication service (email/password, OAuth)
- **PostgREST** — auto-generated REST API over PostgreSQL
- **Kong** — API gateway that routes requests to GoTrue and PostgREST
- **Storage** — file and media storage

**Next.js** runs with an internal cron scheduler powered by `node-cron`. Two jobs run every 5 minutes:
- **Publish scheduler** — picks up posts whose scheduled time has passed and publishes them to their target platforms
- **Token refresh** — proactively refreshes expiring OAuth tokens for connected social accounts

No external cron service (Vercel Crons, GitHub Actions, etc.) is required. The scheduler starts automatically when you run `make self-host-dev`.

**Plan enforcement is disabled** in self-hosted mode. All features are available without limits — no post quotas, no platform connection limits, no feature gating.

## Environment Variables

Two env files control the self-hosted stack:

**`self-hosted/.env`** — Supabase Docker configuration (JWT secrets, database password, API keys for the local stack). Copied from the official Supabase Docker template by `make self-host-init`. You must manually replace the placeholder secrets — see the printed instructions after running the setup. You should not need to edit this further unless you want to change ports or the Postgres password.

**`.env.local`** — Next.js runtime configuration. Copy from `.env.self-hosted.example`:

```bash
cp .env.self-hosted.example .env.local
```

Key variables to set in `.env.local`:

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Local Supabase URL (e.g. `http://localhost:8000`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Anon key from `self-hosted/.env` |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Service role key from `self-hosted/.env` |
| `TWITTER_CLIENT_ID` / `TWITTER_CLIENT_SECRET` | Optional | Twitter OAuth app credentials |
| `LINKEDIN_CLIENT_ID` / `LINKEDIN_CLIENT_SECRET` | Optional | LinkedIn OAuth app credentials |
| `REDDIT_CLIENT_ID` / `REDDIT_CLIENT_SECRET` | Optional | Reddit script app credentials |
| `REDDIT_USERNAME` / `REDDIT_PASSWORD` | Optional | Reddit account for script auth |
| `REDDIT_USER_AGENT` | Optional | Reddit API user agent string |

See `.env.self-hosted.example` for all available variables and `docs/environment-variables.md` for full descriptions.

## Connecting Accounts

After starting the app:

1. Open [http://localhost:3000/signup](http://localhost:3000/signup) and create your account
2. Navigate to **Settings**
3. **Connect Twitter** — click the button to be redirected to X for OAuth authorization
4. **Connect LinkedIn** — click the button to be redirected to LinkedIn for OAuth authorization
5. **Connect Reddit** — click the button; script auth runs silently using the credentials in `.env.local`, no redirect required

Once connected, go to **New Post** and start scheduling.

## Updating

Pull the latest changes and re-apply any new migrations:

```bash
git pull
npm install
make db-push
make build
```

If the Docker stack is running, restart it after pulling:

```bash
make self-host-down
make self-host-up
```

## Troubleshooting

**Docker not running**
Ensure Docker Desktop (or the Docker daemon) is running before executing `make self-host-up`. On Linux, run `sudo systemctl start docker` if needed.

**Port conflicts**
By default the Supabase Docker stack uses ports 8000 (API gateway), 5432 (Postgres), and 3001 (Studio). Next.js uses 3000. If any of these are occupied, stop the conflicting service or edit the port mappings in `self-hosted/docker-compose.yml`.

**Reddit auth failures**
Double-check that the app type is set to **script** (not "web app" or "installed app") in the Reddit app settings. Verify your `REDDIT_USERNAME` and `REDDIT_PASSWORD` values are correct and that your account does not have 2FA enabled (script auth does not support 2FA).

**Token refresh errors**
If a connected account shows a token error in Settings, disconnect and reconnect the account. OAuth tokens that expired before the refresh scheduler could rotate them require a fresh authorization grant.

**Migration failures**
If `make db-push` fails, check that the Supabase Docker stack is fully up (`make self-host-up` reports all services healthy) before pushing. You can also run `supabase db reset` against the local stack to start from a clean slate.

**Supabase Studio**
Access the local database UI at [http://localhost:3001](http://localhost:3001) to inspect tables, run queries, and debug data issues.
