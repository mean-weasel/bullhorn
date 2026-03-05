import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { cookies } from 'next/headers'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'

// GET /api/social-accounts/twitter/auth - Generate Twitter OAuth 2.0 URL with PKCE
export async function GET() {
  try {
    try {
      await requireAuth()
    } catch {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const clientId = process.env.TWITTER_CLIENT_ID
    if (!clientId) {
      return NextResponse.json({ error: 'Twitter integration not configured' }, { status: 500 })
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const redirectUri = `${baseUrl}/api/social-accounts/twitter/callback`

    // Generate PKCE code_verifier and code_challenge
    const codeVerifier = crypto.randomBytes(32).toString('base64url')
    const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url')

    // Generate state for CSRF protection
    const state = crypto.randomUUID()

    // Store state + code_verifier in HTTP-only cookie (5 min expiry)
    const cookieStore = await cookies()
    cookieStore.set('twitter_oauth_state', JSON.stringify({ state, codeVerifier }), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 300,
      path: '/api/social-accounts/twitter/callback',
    })

    // Build authorization URL (use x.com, NOT twitter.com)
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: 'tweet.read tweet.write users.read media.write offline.access',
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    })

    const authUrl = `https://x.com/i/oauth2/authorize?${params.toString()}`

    return NextResponse.json({ url: authUrl })
  } catch (error) {
    console.error('Error generating Twitter OAuth URL:', error)
    return NextResponse.json({ error: 'Failed to generate OAuth URL' }, { status: 500 })
  }
}
