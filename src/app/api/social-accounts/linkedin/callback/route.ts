import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'

function parseLinkedInOAuthCookie(cookieValue: string | undefined) {
  if (!cookieValue) return null
  try {
    const parsed = JSON.parse(cookieValue)
    return { state: parsed.state as string }
  } catch {
    return null
  }
}

async function exchangeLinkedInToken(
  code: string,
  redirectUri: string,
  clientId: string,
  clientSecret: string
) {
  const tokenResponse = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  })

  if (!tokenResponse.ok) {
    const errorData = await tokenResponse.json().catch(() => ({}))
    console.error('LinkedIn token exchange failed:', errorData)
    return null
  }
  return tokenResponse.json()
}

function buildLinkedInUpsertData(
  userId: string,
  userData: { sub: string; email: string; name: string; picture?: string },
  accessToken: string,
  refreshToken: string | null,
  expiresIn: number
) {
  return {
    user_id: userId,
    provider: 'linkedin' as const,
    provider_account_id: userData.sub,
    username: userData.email,
    display_name: userData.name,
    avatar_url: userData.picture || null,
    access_token: accessToken,
    refresh_token: refreshToken,
    token_expires_at: new Date(Date.now() + (expiresIn || 5184000) * 1000).toISOString(),
    scopes: ['openid', 'profile', 'email', 'w_member_social'],
    status: 'active' as const,
    status_error: null,
    connected_at: new Date().toISOString(),
  }
}

async function validateLinkedInOAuthState(
  request: NextRequest,
  baseUrl: string
): Promise<{ redirect: string } | { code: string }> {
  const { code, error, state } = {
    code: request.nextUrl.searchParams.get('code'),
    error: request.nextUrl.searchParams.get('error'),
    state: request.nextUrl.searchParams.get('state'),
  }
  const cookieStore = await cookies()
  const oauthCookie = cookieStore.get('linkedin_oauth_state')?.value
  cookieStore.set('linkedin_oauth_state', '', {
    maxAge: 0,
    path: '/api/social-accounts/linkedin/callback',
  })

  const parsed = parseLinkedInOAuthCookie(oauthCookie)
  if (!parsed || !state || state !== parsed.state)
    return { redirect: `${baseUrl}/settings?error=invalid_state` }
  if (error)
    return {
      redirect: `${baseUrl}/settings?error=oauth_denied&message=${encodeURIComponent(error)}`,
    }
  if (!code) return { redirect: `${baseUrl}/settings?error=missing_code` }
  return { code }
}

async function processLinkedInCallback(code: string, userId: string, baseUrl: string) {
  const clientId = process.env.LINKEDIN_CLIENT_ID
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET
  if (!clientId || !clientSecret) return `${baseUrl}/settings?error=not_configured`

  const redirectUri = `${baseUrl}/api/social-accounts/linkedin/callback`
  const tokens = await exchangeLinkedInToken(code, redirectUri, clientId, clientSecret)
  if (!tokens?.access_token) return `${baseUrl}/settings?error=token_exchange_failed`

  const userResponse = await fetch('https://api.linkedin.com/v2/userinfo', {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  })
  if (!userResponse.ok) return `${baseUrl}/settings?error=profile_fetch_failed`

  const userData = await userResponse.json()
  const supabase = await createClient()
  const upsertData = buildLinkedInUpsertData(
    userId,
    userData,
    tokens.access_token,
    tokens.refresh_token || null,
    tokens.expires_in
  )
  const { error } = await supabase
    .from('social_accounts')
    .upsert(upsertData, { onConflict: 'user_id,provider,provider_account_id' })
  if (error) return `${baseUrl}/settings?error=storage_failed`
  return `${baseUrl}/settings?connected=linkedin`
}

// GET /api/social-accounts/linkedin/callback - Handle LinkedIn OAuth 2.0 redirect
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

    const validated = await validateLinkedInOAuthState(request, baseUrl)
    if ('redirect' in validated) return NextResponse.redirect(validated.redirect)

    const redirectUrl = await processLinkedInCallback(validated.code, userId, baseUrl)
    return NextResponse.redirect(redirectUrl)
  } catch (error) {
    console.error('LinkedIn OAuth callback error:', error)
    return NextResponse.redirect(`${baseUrl}/settings?error=callback_failed`)
  }
}
