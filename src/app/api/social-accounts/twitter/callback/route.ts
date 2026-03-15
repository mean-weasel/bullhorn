import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'

function parseOAuthCookie(cookieValue: string | undefined) {
  if (!cookieValue) return null
  try {
    const parsed = JSON.parse(cookieValue)
    return { state: parsed.state as string, codeVerifier: parsed.codeVerifier as string }
  } catch {
    return null
  }
}

async function exchangeTwitterToken(
  code: string,
  codeVerifier: string,
  redirectUri: string,
  clientId: string,
  clientSecret: string
) {
  const tokenResponse = await fetch('https://api.x.com/2/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier,
    }),
  })

  if (!tokenResponse.ok) {
    const errorData = await tokenResponse.json().catch(() => ({}))
    console.error('Twitter token exchange failed:', errorData)
    return null
  }
  return tokenResponse.json()
}

async function fetchTwitterProfile(accessToken: string) {
  const userResponse = await fetch('https://api.x.com/2/users/me?user.fields=profile_image_url', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!userResponse.ok) return null
  const userData = await userResponse.json()
  return userData.data
}

function buildTwitterUpsertData(
  userId: string,
  twitterUser: { id: string; username: string; name: string; profile_image_url?: string },
  accessToken: string,
  refreshToken: string | null,
  expiresIn: number
) {
  return {
    user_id: userId,
    provider: 'twitter' as const,
    provider_account_id: twitterUser.id,
    username: twitterUser.username,
    display_name: twitterUser.name,
    avatar_url: twitterUser.profile_image_url || null,
    access_token: accessToken,
    refresh_token: refreshToken,
    token_expires_at: new Date(Date.now() + (expiresIn || 7200) * 1000).toISOString(),
    scopes: ['tweet.read', 'tweet.write', 'users.read', 'media.write', 'offline.access'],
    status: 'active' as const,
    status_error: null,
    connected_at: new Date().toISOString(),
  }
}

async function validateTwitterOAuthState(
  request: NextRequest,
  baseUrl: string
): Promise<{ redirect: string } | { code: string; codeVerifier: string }> {
  const { code, error, state } = {
    code: request.nextUrl.searchParams.get('code'),
    error: request.nextUrl.searchParams.get('error'),
    state: request.nextUrl.searchParams.get('state'),
  }
  const cookieStore = await cookies()
  const oauthCookie = cookieStore.get('twitter_oauth_state')?.value
  cookieStore.set('twitter_oauth_state', '', {
    maxAge: 0,
    path: '/api/social-accounts/twitter/callback',
  })

  const parsed = parseOAuthCookie(oauthCookie)
  if (!parsed || !state || state !== parsed.state)
    return { redirect: `${baseUrl}/settings?error=invalid_state` }
  if (error)
    return {
      redirect: `${baseUrl}/settings?error=oauth_denied&message=${encodeURIComponent(error)}`,
    }
  if (!code) return { redirect: `${baseUrl}/settings?error=missing_code` }
  return { code, codeVerifier: parsed.codeVerifier }
}

async function processTwitterCallback(
  code: string,
  codeVerifier: string,
  userId: string,
  baseUrl: string
) {
  const clientId = process.env.TWITTER_CLIENT_ID
  const clientSecret = process.env.TWITTER_CLIENT_SECRET
  if (!clientId || !clientSecret) return `${baseUrl}/settings?error=not_configured`

  const redirectUri = `${baseUrl}/api/social-accounts/twitter/callback`
  const tokens = await exchangeTwitterToken(code, codeVerifier, redirectUri, clientId, clientSecret)
  if (!tokens?.access_token) return `${baseUrl}/settings?error=token_exchange_failed`

  const twitterUser = await fetchTwitterProfile(tokens.access_token)
  if (!twitterUser) return `${baseUrl}/settings?error=profile_fetch_failed`

  const supabase = await createClient()
  const upsertData = buildTwitterUpsertData(
    userId,
    twitterUser,
    tokens.access_token,
    tokens.refresh_token || null,
    tokens.expires_in
  )
  const { error } = await supabase
    .from('social_accounts')
    .upsert(upsertData, { onConflict: 'user_id,provider,provider_account_id' })
  if (error) return `${baseUrl}/settings?error=storage_failed`
  return `${baseUrl}/settings?connected=twitter`
}

// GET /api/social-accounts/twitter/callback - Handle Twitter OAuth 2.0 redirect
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

    const validated = await validateTwitterOAuthState(request, baseUrl)
    if ('redirect' in validated) return NextResponse.redirect(validated.redirect)

    const redirectUrl = await processTwitterCallback(
      validated.code,
      validated.codeVerifier,
      userId,
      baseUrl
    )
    return NextResponse.redirect(redirectUrl)
  } catch (error) {
    console.error('Twitter OAuth callback error:', error)
    return NextResponse.redirect(`${baseUrl}/settings?error=callback_failed`)
  }
}
