import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { enforceSocialAccountLimit } from '@/lib/planEnforcement'
import { cookies } from 'next/headers'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'

// GET /api/social-accounts/linkedin/auth - Generate LinkedIn OAuth 2.0 URL
export async function GET() {
  try {
    let userId: string
    try {
      const auth = await requireAuth()
      userId = auth.userId
    } catch {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const limitCheck = await enforceSocialAccountLimit(userId, 'linkedin')
    if (!limitCheck.allowed) {
      return NextResponse.json(
        {
          error: 'LinkedIn account limit reached',
          limit: limitCheck.limit,
          current: limitCheck.current,
          plan: limitCheck.plan,
        },
        { status: 403 }
      )
    }

    const clientId = process.env.LINKEDIN_CLIENT_ID
    if (!clientId) {
      return NextResponse.json({ error: 'LinkedIn integration not configured' }, { status: 500 })
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const redirectUri = `${baseUrl}/api/social-accounts/linkedin/callback`

    // Generate state for CSRF protection
    const state = crypto.randomUUID()

    // Store state in HTTP-only cookie (5 min expiry)
    const cookieStore = await cookies()
    cookieStore.set('linkedin_oauth_state', JSON.stringify({ state }), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 300,
      path: '/api/social-accounts/linkedin/callback',
    })

    // Build authorization URL
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: 'openid profile email w_member_social',
      state,
    })

    const authUrl = `https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`

    return NextResponse.json({ url: authUrl })
  } catch (error) {
    console.error('Error generating LinkedIn OAuth URL:', error)
    return NextResponse.json({ error: 'Failed to generate OAuth URL' }, { status: 500 })
  }
}
