import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'

// Google OAuth token endpoint
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'

// GET /api/analytics/auth/callback - Handle OAuth callback from Google
export async function GET(request: NextRequest) {
  try {
    // Require authentication
    let userId: string
    try {
      const auth = await requireAuth()
      userId = auth.userId
    } catch {
      // Redirect to login with error
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
      return NextResponse.redirect(`${baseUrl}/settings?error=unauthorized`)
    }

    const searchParams = request.nextUrl.searchParams
    const code = searchParams.get('code')
    const error = searchParams.get('error')
    const state = searchParams.get('state')

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

    // Validate OAuth state parameter (CSRF protection)
    const cookieStore = await cookies()
    const storedState = cookieStore.get('oauth_state')?.value

    // Clear the state cookie regardless of outcome
    cookieStore.set('oauth_state', '', { maxAge: 0, path: '/api/analytics/auth/callback' })

    if (!state || !storedState || state !== storedState) {
      console.error('OAuth state mismatch:', { received: !!state, stored: !!storedState })
      return NextResponse.redirect(`${baseUrl}/settings?error=invalid_state`)
    }

    // Check for error from Google
    if (error) {
      console.error('OAuth error from Google:', error)
      return NextResponse.redirect(
        `${baseUrl}/settings?error=oauth_denied&message=${encodeURIComponent(error)}`
      )
    }

    // Validate code
    if (!code) {
      return NextResponse.redirect(`${baseUrl}/settings?error=missing_code`)
    }

    // Exchange code for tokens
    const clientId = process.env.GOOGLE_ANALYTICS_CLIENT_ID
    const clientSecret = process.env.GOOGLE_ANALYTICS_CLIENT_SECRET
    const redirectUri = `${baseUrl}/api/analytics/auth/callback`

    if (!clientId || !clientSecret) {
      return NextResponse.redirect(`${baseUrl}/settings?error=not_configured`)
    }

    const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
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
      return NextResponse.redirect(`${baseUrl}/settings?error=token_exchange_failed`)
    }

    const tokens = await tokenResponse.json()
    const { access_token, refresh_token, expires_in, scope } = tokens

    if (!access_token || !refresh_token) {
      return NextResponse.redirect(`${baseUrl}/settings?error=missing_tokens`)
    }

    // Calculate token expiration
    const tokenExpiresAt = new Date(Date.now() + expires_in * 1000).toISOString()

    // Store tokens directly in the database instead of passing via URL
    const supabase = await createClient()
    const { data: pendingConnection, error: dbError } = await supabase
      .from('analytics_connections')
      .insert({
        user_id: userId,
        provider: 'google_analytics',
        property_id: 'pending',
        access_token,
        refresh_token,
        token_expires_at: tokenExpiresAt,
        scopes: scope ? scope.split(' ') : [],
        sync_status: 'pending_property_selection',
      })
      .select('id')
      .single()

    if (dbError || !pendingConnection) {
      console.error('Failed to store OAuth tokens:', dbError)
      return NextResponse.redirect(`${baseUrl}/settings?error=callback_failed`)
    }

    // Redirect with only a success flag and connection ID (no sensitive data in URL)
    return NextResponse.redirect(
      `${baseUrl}/settings?analytics_auth=success&connection_id=${pendingConnection.id}`
    )
  } catch (error) {
    console.error('OAuth callback error:', error)
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    return NextResponse.redirect(`${baseUrl}/settings?error=callback_failed`)
  }
}
