import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { enforceSocialAccountLimit } from '@/lib/planEnforcement'
import { cookies } from 'next/headers'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'

function generatePkce() {
  const codeVerifier = crypto.randomBytes(32).toString('base64url')
  const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url')
  return { codeVerifier, codeChallenge }
}

// GET /api/social-accounts/twitter/auth - Generate Twitter OAuth 2.0 URL with PKCE
export async function GET() {
  try {
    let userId: string
    try {
      const auth = await requireAuth()
      userId = auth.userId
    } catch {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const limitCheck = await enforceSocialAccountLimit(userId, 'twitter')
    if (!limitCheck.allowed) {
      return NextResponse.json(
        {
          error: 'Twitter account limit reached',
          limit: limitCheck.limit,
          current: limitCheck.current,
          plan: limitCheck.plan,
        },
        { status: 403 }
      )
    }

    const clientId = process.env.TWITTER_CLIENT_ID
    if (!clientId) {
      return NextResponse.json({ error: 'Twitter integration not configured' }, { status: 500 })
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const redirectUri = `${baseUrl}/api/social-accounts/twitter/callback`
    const { codeVerifier, codeChallenge } = generatePkce()
    const state = crypto.randomUUID()

    const cookieStore = await cookies()
    cookieStore.set('twitter_oauth_state', JSON.stringify({ state, codeVerifier }), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 300,
      path: '/api/social-accounts/twitter/callback',
    })

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: 'tweet.read tweet.write users.read media.write offline.access',
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    })

    return NextResponse.json({ url: `https://x.com/i/oauth2/authorize?${params.toString()}` })
  } catch (error) {
    console.error('Error generating Twitter OAuth URL:', error)
    return NextResponse.json({ error: 'Failed to generate OAuth URL' }, { status: 500 })
  }
}
