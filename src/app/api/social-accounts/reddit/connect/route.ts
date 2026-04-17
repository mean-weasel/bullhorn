import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { isSelfHosted } from '@/lib/selfHosted'
import {
  refreshRedditViaPasswordGrant,
  REDDIT_USER_AGENT,
  type PlatformTokenResponse,
} from '@/lib/tokenRefresh'

export const dynamic = 'force-dynamic'

export async function POST() {
  try {
    if (!isSelfHosted()) {
      return NextResponse.json(
        { error: 'Script auth is only available in self-hosted mode' },
        { status: 403 }
      )
    }

    let userId: string
    try {
      const auth = await requireAuth()
      userId = auth.userId
    } catch {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const clientId = process.env.REDDIT_CLIENT_ID
    const clientSecret = process.env.REDDIT_CLIENT_SECRET
    const username = process.env.REDDIT_USERNAME
    const password = process.env.REDDIT_PASSWORD

    if (!clientId || !clientSecret || !username || !password) {
      return NextResponse.json(
        {
          error:
            'Reddit credentials not configured (REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET, REDDIT_USERNAME, REDDIT_PASSWORD)',
        },
        { status: 500 }
      )
    }

    // Password grant to get access token
    let tokens: PlatformTokenResponse
    try {
      tokens = await refreshRedditViaPasswordGrant()
      if (!tokens.access_token) {
        return NextResponse.json({ error: 'No access token in Reddit response' }, { status: 502 })
      }
    } catch (err) {
      console.error('Reddit password grant failed:', err)
      return NextResponse.json({ error: 'Reddit authentication failed' }, { status: 502 })
    }

    // Fetch Reddit user profile
    const userRes = await fetch('https://oauth.reddit.com/api/v1/me', {
      headers: {
        Authorization: `bearer ${tokens.access_token}`,
        'User-Agent': REDDIT_USER_AGENT,
      },
    })

    if (!userRes.ok) {
      return NextResponse.json({ error: 'Failed to fetch Reddit profile' }, { status: 502 })
    }

    const redditUser = await userRes.json()
    const avatarUrl = redditUser.icon_img ? redditUser.icon_img.split('?')[0] : null
    const tokenExpiresAt = new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString()

    // Store connection
    const supabase = await createClient()
    const { error: dbError } = await supabase.from('social_accounts').upsert(
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
        // Script apps have all scopes implicitly; stored for parity with OAuth flow
        scopes: ['submit', 'read', 'identity', 'flair'],
        status: 'active',
        status_error: null,
        connected_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,provider,provider_account_id' }
    )

    if (dbError) {
      console.error('Failed to store Reddit connection:', dbError)
      return NextResponse.json({ error: 'Failed to store connection' }, { status: 500 })
    }

    return NextResponse.json({ connected: true, username: redditUser.name })
  } catch (error) {
    console.error('Reddit script auth error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
