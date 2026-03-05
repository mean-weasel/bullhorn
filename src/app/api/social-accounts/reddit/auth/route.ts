import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { cookies } from 'next/headers'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    try {
      await requireAuth()
    } catch {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const clientId = process.env.REDDIT_CLIENT_ID
    if (!clientId) {
      return NextResponse.json({ error: 'Reddit integration not configured' }, { status: 500 })
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const redirectUri = `${baseUrl}/api/social-accounts/reddit/callback`

    const state = crypto.randomUUID()

    const cookieStore = await cookies()
    cookieStore.set('reddit_oauth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 300,
      path: '/api/social-accounts/reddit/callback',
    })

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: 'submit read identity flair',
      state,
      duration: 'permanent',
    })

    const authUrl = `https://www.reddit.com/api/v1/authorize?${params.toString()}`
    return NextResponse.json({ url: authUrl })
  } catch (error) {
    console.error('Error generating Reddit OAuth URL:', error)
    return NextResponse.json({ error: 'Failed to generate OAuth URL' }, { status: 500 })
  }
}
