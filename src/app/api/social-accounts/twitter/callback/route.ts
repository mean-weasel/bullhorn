import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'

// GET /api/social-accounts/twitter/callback - Handle Twitter OAuth 2.0 redirect
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

    // 2. Validate state + get code_verifier from cookie
    const cookieStore = await cookies()
    const oauthCookie = cookieStore.get('twitter_oauth_state')?.value

    // Clear cookie regardless
    cookieStore.set('twitter_oauth_state', '', {
      maxAge: 0,
      path: '/api/social-accounts/twitter/callback',
    })

    if (!oauthCookie) {
      return NextResponse.redirect(`${baseUrl}/settings?error=invalid_state`)
    }

    let storedState: string
    let codeVerifier: string
    try {
      const parsed = JSON.parse(oauthCookie)
      storedState = parsed.state
      codeVerifier = parsed.codeVerifier
    } catch {
      return NextResponse.redirect(`${baseUrl}/settings?error=invalid_state`)
    }

    if (!state || state !== storedState) {
      return NextResponse.redirect(`${baseUrl}/settings?error=invalid_state`)
    }

    // 3. Check for error from Twitter
    if (error) {
      console.error('Twitter OAuth error:', error)
      return NextResponse.redirect(
        `${baseUrl}/settings?error=oauth_denied&message=${encodeURIComponent(error)}`
      )
    }

    if (!code) {
      return NextResponse.redirect(`${baseUrl}/settings?error=missing_code`)
    }

    // 4. Exchange code for tokens
    const clientId = process.env.TWITTER_CLIENT_ID
    const clientSecret = process.env.TWITTER_CLIENT_SECRET
    const redirectUri = `${baseUrl}/api/social-accounts/twitter/callback`

    if (!clientId || !clientSecret) {
      return NextResponse.redirect(`${baseUrl}/settings?error=not_configured`)
    }

    // Token exchange — use Basic auth for confidential clients
    // Content-Type MUST be application/x-www-form-urlencoded
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
      return NextResponse.redirect(`${baseUrl}/settings?error=token_exchange_failed`)
    }

    const tokens = await tokenResponse.json()
    const { access_token, refresh_token, expires_in } = tokens

    if (!access_token) {
      return NextResponse.redirect(`${baseUrl}/settings?error=missing_tokens`)
    }

    // 5. Fetch user profile from Twitter
    const userResponse = await fetch('https://api.x.com/2/users/me?user.fields=profile_image_url', {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    })

    if (!userResponse.ok) {
      console.error('Failed to fetch Twitter user profile')
      return NextResponse.redirect(`${baseUrl}/settings?error=profile_fetch_failed`)
    }

    const userData = await userResponse.json()
    const twitterUser = userData.data
    // twitterUser: { id, name, username, profile_image_url }

    // 6. Calculate token expiry
    const tokenExpiresAt = new Date(Date.now() + (expires_in || 7200) * 1000).toISOString()

    // 7. Upsert into social_accounts
    const supabase = await createClient()
    const { error: dbError } = await supabase.from('social_accounts').upsert(
      {
        user_id: userId,
        provider: 'twitter',
        provider_account_id: twitterUser.id,
        username: twitterUser.username,
        display_name: twitterUser.name,
        avatar_url: twitterUser.profile_image_url || null,
        access_token,
        refresh_token: refresh_token || null,
        token_expires_at: tokenExpiresAt,
        scopes: ['tweet.read', 'tweet.write', 'users.read', 'media.write', 'offline.access'],
        status: 'active',
        status_error: null,
        connected_at: new Date().toISOString(),
      },
      {
        onConflict: 'user_id,provider,provider_account_id',
      }
    )

    if (dbError) {
      console.error('Failed to store Twitter connection:', dbError)
      return NextResponse.redirect(`${baseUrl}/settings?error=storage_failed`)
    }

    // 8. Redirect to settings with success
    return NextResponse.redirect(`${baseUrl}/settings?connected=twitter`)
  } catch (error) {
    console.error('Twitter OAuth callback error:', error)
    return NextResponse.redirect(`${baseUrl}/settings?error=callback_failed`)
  }
}
