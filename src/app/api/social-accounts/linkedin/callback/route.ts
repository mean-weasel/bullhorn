import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'

// GET /api/social-accounts/linkedin/callback - Handle LinkedIn OAuth 2.0 redirect
export async function GET(request: NextRequest) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  try {
    // 1. Require authentication
    let userId: string
    try {
      const auth = await requireAuth()
      userId = auth.userId
    } catch {
      return NextResponse.redirect(`${baseUrl}/settings?error=unauthorized`)
    }

    const searchParams = request.nextUrl.searchParams
    const code = searchParams.get('code')
    const error = searchParams.get('error')
    const state = searchParams.get('state')

    // 2. Validate state from cookie
    const cookieStore = await cookies()
    const oauthCookie = cookieStore.get('linkedin_oauth_state')?.value

    // Clear cookie regardless
    cookieStore.set('linkedin_oauth_state', '', {
      maxAge: 0,
      path: '/api/social-accounts/linkedin/callback',
    })

    if (!oauthCookie) {
      return NextResponse.redirect(`${baseUrl}/settings?error=invalid_state`)
    }

    let storedState: string
    try {
      const parsed = JSON.parse(oauthCookie)
      storedState = parsed.state
    } catch {
      return NextResponse.redirect(`${baseUrl}/settings?error=invalid_state`)
    }

    if (!state || state !== storedState) {
      return NextResponse.redirect(`${baseUrl}/settings?error=invalid_state`)
    }

    // 3. Check for error from LinkedIn
    if (error) {
      console.error('LinkedIn OAuth error:', error)
      return NextResponse.redirect(
        `${baseUrl}/settings?error=oauth_denied&message=${encodeURIComponent(error)}`
      )
    }

    if (!code) {
      return NextResponse.redirect(`${baseUrl}/settings?error=missing_code`)
    }

    // 4. Exchange code for tokens
    const clientId = process.env.LINKEDIN_CLIENT_ID
    const clientSecret = process.env.LINKEDIN_CLIENT_SECRET
    const redirectUri = `${baseUrl}/api/social-accounts/linkedin/callback`

    if (!clientId || !clientSecret) {
      return NextResponse.redirect(`${baseUrl}/settings?error=not_configured`)
    }

    const tokenResponse = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
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
      return NextResponse.redirect(`${baseUrl}/settings?error=token_exchange_failed`)
    }

    const tokens = await tokenResponse.json()
    const { access_token, refresh_token, expires_in } = tokens

    if (!access_token) {
      return NextResponse.redirect(`${baseUrl}/settings?error=missing_tokens`)
    }

    // 5. Fetch user profile from LinkedIn
    const userResponse = await fetch('https://api.linkedin.com/v2/userinfo', {
      headers: { Authorization: `Bearer ${access_token}` },
    })

    if (!userResponse.ok) {
      console.error('Failed to fetch LinkedIn user profile')
      return NextResponse.redirect(`${baseUrl}/settings?error=profile_fetch_failed`)
    }

    const userData = await userResponse.json()

    // 6. Calculate token expiry (default 60 days = 5,184,000 seconds)
    const tokenExpiresAt = new Date(Date.now() + (expires_in || 5184000) * 1000).toISOString()

    // 7. Upsert into social_accounts
    const supabase = await createClient()
    const { error: dbError } = await supabase.from('social_accounts').upsert(
      {
        user_id: userId,
        provider: 'linkedin',
        provider_account_id: userData.sub,
        username: userData.email,
        display_name: userData.name,
        avatar_url: userData.picture || null,
        access_token,
        refresh_token: refresh_token || null,
        token_expires_at: tokenExpiresAt,
        scopes: ['openid', 'profile', 'email', 'w_member_social'],
        status: 'active',
        status_error: null,
        connected_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,provider,provider_account_id' }
    )

    if (dbError) {
      console.error('Failed to store LinkedIn connection:', dbError)
      return NextResponse.redirect(`${baseUrl}/settings?error=storage_failed`)
    }

    // 8. Redirect to settings with success
    return NextResponse.redirect(`${baseUrl}/settings?connected=linkedin`)
  } catch (error) {
    console.error('LinkedIn OAuth callback error:', error)
    return NextResponse.redirect(`${baseUrl}/settings?error=callback_failed`)
  }
}
