# Beta Launch Plan — Twitter/X Integration + Production Readiness

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Get Bullhorn ready for closed beta testers by adding Twitter/X publishing (the core value prop), legal compliance, security hardening, and monitoring.

**Architecture:** 3 phases with 8 parallel worktrees. Phase 1 builds the publishing pipeline (Twitter OAuth + API client + scheduled publishing). Phase 2 adds legal pages and security fixes. Phase 3 polishes onboarding and monitoring. Worktrees within each phase have zero file overlap and run simultaneously.

**Tech Stack:** Next.js 15, Supabase, Twitter API v2 (OAuth 2.0 PKCE, Free tier), Vercel Cron, Sentry, Zod

---

## Parallelization Map

```
PHASE 1 — Core Value (Twitter Publishing)
├── Worktree A: social_accounts migration + Twitter OAuth flow + API client
├── Worktree B: Publishing engine (API route + Vercel Cron)  [after A merges]
└── Worktree C: Connect Twitter UI + Publish button UI      [after A merges]

PHASE 2 — Legal & Safety (all run in parallel with each other)
├── Worktree D: Legal pages (Terms, Privacy, Cookie consent)
├── Worktree E: Security fixes (pre-launch plan items not yet applied)
└── Worktree F: Account deletion API endpoint

PHASE 3 — Beta Polish (all run in parallel with each other)
├── Worktree G: Monitoring (Sentry tracing, alerting, structured errors)
└── Worktree H: Onboarding flow + empty states + usage notifications

DEPENDENCY GRAPH:
  Phase 2 (D, E, F) can start IMMEDIATELY — no dependency on Phase 1
  Phase 1 Worktrees B, C depend on Worktree A merging first
  Phase 3 (G, H) can start IMMEDIATELY — no dependency on Phase 1 or 2

MAXIMUM PARALLELISM:
  Wave 1: Worktrees A + D + E + F + G + H  (6 simultaneous)
  Wave 2: Worktrees B + C                   (2 simultaneous, after A merges)
```

---

## PHASE 1 — Twitter/X Publishing

### Worktree A: Social Accounts + Twitter OAuth + API Client

**Branch:** `feat/twitter-oauth`

#### Task A1: Create social_accounts Database Migration

**Files:**
- Create: `supabase/migrations/20260225100000_create_social_accounts.sql`

**Step 1: Create migration file**

```sql
-- Social accounts table for storing OAuth tokens per platform
CREATE TABLE social_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('twitter', 'linkedin', 'reddit')),
  platform_user_id TEXT NOT NULL,
  platform_username TEXT,
  platform_display_name TEXT,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  scopes TEXT[] DEFAULT '{}',
  connected_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, platform, platform_user_id)
);

-- Indexes
CREATE INDEX social_accounts_user_id_idx ON social_accounts(user_id);
CREATE INDEX social_accounts_platform_idx ON social_accounts(platform);
CREATE INDEX social_accounts_user_platform_idx ON social_accounts(user_id, platform);

-- RLS
ALTER TABLE social_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own social accounts"
  ON social_accounts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own social accounts"
  ON social_accounts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own social accounts"
  ON social_accounts FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own social accounts"
  ON social_accounts FOR DELETE
  USING (auth.uid() = user_id);

-- Updated_at trigger
CREATE TRIGGER set_social_accounts_updated_at
  BEFORE UPDATE ON social_accounts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add publish_result columns to posts for tracking publish state
ALTER TABLE posts ADD COLUMN IF NOT EXISTS social_account_id UUID REFERENCES social_accounts(id) ON DELETE SET NULL;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS publish_error TEXT;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS platform_post_id TEXT;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS platform_post_url TEXT;

CREATE INDEX posts_social_account_id_idx ON posts(social_account_id);
CREATE INDEX posts_published_at_idx ON posts(published_at);
```

**Step 2: Commit**

```bash
git add supabase/migrations/20260225100000_create_social_accounts.sql
git commit -m "$(cat <<'EOF'
feat: add social_accounts table and publish tracking columns on posts
EOF
)"
```

---

#### Task A2: Create Twitter API Client Library

**Files:**
- Create: `src/lib/twitter.ts`
- Create: `src/lib/twitter.test.ts`

**Step 1: Write failing tests**

Create `src/lib/twitter.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFetch = vi.fn()
global.fetch = mockFetch

describe('TwitterClient', () => {
  beforeEach(() => {
    vi.resetModules()
    mockFetch.mockReset()
    vi.stubEnv('TWITTER_CLIENT_ID', 'test-client-id')
    vi.stubEnv('TWITTER_CLIENT_SECRET', 'test-client-secret')
  })

  describe('getAuthUrl', () => {
    it('returns a valid Twitter OAuth 2.0 URL with PKCE', async () => {
      const { getAuthUrl } = await import('./twitter')
      const { url, state, codeVerifier } = getAuthUrl('http://localhost:3000/api/auth/twitter/callback')
      expect(url).toContain('https://twitter.com/i/oauth2/authorize')
      expect(url).toContain('code_challenge=')
      expect(url).toContain('state=')
      expect(url).toContain('scope=tweet.write+tweet.read+users.read+offline.access')
      expect(state).toBeTruthy()
      expect(codeVerifier).toBeTruthy()
    })
  })

  describe('exchangeCodeForTokens', () => {
    it('exchanges authorization code for tokens', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'access-123',
          refresh_token: 'refresh-456',
          expires_in: 7200,
          token_type: 'bearer',
          scope: 'tweet.write tweet.read users.read offline.access',
        }),
      })
      const { exchangeCodeForTokens } = await import('./twitter')
      const result = await exchangeCodeForTokens(
        'auth-code-123',
        'verifier-456',
        'http://localhost:3000/api/auth/twitter/callback'
      )
      expect(result.accessToken).toBe('access-123')
      expect(result.refreshToken).toBe('refresh-456')
      expect(result.expiresIn).toBe(7200)
    })

    it('throws on failed token exchange', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ error: 'invalid_grant' }),
      })
      const { exchangeCodeForTokens } = await import('./twitter')
      await expect(
        exchangeCodeForTokens('bad-code', 'verifier', 'http://localhost:3000/api/auth/twitter/callback')
      ).rejects.toThrow('Token exchange failed')
    })
  })

  describe('refreshAccessToken', () => {
    it('refreshes an expired access token', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'new-access-789',
          refresh_token: 'new-refresh-012',
          expires_in: 7200,
        }),
      })
      const { refreshAccessToken } = await import('./twitter')
      const result = await refreshAccessToken('refresh-456')
      expect(result.accessToken).toBe('new-access-789')
      expect(result.refreshToken).toBe('new-refresh-012')
    })
  })

  describe('postTweet', () => {
    it('posts a tweet and returns the tweet ID and URL', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: { id: 'tweet-123', text: 'Hello world' },
        }),
      })
      const { postTweet } = await import('./twitter')
      const result = await postTweet('access-token', 'Hello world')
      expect(result.id).toBe('tweet-123')
      expect(result.url).toContain('tweet-123')
    })

    it('throws on failed tweet post', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({ detail: 'Forbidden' }),
      })
      const { postTweet } = await import('./twitter')
      await expect(postTweet('bad-token', 'Hello')).rejects.toThrow()
    })
  })

  describe('getTwitterUser', () => {
    it('fetches the authenticated user profile', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: { id: 'user-123', username: 'testuser', name: 'Test User' },
        }),
      })
      const { getTwitterUser } = await import('./twitter')
      const user = await getTwitterUser('access-token')
      expect(user.id).toBe('user-123')
      expect(user.username).toBe('testuser')
    })
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/twitter.test.ts`
Expected: FAIL — module `./twitter` doesn't exist.

