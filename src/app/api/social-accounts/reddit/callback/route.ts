import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'

const REDDIT_USER_AGENT =
  process.env.REDDIT_USER_AGENT || 'web:bullhorn-scheduler:v1.0.0 (by /u/unknown)'

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
    const error = searchParams.get('error')
    const state = searchParams.get('state')

    const cookieStore = await cookies()
    const storedState = cookieStore.get('reddit_oauth_state')?.value
    cookieStore.set('reddit_oauth_state', '', {
      maxAge: 0,
      path: '/api/social-accounts/reddit/callback',
    })

    if (!storedState || !state || state !== storedState) {
      return NextResponse.redirect(`${baseUrl}/settings?error=invalid_state`)
    }

    if (error) {
      console.error('Reddit OAuth error:', error)
      return NextResponse.redirect(
        `${baseUrl}/settings?error=oauth_denied&message=${encodeURIComponent(error)}`
      )
    }

    if (!code) {
      return NextResponse.redirect(`${baseUrl}/settings?error=missing_code`)
    }

    const tokens = await exchangeCodeForTokens(code, baseUrl)
    if (!tokens) {
      return NextResponse.redirect(`${baseUrl}/settings?error=token_exchange_failed`)
    }

    const redditUser = await fetchRedditProfile(tokens.access_token)
    if (!redditUser) {
      return NextResponse.redirect(`${baseUrl}/settings?error=profile_fetch_failed`)
    }

    const dbError = await storeConnection(userId, tokens, redditUser)
    if (dbError) {
      return NextResponse.redirect(`${baseUrl}/settings?error=storage_failed`)
    }

    return NextResponse.redirect(`${baseUrl}/settings?connected=reddit`)
  } catch (err) {
    console.error('Reddit OAuth callback error:', err)
    return NextResponse.redirect(`${baseUrl}/settings?error=callback_failed`)
  }
}

async function exchangeCodeForTokens(code: string, baseUrl: string) {
  const clientId = process.env.REDDIT_CLIENT_ID
  const clientSecret = process.env.REDDIT_CLIENT_SECRET
  const redirectUri = `${baseUrl}/api/social-accounts/reddit/callback`

  if (!clientId || !clientSecret) return null

  const tokenResponse = await fetch('https://www.reddit.com/api/v1/access_token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      'User-Agent': REDDIT_USER_AGENT,
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    }),
  })

  if (!tokenResponse.ok) {
    const errorData = await tokenResponse.json().catch(() => ({}))
    console.error('Reddit token exchange failed:', errorData)
    return null
  }

  const tokens = await tokenResponse.json()
  if (!tokens.access_token) return null

  return tokens
}

async function fetchRedditProfile(accessToken: string) {
  const userResponse = await fetch('https://oauth.reddit.com/api/v1/me', {
    headers: {
      Authorization: `bearer ${accessToken}`,
      'User-Agent': REDDIT_USER_AGENT,
    },
  })

  if (!userResponse.ok) {
    console.error('Failed to fetch Reddit user profile')
    return null
  }

  return userResponse.json()
}

async function storeConnection(
  userId: string,
  tokens: { access_token: string; refresh_token?: string; expires_in?: number },
  redditUser: { id: string; name: string; icon_img?: string }
) {
  const tokenExpiresAt = new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString()

  const avatarUrl = redditUser.icon_img ? redditUser.icon_img.split('?')[0] : null

  const supabase = await createClient()
  const { error } = await supabase.from('social_accounts').upsert(
    {
      user_id: userId,
      provider: 'reddit',
      provider_account_id: redditUser.id,
      username: redditUser.name,
      display_name: redditUser.name,
      avatar_url: avatarUrl,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token || null,
      token_expires_at: tokenExpiresAt,
      scopes: ['submit', 'read', 'identity', 'flair'],
      status: 'active',
      status_error: null,
      connected_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,provider,provider_account_id' }
  )

  if (error) {
    console.error('Failed to store Reddit connection:', error)
    return error
  }

  return null
}
