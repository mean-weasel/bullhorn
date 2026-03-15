import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'

// Google OAuth token endpoint
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'

// GET /api/analytics/auth/callback - Handle OAuth callback from Google
async function exchangeGoogleToken(code: string, redirectUri: string) {
  const clientId = process.env.GOOGLE_ANALYTICS_CLIENT_ID
  const clientSecret = process.env.GOOGLE_ANALYTICS_CLIENT_SECRET
  if (!clientId || !clientSecret) return { error: 'not_configured' as const }

  const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  })

  if (!tokenResponse.ok) {
    const errorData = await tokenResponse.json()
    console.error('Token exchange failed:', errorData)
    return { error: 'token_exchange_failed' as const }
  }

  const tokens = await tokenResponse.json()
  if (!tokens.access_token || !tokens.refresh_token) {
    return { error: 'missing_tokens' as const }
  }
  return { tokens }
}

export async function GET(request: NextRequest) {
  try {
    let userId: string
    try {
      const auth = await requireAuth()
      userId = auth.userId
    } catch {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
      return NextResponse.redirect(`${baseUrl}/settings?error=unauthorized`)
    }

    const searchParams = request.nextUrl.searchParams
    const code = searchParams.get('code')
    const error = searchParams.get('error')
    const state = searchParams.get('state')
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

    const cookieStore = await cookies()
    const storedState = cookieStore.get('oauth_state')?.value
    cookieStore.set('oauth_state', '', { maxAge: 0, path: '/api/analytics/auth/callback' })

    if (!state || !storedState || state !== storedState) {
      return NextResponse.redirect(`${baseUrl}/settings?error=invalid_state`)
    }
    if (error) {
      return NextResponse.redirect(
        `${baseUrl}/settings?error=oauth_denied&message=${encodeURIComponent(error)}`
      )
    }
    if (!code) return NextResponse.redirect(`${baseUrl}/settings?error=missing_code`)

    const redirectUri = `${baseUrl}/api/analytics/auth/callback`
    const result = await exchangeGoogleToken(code, redirectUri)
    if ('error' in result) {
      return NextResponse.redirect(`${baseUrl}/settings?error=${result.error}`)
    }

    const { access_token, refresh_token, expires_in, scope } = result.tokens
    const supabase = await createClient()
    const { data: pendingConnection, error: dbError } = await supabase
      .from('analytics_connections')
      .insert({
        user_id: userId,
        provider: 'google_analytics',
        property_id: 'pending',
        access_token,
        refresh_token,
        token_expires_at: new Date(Date.now() + expires_in * 1000).toISOString(),
        scopes: scope ? scope.split(' ') : [],
        sync_status: 'pending_property_selection',
      })
      .select('id')
      .single()

    if (dbError || !pendingConnection) {
      console.error('Failed to store OAuth tokens:', dbError)
      return NextResponse.redirect(`${baseUrl}/settings?error=callback_failed`)
    }

    return NextResponse.redirect(
      `${baseUrl}/settings?analytics_auth=success&connection_id=${pendingConnection.id}`
    )
  } catch (error) {
    console.error('OAuth callback error:', error)
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    return NextResponse.redirect(`${baseUrl}/settings?error=callback_failed`)
  }
}