**Step 3: Create Twitter client**

Create `src/lib/twitter.ts`:

```typescript
import crypto from 'crypto'

const TWITTER_AUTH_URL = 'https://twitter.com/i/oauth2/authorize'
const TWITTER_TOKEN_URL = 'https://api.twitter.com/2/oauth2/token'
const TWITTER_API_BASE = 'https://api.twitter.com/2'

// Twitter Free tier scopes: tweet.write is the critical one
// tweet.read + users.read needed to fetch user profile after connect
// offline.access needed for refresh tokens
const SCOPES = ['tweet.write', 'tweet.read', 'users.read', 'offline.access']

function base64URLEncode(buffer: Buffer): string {
  return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

function sha256(input: string): Buffer {
  return crypto.createHash('sha256').update(input).digest()
}

/**
 * Generate Twitter OAuth 2.0 authorization URL with PKCE.
 * Returns the URL, state parameter, and code verifier (store both server-side).
 */
export function getAuthUrl(redirectUri: string): {
  url: string
  state: string
  codeVerifier: string
} {
  const state = crypto.randomUUID()
  const codeVerifier = base64URLEncode(crypto.randomBytes(32))
  const codeChallenge = base64URLEncode(sha256(codeVerifier))

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.TWITTER_CLIENT_ID!,
    redirect_uri: redirectUri,
    scope: SCOPES.join(' '),
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  })

  return {
    url: `${TWITTER_AUTH_URL}?${params.toString()}`,
    state,
    codeVerifier,
  }
}

/**
 * Exchange authorization code for access + refresh tokens.
 */
export async function exchangeCodeForTokens(
  code: string,
  codeVerifier: string,
  redirectUri: string
): Promise<{
  accessToken: string
  refreshToken: string
  expiresIn: number
  scope: string
}> {
  const clientId = process.env.TWITTER_CLIENT_ID!
  const clientSecret = process.env.TWITTER_CLIENT_SECRET!
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')

  const response = await fetch(TWITTER_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${credentials}`,
    },
    body: new URLSearchParams({
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
      code_verifier: codeVerifier,
    }),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(`Token exchange failed: ${error.error || response.status}`)
  }

  const data = await response.json()
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
    scope: data.scope || '',
  }
}

/**
 * Refresh an expired access token using the refresh token.
 */
export async function refreshAccessToken(refreshToken: string): Promise<{
  accessToken: string
  refreshToken: string
  expiresIn: number
}> {
  const clientId = process.env.TWITTER_CLIENT_ID!
  const clientSecret = process.env.TWITTER_CLIENT_SECRET!
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')

  const response = await fetch(TWITTER_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${credentials}`,
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(`Token refresh failed: ${error.error || response.status}`)
  }

  const data = await response.json()
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
  }
}

/**
 * Post a tweet using the Twitter v2 API.
 * Returns the tweet ID and constructed URL.
 */
export async function postTweet(
  accessToken: string,
  text: string
): Promise<{ id: string; url: string }> {
  const response = await fetch(`${TWITTER_API_BASE}/tweets`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text }),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(
      `Tweet failed (${response.status}): ${error.detail || error.title || 'Unknown error'}`
    )
  }

  const data = await response.json()
  const tweetId = data.data.id
  return {
    id: tweetId,
    url: `https://x.com/i/status/${tweetId}`,
  }
}

/**
 * Fetch the authenticated Twitter user's profile.
 */
