import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'

// Google OAuth configuration
const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const SCOPES = ['https://www.googleapis.com/auth/analytics.readonly']

// GET /api/analytics/auth/url - Generate OAuth URL for Google Analytics
export async function GET() {
  try {
    try {
      await requireAuth()
    } catch {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const clientId = process.env.GOOGLE_ANALYTICS_CLIENT_ID
    if (!clientId) {
      return NextResponse.json(
        { error: 'Google Analytics integration not configured' },
        { status: 500 }
      )
    }

    // Build the redirect URI based on the environment
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const redirectUri = `${baseUrl}/api/analytics/auth/callback`

    // Generate a state parameter for CSRF protection
    const state = crypto.randomUUID()

    // Store state in HTTP-only cookie (5 min expiry)
    const cookieStore = await cookies()
    cookieStore.set('oauth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 300,
      path: '/api/analytics/auth/callback',
    })

    // Build OAuth URL
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: SCOPES.join(' '),
      access_type: 'offline', // Request refresh token
      prompt: 'consent', // Force consent to ensure refresh token
      state,
    })

    const authUrl = `${GOOGLE_AUTH_URL}?${params.toString()}`

    return NextResponse.json({ url: authUrl })
  } catch (error) {
    console.error('Error generating OAuth URL:', error)
    return NextResponse.json({ error: 'Failed to generate OAuth URL' }, { status: 500 })
  }
}
