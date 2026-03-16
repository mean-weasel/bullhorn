import { createClient } from '@/lib/supabase/server'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SocialProvider = 'twitter' | 'linkedin' | 'reddit'
export type SocialAccountStatus = 'active' | 'expired' | 'revoked' | 'error'

export interface SocialAccountWithTokens {
  id: string
  provider: SocialProvider
  access_token: string
  refresh_token: string | null
  token_expires_at: string | null
}

export interface TokenRefreshResult {
  accessToken: string
  refreshToken: string | null
  expiresAt: Date
}

interface PlatformTokenResponse {
  access_token: string
  refresh_token?: string | null
  expires_in: number
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TOKEN_EXPIRY_BUFFER_SECONDS = 300 // 5 minutes
const REDDIT_USER_AGENT =
  process.env.REDDIT_USER_AGENT || 'web:bullhorn-scheduler:v1.0.0 (by /u/unknown)'

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

export function isTokenExpiringSoon(expiresAt: string | null): boolean {
  if (!expiresAt) return true
  const expiryTime = new Date(expiresAt).getTime()
  const bufferMs = TOKEN_EXPIRY_BUFFER_SECONDS * 1000
  return Date.now() >= expiryTime - bufferMs
}

// ---------------------------------------------------------------------------
// Platform-specific refresh functions
// ---------------------------------------------------------------------------

async function refreshTwitterToken(refreshToken: string): Promise<PlatformTokenResponse> {
  const clientId = process.env.TWITTER_CLIENT_ID
  const clientSecret = process.env.TWITTER_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    throw new Error('Twitter OAuth credentials not configured')
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
  const res = await fetch('https://api.x.com/2/oauth2/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  })

  return handleRefreshResponse(res, 'twitter')
}

async function refreshLinkedInToken(refreshToken: string): Promise<PlatformTokenResponse> {
  const clientId = process.env.LINKEDIN_CLIENT_ID
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    throw new Error('LinkedIn OAuth credentials not configured')
  }

  const res = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  })

  return handleRefreshResponse(res, 'linkedin')
}

async function refreshRedditToken(refreshToken: string): Promise<PlatformTokenResponse> {
  const clientId = process.env.REDDIT_CLIENT_ID
  const clientSecret = process.env.REDDIT_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    throw new Error('Reddit OAuth credentials not configured')
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
  const res = await fetch('https://www.reddit.com/api/v1/access_token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': REDDIT_USER_AGENT,
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  })

  return handleRefreshResponse(res, 'reddit')
}

// ---------------------------------------------------------------------------
// Shared response handler
// ---------------------------------------------------------------------------

async function handleRefreshResponse(
  res: Response,
  provider: SocialProvider
): Promise<PlatformTokenResponse> {
  const body = await res.json()

  if (!res.ok || body.error === 'invalid_grant') {
    const isExpired = res.status === 401 || body.error === 'invalid_grant'
    const errorMsg = body.error_description || body.error || `${provider} token refresh failed`
    throw new TokenRefreshError(errorMsg, provider, isExpired)
  }

  return {
    access_token: body.access_token,
    refresh_token: body.refresh_token ?? null,
    expires_in: body.expires_in,
  }
}

// ---------------------------------------------------------------------------
// Custom error class
// ---------------------------------------------------------------------------

export class TokenRefreshError extends Error {
  constructor(
    message: string,
    public provider: SocialProvider,
    public isExpired: boolean
  ) {
    super(message)
    this.name = 'TokenRefreshError'
  }
}

// ---------------------------------------------------------------------------
// Main exported functions
// ---------------------------------------------------------------------------

export async function refreshTokenIfNeeded(
  account: SocialAccountWithTokens
): Promise<TokenRefreshResult> {
  if (!isTokenExpiringSoon(account.token_expires_at)) {
    return {
      accessToken: account.access_token,
      refreshToken: account.refresh_token,
      expiresAt: new Date(account.token_expires_at!),
    }
  }

  if (!account.refresh_token) {
    throw new Error(`No refresh token for ${account.provider} account ${account.id}`)
  }

  const supabase = await createClient()

  try {
    const tokens = await refreshByProvider(account.provider, account.refresh_token)
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000)

    await supabase
      .from('social_accounts')
      .update({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token || account.refresh_token,
        token_expires_at: expiresAt.toISOString(),
        status: 'active' as SocialAccountStatus,
        status_error: null,
      })
      .eq('id', account.id)

    return {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token || account.refresh_token,
      expiresAt,
    }
  } catch (err) {
    await markAccountError(supabase, account.id, err)
    throw err
  }
}

export async function getValidAccessToken(
  accountId: string,
  injectedClient?: Awaited<ReturnType<typeof createClient>>
): Promise<string> {
  const supabase = injectedClient ?? (await createClient())

  const { data, error } = await supabase
    .from('social_accounts')
    .select('id, provider, access_token, refresh_token, token_expires_at')
    .eq('id', accountId)
    .single()

  if (error || !data) {
    throw new Error(`Social account not found: ${accountId}`)
  }

  const result = await refreshTokenIfNeeded(data as SocialAccountWithTokens)
  return result.accessToken
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function refreshByProvider(
  provider: SocialProvider,
  refreshToken: string
): Promise<PlatformTokenResponse> {
  switch (provider) {
    case 'twitter':
      return refreshTwitterToken(refreshToken)
    case 'linkedin':
      return refreshLinkedInToken(refreshToken)
    case 'reddit':
      return refreshRedditToken(refreshToken)
  }
}

async function markAccountError(
  supabase: Awaited<ReturnType<typeof createClient>>,
  accountId: string,
  err: unknown
): Promise<void> {
  const isExpired = err instanceof TokenRefreshError && err.isExpired
  const message = err instanceof Error ? err.message : 'Unknown error'
  await supabase
    .from('social_accounts')
    .update({
      status: (isExpired ? 'expired' : 'error') as SocialAccountStatus,
      status_error: isExpired ? 'Token expired, please reconnect' : message,
    })
    .eq('id', accountId)
}