export async function getTwitterUser(accessToken: string): Promise<{
  id: string
  username: string
  name: string
}> {
  const response = await fetch(`${TWITTER_API_BASE}/users/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(`Failed to fetch user: ${error.detail || response.status}`)
  }

  const data = await response.json()
  return {
    id: data.data.id,
    username: data.data.username,
    name: data.data.name,
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/twitter.test.ts`
Expected: All 7 tests PASS.

**Step 5: Commit**

```bash
git add src/lib/twitter.ts src/lib/twitter.test.ts
git commit -m "$(cat <<'EOF'
feat: add Twitter API v2 client with OAuth 2.0 PKCE
EOF
)"
```

---

#### Task A3: Create Twitter OAuth API Routes

**Files:**
- Create: `src/app/api/auth/twitter/route.ts`
- Create: `src/app/api/auth/twitter/callback/route.ts`
- Create: `src/app/api/social-accounts/route.ts`

**Step 1: Create GET /api/auth/twitter — generates OAuth URL**

Create `src/app/api/auth/twitter/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { requireAuth } from '@/lib/auth'
import { getAuthUrl } from '@/lib/twitter'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    try {
      await requireAuth()
    } catch {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const clientId = process.env.TWITTER_CLIENT_ID
    if (!clientId) {
      return NextResponse.json(
        { error: 'Twitter integration not configured' },
        { status: 500 }
      )
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const redirectUri = `${baseUrl}/api/auth/twitter/callback`

    const { url, state, codeVerifier } = getAuthUrl(redirectUri)

    // Store state + code verifier in HTTP-only cookies (5 min expiry)
    const cookieStore = await cookies()
    const cookieOpts = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      maxAge: 300,
      path: '/',
    }
    cookieStore.set('twitter_oauth_state', state, cookieOpts)
    cookieStore.set('twitter_code_verifier', codeVerifier, cookieOpts)

    return NextResponse.json({ url })
  } catch (error) {
    console.error('Error generating Twitter OAuth URL:', error)
    return NextResponse.json({ error: 'Failed to generate OAuth URL' }, { status: 500 })
  }
}
```

**Step 2: Create GET /api/auth/twitter/callback — handles OAuth callback**

Create `src/app/api/auth/twitter/callback/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { requireAuth } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { exchangeCodeForTokens, getTwitterUser } from '@/lib/twitter'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  try {
    let userId: string
    try {
      const auth = await requireAuth()
      userId = auth.userId
    } catch {
      return NextResponse.redirect(`${baseUrl}/settings?error=unauthorized`)
    }

    const searchParams = request.nextUrl.searchParams
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const error = searchParams.get('error')

    // Validate CSRF state
    const cookieStore = await cookies()
    const storedState = cookieStore.get('twitter_oauth_state')?.value
    const codeVerifier = cookieStore.get('twitter_code_verifier')?.value

    // Clear cookies regardless of outcome
    cookieStore.set('twitter_oauth_state', '', { maxAge: 0, path: '/' })
    cookieStore.set('twitter_code_verifier', '', { maxAge: 0, path: '/' })

    if (!state || !storedState || state !== storedState) {
      console.error('Twitter OAuth state mismatch')
      return NextResponse.redirect(`${baseUrl}/settings?error=invalid_state`)
    }

    if (error) {
      console.error('Twitter OAuth error:', error)
      return NextResponse.redirect(
        `${baseUrl}/settings?error=oauth_denied&platform=twitter`
      )
    }

    if (!code || !codeVerifier) {
      return NextResponse.redirect(`${baseUrl}/settings?error=missing_code`)
    }

    // Exchange code for tokens
    const redirectUri = `${baseUrl}/api/auth/twitter/callback`
    const tokens = await exchangeCodeForTokens(code, codeVerifier, redirectUri)

    // Fetch Twitter user profile
    const twitterUser = await getTwitterUser(tokens.accessToken)

    // Upsert social account (update tokens if already connected)
    const supabase = await createClient()
    const tokenExpiresAt = new Date(
      Date.now() + tokens.expiresIn * 1000
    ).toISOString()

    const { error: dbError } = await supabase
      .from('social_accounts')
      .upsert(
        {
          user_id: userId,
          platform: 'twitter',
          platform_user_id: twitterUser.id,
          platform_username: twitterUser.username,
          platform_display_name: twitterUser.name,
          access_token: tokens.accessToken,
          refresh_token: tokens.refreshToken,
          token_expires_at: tokenExpiresAt,
          scopes: tokens.scope.split(' '),
          connected_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,platform,platform_user_id' }
      )

    if (dbError) {
      console.error('Failed to store Twitter account:', dbError)
      return NextResponse.redirect(`${baseUrl}/settings?error=save_failed`)
    }

    return NextResponse.redirect(
      `${baseUrl}/settings?twitter_connected=true&username=${twitterUser.username}`
    )
  } catch (err) {
    console.error('Twitter OAuth callback error:', err)
    return NextResponse.redirect(`${baseUrl}/settings?error=callback_failed`)
  }
}
```

**Step 3: Create /api/social-accounts — CRUD for connected accounts**

Create `src/app/api/social-accounts/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, validateScopes } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// GET — list connected social accounts (tokens excluded)
export async function GET() {
  try {
    const { userId, scopes } = await requireAuth()
    if (scopes) validateScopes(scopes, ['posts:read'])
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('social_accounts')
      .select('id, platform, platform_username, platform_display_name, connected_at')
      .eq('user_id', userId)
      .order('connected_at', { ascending: false })

    if (error) throw error

    return NextResponse.json({ accounts: data })
  } catch (error) {
    if ((error as Error).message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if ((error as Error).message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    console.error('Error fetching social accounts:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE — disconnect a social account
export async function DELETE(request: NextRequest) {
  try {
    const { userId, scopes } = await requireAuth()
    if (scopes) validateScopes(scopes, ['posts:write'])
    const supabase = await createClient()

    const { accountId } = await request.json()
    if (!accountId) {
      return NextResponse.json({ error: 'accountId is required' }, { status: 400 })
    }

    const { error } = await supabase
      .from('social_accounts')
      .delete()
      .eq('id', accountId)
      .eq('user_id', userId)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    if ((error as Error).message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if ((error as Error).message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    console.error('Error deleting social account:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

**Step 4: Run typecheck**

Run: `make typecheck`
Expected: PASS

**Step 5: Commit**

```bash
git add src/app/api/auth/twitter/route.ts src/app/api/auth/twitter/callback/route.ts src/app/api/social-accounts/route.ts
git commit -m "$(cat <<'EOF'
feat: add Twitter OAuth 2.0 PKCE flow and social accounts API
EOF
)"
```

---

#### Task A4: Add Twitter Env Vars to Validation

**Files:**
- Modify: `src/lib/envValidation.ts`

**Step 1: Add Twitter env vars as recommended**

After the existing Sentry entry (line 46), add:

```typescript
  {
    name: 'TWITTER_CLIENT_ID',
    required: false,
    description: 'Twitter OAuth 2.0 Client ID for social publishing',
  },
  {
    name: 'TWITTER_CLIENT_SECRET',
    required: false,
    description: 'Twitter OAuth 2.0 Client Secret',
  },
```

**Step 2: Commit**

```bash
git add src/lib/envValidation.ts
git commit -m "$(cat <<'EOF'
chore: add Twitter OAuth env vars to validation
EOF
)"
```

---

### Worktree B: Publishing Engine

**Branch:** `feat/publish-engine`
**Depends on:** Worktree A merged (needs social_accounts table + twitter.ts)

#### Task B1: Create Publish Service

**Files:**
- Create: `src/lib/publish.ts`
- Create: `src/lib/publish.test.ts`

**Step 1: Write failing tests**

Create `src/lib/publish.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock twitter client
vi.mock('./twitter', () => ({
  postTweet: vi.fn(),
  refreshAccessToken: vi.fn(),
}))

// Mock supabase
const mockSingle = vi.fn()
const mockEq2 = vi.fn(() => ({ single: mockSingle }))
const mockEq1 = vi.fn(() => ({ eq: mockEq2 }))
const mockSelect = vi.fn(() => ({ eq: mockEq1 }))
const mockUpdate = vi.fn(() => ({ eq: vi.fn(() => ({ eq: vi.fn() })) }))
const mockFrom = vi.fn(() => ({ select: mockSelect, update: mockUpdate }))

vi.mock('./supabase/server', () => ({
  createClient: vi.fn(() => Promise.resolve({ from: mockFrom })),
}))

describe('publishPost', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('publishes a twitter post and updates status', async () => {
    const { postTweet } = await import('./twitter')
    const mocked = vi.mocked(postTweet)
    mocked.mockResolvedValueOnce({ id: 'tweet-123', url: 'https://x.com/i/status/tweet-123' })

    mockSingle
      .mockResolvedValueOnce({
        data: {
          id: 'post-1',
          platform: 'twitter',
          content: { text: 'Hello world' },
          status: 'scheduled',
          social_account_id: 'sa-1',
          user_id: 'user-1',
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          id: 'sa-1',
          access_token: 'token',
          refresh_token: 'refresh',
          token_expires_at: new Date(Date.now() + 3600000).toISOString(),
        },
        error: null,
      })

    const { publishPost } = await import('./publish')
    const result = await publishPost('post-1', 'user-1')
    expect(result.success).toBe(true)
    expect(result.platformPostUrl).toContain('tweet-123')
  })

  it('returns error for unsupported platform', async () => {
    mockSingle.mockResolvedValueOnce({
      data: {
        id: 'post-1',
        platform: 'linkedin',
        content: { text: 'Hello' },
        status: 'scheduled',
        social_account_id: 'sa-1',
        user_id: 'user-1',
      },
      error: null,
    })

    const { publishPost } = await import('./publish')
    const result = await publishPost('post-1', 'user-1')
    expect(result.success).toBe(false)
    expect(result.error).toContain('not yet supported')
  })

  it('returns error when no social account is linked', async () => {
    mockSingle.mockResolvedValueOnce({
      data: {
        id: 'post-1',
        platform: 'twitter',
        content: { text: 'Hello' },
        status: 'scheduled',
        social_account_id: null,
        user_id: 'user-1',
      },
      error: null,
    })

    const { publishPost } = await import('./publish')
    const result = await publishPost('post-1', 'user-1')
    expect(result.success).toBe(false)
    expect(result.error).toContain('No social account')
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/publish.test.ts`
Expected: FAIL — module `./publish` doesn't exist.

**Step 3: Create publish service**

Create `src/lib/publish.ts`:

```typescript
import { createClient } from './supabase/server'
import { postTweet, refreshAccessToken } from './twitter'

export interface PublishResult {
  success: boolean
  platformPostId?: string
  platformPostUrl?: string
  error?: string
}

/**
 * Publish a post to its target platform.
 * Handles token refresh, API calls, and status updates.
 */
export async function publishPost(postId: string, userId: string): Promise<PublishResult> {
  const supabase = await createClient()

  // Fetch the post
  const { data: post, error: postError } = await supabase
    .from('posts')
    .select('id, platform, content, status, social_account_id, user_id')
    .eq('id', postId)
    .eq('user_id', userId)
    .single()

  if (postError || !post) {
    return { success: false, error: 'Post not found' }
  }

  if (!post.social_account_id) {
    return { success: false, error: 'No social account linked to this post' }
  }

  // Fetch the social account with tokens
  const { data: account, error: accountError } = await supabase
    .from('social_accounts')
    .select('id, access_token, refresh_token, token_expires_at')
    .eq('id', post.social_account_id)
    .eq('user_id', userId)
    .single()

  if (accountError || !account) {
    return { success: false, error: 'Social account not found' }
  }

  // Refresh token if expired (with 5 min buffer)
  let accessToken = account.access_token
  if (account.token_expires_at) {
    const expiresAt = new Date(account.token_expires_at)
    const buffer = 5 * 60 * 1000
    if (expiresAt.getTime() - Date.now() < buffer && account.refresh_token) {
      try {
        const refreshed = await refreshAccessToken(account.refresh_token)
        accessToken = refreshed.accessToken
        // Update stored tokens
        await supabase
          .from('social_accounts')
          .update({
            access_token: refreshed.accessToken,
            refresh_token: refreshed.refreshToken,
            token_expires_at: new Date(
              Date.now() + refreshed.expiresIn * 1000
            ).toISOString(),
          })
          .eq('id', account.id)
      } catch (err) {
        return {
          success: false,
          error: `Token refresh failed: ${(err as Error).message}`,
        }
      }
    }
  }

  // Publish based on platform
  try {
    let result: { id: string; url: string }

    switch (post.platform) {
      case 'twitter': {
        const content = post.content as { text: string }
        result = await postTweet(accessToken, content.text)
        break
      }
      default:
        return {
          success: false,
          error: `Platform "${post.platform}" is not yet supported for publishing`,
        }
    }

    // Update post with publish result
    await supabase
      .from('posts')
      .update({
        status: 'published',
        published_at: new Date().toISOString(),
        platform_post_id: result.id,
        platform_post_url: result.url,
        publish_error: null,
      })
      .eq('id', postId)

    return {
      success: true,
      platformPostId: result.id,
      platformPostUrl: result.url,
    }
  } catch (err) {
    const errorMsg = (err as Error).message

    // Update post with error
    await supabase
      .from('posts')
      .update({
        status: 'failed',
        publish_error: errorMsg,
      })
      .eq('id', postId)

    return { success: false, error: errorMsg }
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/publish.test.ts`
Expected: All 3 tests PASS.

**Step 5: Commit**

```bash
git add src/lib/publish.ts src/lib/publish.test.ts
git commit -m "$(cat <<'EOF'
feat: add publish service with token refresh and error handling
EOF
)"
```

---

#### Task B2: Create Publish API Route

**Files:**
- Create: `src/app/api/posts/[id]/publish/route.ts`

**Step 1: Create POST /api/posts/[id]/publish**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, validateScopes } from '@/lib/auth'
import { publishPost } from '@/lib/publish'

export const dynamic = 'force-dynamic'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function POST(_request: NextRequest, context: RouteContext) {
  try {
    const { userId, scopes } = await requireAuth()
    if (scopes) validateScopes(scopes, ['posts:write'])

    const { id: postId } = await context.params

    const result = await publishPost(postId, userId)

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 422 }
      )
    }

    return NextResponse.json({
      success: true,
      platformPostId: result.platformPostId,
      platformPostUrl: result.platformPostUrl,
    })
  } catch (error) {
    if ((error as Error).message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if ((error as Error).message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    console.error('Publish error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

**Step 2: Commit**

```bash
git add src/app/api/posts/[id]/publish/route.ts
git commit -m "$(cat <<'EOF'
feat: add POST /api/posts/[id]/publish endpoint
EOF
)"
```

---

#### Task B3: Create Vercel Cron for Scheduled Publishing

**Files:**
- Create: `src/app/api/cron/publish/route.ts`
- Modify: `vercel.json` (create if doesn't exist)

**Step 1: Create cron route**

Create `src/app/api/cron/publish/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseJsClient } from '@supabase/supabase-js'
import { publishPost } from '@/lib/publish'

export const dynamic = 'force-dynamic'

/**
 * Vercel Cron job — runs every minute.
 * Finds posts with status='scheduled' and scheduledAt <= now, then publishes them.
 * Protected by CRON_SECRET header (Vercel injects this automatically).
 */
export async function GET(request: NextRequest) {
  // Verify cron secret (Vercel sets this automatically for cron jobs)
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Use service role to query across all users
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: 'Not configured' }, { status: 500 })
  }

  const supabase = createSupabaseJsClient(supabaseUrl, serviceKey, {
    global: {
      fetch: (url: string | URL | Request, options?: RequestInit) =>
        fetch(url, { ...options, cache: 'no-store' }),
    },
  })

  // Find due posts: scheduled status, scheduledAt in the past, has a social account linked
  const now = new Date().toISOString()
  const { data: duePosts, error } = await supabase
    .from('posts')
    .select('id, user_id')
    .eq('status', 'scheduled')
    .not('social_account_id', 'is', null)
    .lte('scheduled_at', now)
    .order('scheduled_at', { ascending: true })
    .limit(20) // Process max 20 per minute to stay within rate limits

  if (error) {
    console.error('Cron: failed to fetch due posts:', error)
    return NextResponse.json({ error: 'Query failed' }, { status: 500 })
  }

  if (!duePosts || duePosts.length === 0) {
    return NextResponse.json({ published: 0, failed: 0 })
  }

  // Publish each post sequentially (respect Twitter rate limits)
  let published = 0
  let failed = 0

  for (const post of duePosts) {
    try {
      const result = await publishPost(post.id, post.user_id)
      if (result.success) {
        published++
      } else {
        failed++
        console.error(`Cron: failed to publish post ${post.id}:`, result.error)
      }
    } catch (err) {
      failed++
      console.error(`Cron: exception publishing post ${post.id}:`, err)
    }
  }

  return NextResponse.json({ published, failed, total: duePosts.length })
}
```

**Step 2: Create or update vercel.json with cron config**

Check if `vercel.json` exists, then add cron configuration:

```json
{
  "crons": [
    {
      "path": "/api/cron/publish",
      "schedule": "* * * * *"
    }
  ]
}
```

**Step 3: Add CRON_SECRET to env validation**

In `src/lib/envValidation.ts`, add after the Twitter entries:

```typescript
  {
    name: 'CRON_SECRET',
    required: false,
    description: 'Vercel Cron secret for scheduled publishing',
  },
```

**Step 4: Commit**

```bash
git add src/app/api/cron/publish/route.ts vercel.json src/lib/envValidation.ts
git commit -m "$(cat <<'EOF'
feat: add Vercel Cron job for scheduled post publishing
EOF
)"
```

---

### Worktree C: Connect Twitter UI + Publish Button

**Branch:** `feat/twitter-ui`
**Depends on:** Worktree A merged (needs social-accounts API)

#### Task C1: Create Social Accounts Zustand Store

**Files:**
- Create: `src/lib/socialAccounts.ts`

**Step 1: Create store**

```typescript
import { create } from 'zustand'
import { dedup, createDedupKey } from './requestDedup'

export interface SocialAccount {
  id: string
  platform: 'twitter' | 'linkedin' | 'reddit'
  platformUsername: string
  platformDisplayName: string
  connectedAt: string
}

interface SocialAccountsState {
  accounts: SocialAccount[]
  loading: boolean
  error: string | null
  initialized: boolean
}

interface SocialAccountsActions {
  fetchAccounts: () => Promise<void>
  disconnectAccount: (accountId: string) => Promise<void>
  getAccountByPlatform: (platform: string) => SocialAccount | undefined
}

export const useSocialAccountsStore = create<SocialAccountsState & SocialAccountsActions>()(
  (set, get) => ({
    accounts: [],
    loading: false,
    error: null,
    initialized: false,

    fetchAccounts: async () => {
      const key = createDedupKey('fetchSocialAccounts')
      return dedup(key, async () => {
        set({ loading: true, error: null })
        try {
          const res = await fetch('/api/social-accounts')
          if (!res.ok) throw new Error('Failed to fetch social accounts')
          const data = await res.json()
          const accounts = (data.accounts || []).map(
            (a: Record<string, unknown>) => ({
              id: a.id,
              platform: a.platform,
              platformUsername: a.platform_username,
              platformDisplayName: a.platform_display_name,
              connectedAt: a.connected_at,
            })
          )
          set({ accounts, loading: false, initialized: true })
        } catch (error) {
          set({ error: (error as Error).message, loading: false })
        }
      })
    },

    disconnectAccount: async (accountId: string) => {
      try {
        const res = await fetch('/api/social-accounts', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accountId }),
        })
        if (!res.ok) throw new Error('Failed to disconnect account')
        set({
          accounts: get().accounts.filter((a) => a.id !== accountId),
        })
      } catch (error) {
        set({ error: (error as Error).message })
      }
    },

    getAccountByPlatform: (platform: string) => {
      return get().accounts.find((a) => a.platform === platform)
    },
  })
)
```

**Step 2: Commit**

```bash
git add src/lib/socialAccounts.ts
git commit -m "$(cat <<'EOF'
feat: add Zustand store for social accounts
EOF
)"
```

---

#### Task C2: Create ConnectTwitter Component in Settings

**Files:**
- Create: `src/components/social/ConnectTwitterButton.tsx`
- Modify: `src/app/(dashboard)/settings/page.tsx` (add Social Accounts section)

**Step 1: Create ConnectTwitterButton component**

Create `src/components/social/ConnectTwitterButton.tsx`:

```typescript
'use client'

import { useState } from 'react'
import { Twitter } from 'lucide-react'
import { useSocialAccountsStore } from '@/lib/socialAccounts'

export function ConnectTwitterButton() {
  const [connecting, setConnecting] = useState(false)
  const { accounts, disconnectAccount } = useSocialAccountsStore()
  const twitterAccount = accounts.find((a) => a.platform === 'twitter')

  const handleConnect = async () => {
    setConnecting(true)
    try {
      const res = await fetch('/api/auth/twitter')
      if (!res.ok) throw new Error('Failed to get OAuth URL')
      const { url } = await res.json()
      window.location.href = url
    } catch (error) {
      console.error('Failed to connect Twitter:', error)
      setConnecting(false)
    }
  }

  const handleDisconnect = async () => {
    if (!twitterAccount) return
    if (!confirm('Disconnect your Twitter account? Scheduled posts will not be published.')) return
    await disconnectAccount(twitterAccount.id)
  }

  if (twitterAccount) {
    return (
      <div className="flex items-center justify-between p-4 sticker-card">
        <div className="flex items-center gap-3">
          <Twitter className="h-5 w-5 text-twitter" />
          <div>
            <p className="font-bold">@{twitterAccount.platformUsername}</p>
            <p className="text-sm text-muted-foreground">Connected</p>
          </div>
        </div>
        <button
          onClick={handleDisconnect}
          className="sticker-button text-sm px-3 py-1 bg-red-50 text-red-600 hover:bg-red-100"
        >
          Disconnect
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={handleConnect}
      disabled={connecting}
      className="sticker-button w-full flex items-center justify-center gap-2 py-3 bg-twitter/10 text-twitter hover:bg-twitter/20"
    >
      <Twitter className="h-5 w-5" />
      {connecting ? 'Connecting...' : 'Connect Twitter / X'}
    </button>
  )
}
```

**Step 2: Add Social Accounts section to Settings page**

In `src/app/(dashboard)/settings/page.tsx`, add a "Social Accounts" section before the existing "Plan & Usage" section. Import the component and the store, add a `useEffect` to fetch accounts on mount:

```typescript
import { ConnectTwitterButton } from '@/components/social/ConnectTwitterButton'
import { useSocialAccountsStore } from '@/lib/socialAccounts'

// Inside the component:
const { fetchAccounts, initialized: socialInitialized } = useSocialAccountsStore()

useEffect(() => {
  if (!socialInitialized) fetchAccounts()
}, [fetchAccounts, socialInitialized])

// In JSX, add section:
<section className="space-y-4">
  <h2 className="text-lg font-bold">Social Accounts</h2>
  <p className="text-sm text-muted-foreground">
    Connect your social media accounts to publish posts directly from Bullhorn.
  </p>
  <ConnectTwitterButton />
</section>
```

**Step 3: Run typecheck**

Run: `make typecheck`
Expected: PASS

**Step 4: Commit**

```bash
git add src/components/social/ConnectTwitterButton.tsx src/app/(dashboard)/settings/page.tsx
git commit -m "$(cat <<'EOF'
feat: add Connect Twitter button to settings page
EOF
)"
```

---

#### Task C3: Add Publish Button to Post Editor

**Files:**
- Create: `src/components/posts/PublishButton.tsx`
- Modify: Post editor page (add button)

**Step 1: Create PublishButton component**

Create `src/components/posts/PublishButton.tsx`:

```typescript
'use client'

import { useState } from 'react'
import { Send, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'

interface PublishButtonProps {
  postId: string
  platform: string
  hasSocialAccount: boolean
  disabled?: boolean
}

export function PublishButton({
  postId,
  platform,
  hasSocialAccount,
  disabled,
}: PublishButtonProps) {
  const [publishing, setPublishing] = useState(false)

  const handlePublish = async () => {
    if (!confirm(`Publish this post to ${platform} now?`)) return
    setPublishing(true)
    try {
      const res = await fetch(`/api/posts/${postId}/publish`, {
        method: 'POST',
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Publish failed')
        return
      }
      toast.success('Published successfully!')
      if (data.platformPostUrl) {
        window.open(data.platformPostUrl, '_blank')
      }
    } catch {
      toast.error('Failed to publish')
    } finally {
      setPublishing(false)
    }
  }

  if (!hasSocialAccount) {
    return (
      <p className="text-sm text-muted-foreground">
        Connect your {platform} account in Settings to publish.
      </p>
    )
  }

  return (
    <button
      onClick={handlePublish}
      disabled={disabled || publishing}
      className="sticker-button flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[hsl(var(--gold))] to-[hsl(var(--gold-dark))] text-white font-bold disabled:opacity-50"
    >
      {publishing ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Send className="h-4 w-4" />
      )}
      {publishing ? 'Publishing...' : 'Publish Now'}
    </button>
  )
}
```

**Step 2: Integrate into existing post editor**

The exact location depends on the current edit page structure. Add the `PublishButton` alongside existing action buttons in the post editor, passing the post's ID, platform, and whether a social account is connected for that platform.

**Step 3: Commit**

```bash
git add src/components/posts/PublishButton.tsx
git commit -m "$(cat <<'EOF'
feat: add Publish Now button to post editor
EOF
)"
```

---

## PHASE 2 — Legal & Safety

### Worktree D: Legal Pages

**Branch:** `feat/legal-pages`
**No dependencies — can start immediately**

#### Task D1: Create Terms of Service Page

**Files:**
- Create: `src/app/terms/page.tsx`

**Step 1: Create Terms page**

Create a server component at `src/app/terms/page.tsx` with standard SaaS terms covering: acceptance of terms, user accounts, acceptable use, content ownership, service availability, limitation of liability, termination, and governing law. Use the sticker design system styling. Include `<Metadata>` export for SEO.

Key content sections:
- Users retain ownership of their content
- Bullhorn stores OAuth tokens to publish on user's behalf
- Users are responsible for content they publish via the platform
- Free tier limits apply; Pro tier subject to payment terms
- Service provided "as is" during beta

**Step 2: Commit**

```bash
git add src/app/terms/page.tsx
git commit -m "$(cat <<'EOF'
feat: add Terms of Service page
EOF
)"
```

---

#### Task D2: Create Privacy Policy Page

**Files:**
- Create: `src/app/privacy/page.tsx`

**Step 1: Create Privacy page**

Create a server component covering: what data is collected (email, OAuth tokens, post content), how it's used, third-party services (Supabase, Vercel, Sentry, Twitter API), data retention, user rights (access, export, deletion), cookies used, and contact information.

Key content:
- Data collected: email, name, post content, scheduling data, OAuth tokens
- Third parties: Supabase (database), Vercel (hosting), Sentry (errors), Twitter API
- Users can export all data via Settings > Data Management
- Users can delete their account via Profile > Danger Zone
- OAuth tokens stored server-side, never exposed to client

**Step 2: Commit**

```bash
git add src/app/privacy/page.tsx
git commit -m "$(cat <<'EOF'
feat: add Privacy Policy page
EOF
)"
```

---

#### Task D3: Add Cookie Consent Banner

**Files:**
- Create: `src/components/ui/CookieConsent.tsx`
- Modify: `src/app/layout.tsx` (add banner)

**Step 1: Create CookieConsent component**

Create `src/components/ui/CookieConsent.tsx` — a simple banner that:
- Shows on first visit (check `localStorage` for `cookie_consent`)
- Explains: "We use cookies for authentication and analytics"
- Has "Accept" button that sets `cookie_consent=accepted` in localStorage
- Has link to /privacy
- Sticks to bottom of viewport
- Uses sticker design system styling

**Step 2: Add to root layout**

In `src/app/layout.tsx`, add `<CookieConsent />` before closing `</body>`.

**Step 3: Commit**

```bash
git add src/components/ui/CookieConsent.tsx src/app/layout.tsx
git commit -m "$(cat <<'EOF'
feat: add cookie consent banner with link to privacy policy
EOF
)"
```

---

#### Task D4: Add Legal Links to Footer/Settings

**Files:**
- Modify: `src/app/(dashboard)/settings/page.tsx` (About section)
- Modify: `src/app/(auth)/login/page.tsx` (add links below login form)

**Step 1: Add links to Settings About section and login page**

Add "Terms of Service" and "Privacy Policy" links pointing to `/terms` and `/privacy`.

**Step 2: Commit**

```bash
git add src/app/(dashboard)/settings/page.tsx src/app/(auth)/login/page.tsx
git commit -m "$(cat <<'EOF'
feat: add Terms and Privacy links to settings and login pages
EOF
)"
```

---

### Worktree E: Security Fixes

**Branch:** `fix/security-hardening`
**No dependencies — can start immediately**

This worktree applies the security items from the existing `2026-02-21-pre-launch-fixes.md` plan that haven't been applied yet, plus additional fixes from the beta audit.

#### Task E1: Apply Pre-Launch Security Fixes

Follow tasks A1 through A7 from `docs/plans/2026-02-21-pre-launch-fixes.md`:
- A1: Fix OAuth CSRF in analytics callback
- A2: Fix missing userId ownership in project accounts
- A3: Migrate logo route to Supabase Storage
- A4: Add import body size limits
- A5: Clamp limit query parameters
- A6: Gate service role key log behind development
- A7: Add force-dynamic to missing routes

**Each task gets its own commit following the messages in that plan.**

---

#### Task E2: Apply Beta Readiness Security Fixes

Follow tasks 1-3 from `docs/plans/2026-02-16-beta-readiness-remediation.md`:
- Task 1: CSP — already applied (unsafe-eval removed in prod)
- Task 2: Rate limiting — already applied (fails closed in prod)
- Task 3: force-dynamic — covered by E1/A7

**Verify these are applied; if already done, skip.**

---

### Worktree F: Account Deletion API

**Branch:** `feat/account-deletion-api`
**No dependencies — can start immediately**

#### Task F1: Create Server-Side Account Deletion Endpoint

**Files:**
- Create: `src/app/api/account/delete/route.ts`
- Create: `src/app/api/account/delete/route.test.ts`

**Step 1: Write failing test**

Create `src/app/api/account/delete/route.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockRequireAuth = vi.fn()
vi.mock('@/lib/auth', () => ({ requireAuth: () => mockRequireAuth() }))

const mockRpc = vi.fn()
const mockDelete = vi.fn(() => ({
  eq: vi.fn(() => ({ error: null })),
}))
const mockFrom = vi.fn(() => ({ delete: mockDelete }))
const mockAuth = {
  admin: { deleteUser: vi.fn().mockResolvedValue({ error: null }) },
}
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() =>
    Promise.resolve({ from: mockFrom, rpc: mockRpc, auth: mockAuth })
  ),
}))

import { POST } from './route'

describe('POST /api/account/delete', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireAuth.mockResolvedValue({ userId: 'user-123' })
  })

  it('returns 401 when not authenticated', async () => {
    mockRequireAuth.mockRejectedValue(new Error('Unauthorized'))
    const res = await POST(new Request('http://localhost/api/account/delete', { method: 'POST' }))
    expect(res.status).toBe(401)
  })

  it('deletes user data and returns success', async () => {
    const res = await POST(new Request('http://localhost/api/account/delete', { method: 'POST' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/api/account/delete/route.test.ts`
Expected: FAIL — route file doesn't exist.

**Step 3: Create the endpoint**

Create `src/app/api/account/delete/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { createClient as createSupabaseJsClient } from '@supabase/supabase-js'
import { requireAuth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

/**
 * POST /api/account/delete
 * Permanently deletes the authenticated user's account and all associated data.
 * Uses service role to delete from auth.users (cascades to all tables via FK).
 */
export async function POST() {
  try {
    const { userId } = await requireAuth()

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    const adminClient = createSupabaseJsClient(supabaseUrl, serviceKey, {
      global: {
        fetch: (url: string | URL | Request, options?: RequestInit) =>
          fetch(url, { ...options, cache: 'no-store' }),
      },
    })

    // Delete user profile first (cascades to posts, campaigns, projects, etc.)
    const { error: profileError } = await adminClient
      .from('user_profiles')
      .delete()
      .eq('id', userId)

    if (profileError) {
      console.error('Failed to delete user profile:', profileError)
      return NextResponse.json({ error: 'Failed to delete account data' }, { status: 500 })
    }

    // Delete social accounts (may not cascade from user_profiles)
    await adminClient.from('social_accounts').delete().eq('user_id', userId)

    // Delete the auth user last
    const { error: authError } = await adminClient.auth.admin.deleteUser(userId)

    if (authError) {
      console.error('Failed to delete auth user:', authError)
      // Data is already deleted, so this is a partial failure
      return NextResponse.json(
        { success: true, warning: 'Account data deleted but auth cleanup incomplete' },
        { status: 200 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    if ((error as Error).message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Account deletion error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

**Step 4: Run tests**

Run: `npx vitest run src/app/api/account/delete/route.test.ts`
Expected: All PASS.

**Step 5: Update profile page to use the API endpoint**

Modify `src/app/(dashboard)/profile/page.tsx` to call `POST /api/account/delete` instead of doing client-side deletion. This is more reliable and handles cascade properly.

**Step 6: Commit**

```bash
git add src/app/api/account/delete/route.ts src/app/api/account/delete/route.test.ts src/app/(dashboard)/profile/page.tsx
git commit -m "$(cat <<'EOF'
feat: add server-side account deletion endpoint (GDPR right to erasure)
EOF
)"
```

---

## PHASE 3 — Beta Polish

### Worktree G: Monitoring

**Branch:** `fix/monitoring`
**No dependencies — can start immediately**

#### Task G1: Enable Sentry Tracing

**Files:**
- Modify: `sentry.client.config.ts`
- Modify: `sentry.server.config.ts`

**Step 1: Enable tracing at low sample rate**

In `sentry.client.config.ts`, change:
- `tracesSampleRate: 0` → `tracesSampleRate: 0.1` (10% of requests)
- `replaysOnErrorSampleRate: 0` → `replaysOnErrorSampleRate: 0.5` (50% of error sessions)

In `sentry.server.config.ts`, add:
- `tracesSampleRate: 0.1`

**Step 2: Commit**

```bash
git add sentry.client.config.ts sentry.server.config.ts
git commit -m "$(cat <<'EOF'
fix: enable Sentry tracing at 10% and error replays at 50%
EOF
)"
```

---

#### Task G2: Add Structured Error Context to API Routes

**Files:**
- Modify: `src/lib/auth.ts` (add Sentry breadcrumbs)
- Modify: `src/app/(dashboard)/error.tsx` (already has Sentry from pre-launch plan)

**Step 1: Add Sentry context to requireAuth**

In `src/lib/auth.ts`, add Sentry import and set user context after successful auth:

```typescript
import * as Sentry from '@sentry/nextjs'

// Inside requireAuth(), after getting the user:
Sentry.setUser({ id: user.id })
```

**Step 2: Commit**

```bash
git add src/lib/auth.ts
git commit -m "$(cat <<'EOF'
fix: set Sentry user context on authentication for better error tracking
EOF
)"
```

---

### Worktree H: Onboarding + UX Polish

**Branch:** `feat/onboarding`
**No dependencies — can start immediately**

#### Task H1: Create Welcome Modal for New Users

**Files:**
- Create: `src/components/ui/WelcomeModal.tsx`
- Modify: `src/app/(dashboard)/dashboard/page.tsx`

**Step 1: Create WelcomeModal**

Create `src/components/ui/WelcomeModal.tsx` — a modal that:
- Shows once for new users (check `localStorage` for `onboarding_complete`)
- Has 3 steps: "Welcome to Bullhorn", "Connect your Twitter account", "Create your first post"
- Each step has a CTA button (Skip / Connect Twitter / New Post)
- Uses sticker design system (sticker-card, bold borders)
- Sets `onboarding_complete` in localStorage on dismiss

**Step 2: Add to dashboard**

In `src/app/(dashboard)/dashboard/page.tsx`, import and render `<WelcomeModal />`.

**Step 3: Commit**

```bash
git add src/components/ui/WelcomeModal.tsx src/app/(dashboard)/dashboard/page.tsx
git commit -m "$(cat <<'EOF'
feat: add welcome modal onboarding for new users
EOF
)"
```

---

#### Task H2: Improve Empty States

**Files:**
- Modify: `src/app/(dashboard)/posts/page.tsx`
- Modify: `src/app/(dashboard)/campaigns/page.tsx`
- Modify: `src/app/(dashboard)/projects/page.tsx`

**Step 1: Add contextual empty state messages**

For each page, when the list is empty, show a message with an action button:
- Posts: "No posts yet. Create your first post to get started." + "New Post" button
- Campaigns: "No campaigns yet. Organize your posts into campaigns." + "New Campaign" button
- Projects: "No projects yet. Group campaigns under a project." + "New Project" button

Use the sticker-card styling with a centered layout and an icon.

**Step 2: Commit**

```bash
git add src/app/(dashboard)/posts/page.tsx src/app/(dashboard)/campaigns/page.tsx src/app/(dashboard)/projects/page.tsx
git commit -m "$(cat <<'EOF'
fix: add contextual empty states with action buttons
EOF
)"
```

---

#### Task H3: Add Usage Limit Notifications

**Files:**
- Modify: `src/lib/planStore.ts`
- Create: `src/components/ui/UsageBanner.tsx`
- Modify: `src/app/(dashboard)/components/AppHeader.tsx`

**Step 1: Add usage threshold check to planStore**

Add a computed property `isNearLimit` that returns true when any resource is at >= 80% of its limit.

**Step 2: Create UsageBanner component**

Show a dismissible banner in the header when `isNearLimit` is true:
"You're approaching your free plan limits. Upgrade to Pro for more."

**Step 3: Add to AppHeader**

Render `<UsageBanner />` below the header.

**Step 4: Commit**

```bash
git add src/lib/planStore.ts src/components/ui/UsageBanner.tsx src/app/(dashboard)/components/AppHeader.tsx
git commit -m "$(cat <<'EOF'
feat: show usage warning banner when approaching plan limits
EOF
)"
```

---

## Verification

After all worktrees are merged:

**Step 1: Run full CI**

Run: `make ci`
Expected: All lint, typecheck, and test checks pass.

**Step 2: Run production build**

Run: `make build`
Expected: Build succeeds.

**Step 3: Apply database migration**

Run: `doppler run -- supabase db push`
Expected: Migration applied successfully.

**Step 4: Set environment variables in Vercel**

Add to Vercel dashboard:
- `TWITTER_CLIENT_ID` — from Twitter Developer Portal
- `TWITTER_CLIENT_SECRET` — from Twitter Developer Portal
- `CRON_SECRET` — auto-generated by Vercel for cron jobs

**Step 5: Deploy and smoke test**

1. Deploy to Vercel preview
2. Connect a Twitter account via Settings
3. Create a post → Publish Now → verify tweet appears
4. Create a scheduled post → wait for cron → verify it publishes
5. Check /terms and /privacy pages render
6. Check cookie consent banner appears
7. Delete account → verify clean deletion

---

## Environment Variables Needed

| Variable | Where | Purpose |
|----------|-------|---------|
| `TWITTER_CLIENT_ID` | Vercel | Twitter OAuth 2.0 Client ID |
| `TWITTER_CLIENT_SECRET` | Vercel | Twitter OAuth 2.0 Client Secret |
| `CRON_SECRET` | Vercel | Vercel auto-injects for cron auth |

**Twitter Developer Portal Setup:**
1. Go to developer.twitter.com → create a project + app
2. Set app permissions: Read and Write
3. Set OAuth 2.0 redirect URI: `https://bullhorn.to/api/auth/twitter/callback`
4. Copy Client ID and Client Secret to Vercel env vars
