import { requireSessionAuth } from '@/lib/auth'
import { sendApnsToUser } from '@/lib/apnsSender'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/dev/test-push — Diagnostic: check push readiness for current user.
 * POST /api/dev/test-push — Send a test push notification to current user's devices.
 *
 * Dev-only: blocked in production.
 */

function isDevAllowed(): boolean {
  return process.env.NODE_ENV !== 'production'
}

export async function GET() {
  if (!isDevAllowed()) {
    return Response.json({ error: 'Dev-only endpoint' }, { status: 403 })
  }

  try {
    const { userId } = await requireSessionAuth()
    const supabase = await createClient()

    const { data: tokens, error } = await supabase
      .from('push_device_tokens')
      .select('id, token, platform, created_at, updated_at')
      .eq('user_id', userId)

    if (error) throw error

    const apnsConfigured = !!(
      process.env.APNS_KEY_ID &&
      process.env.APNS_TEAM_ID &&
      process.env.APNS_AUTH_KEY
    )

    return Response.json({
      status: 'ok',
      apns: {
        configured: apnsConfigured,
        keyId: process.env.APNS_KEY_ID ? `${process.env.APNS_KEY_ID.slice(0, 4)}...` : null,
        teamId: process.env.APNS_TEAM_ID || null,
        environment: process.env.APNS_ENVIRONMENT || 'sandbox',
        bundleId: process.env.APNS_BUNDLE_ID || 'to.bullhorn.app',
      },
      deviceTokens: (tokens || []).map((t) => ({
        id: t.id,
        platform: t.platform,
        tokenPreview: `${t.token.slice(0, 8)}...${t.token.slice(-8)}`,
        createdAt: t.created_at,
        updatedAt: t.updated_at,
      })),
      ready: apnsConfigured && (tokens?.length || 0) > 0,
    })
  } catch (error) {
    if ((error as Error).message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  if (!isDevAllowed()) {
    return Response.json({ error: 'Dev-only endpoint' }, { status: 403 })
  }

  try {
    const { userId } = await requireSessionAuth()

    let title = 'Bullhorn Test Push'
    let body = `Test notification sent at ${new Date().toLocaleTimeString()}`

    try {
      const json = await request.json()
      if (json.title) title = json.title
      if (json.body) body = json.body
    } catch {
      // Use defaults if no body provided
    }

    console.log(`[test-push] Sending to user ${userId}: "${title}" / "${body}"`)

    const sent = await sendApnsToUser(userId, {
      title,
      body,
      url: '/dashboard',
    })

    console.log(`[test-push] Result: ${sent} device(s) sent`)

    return Response.json({
      success: true,
      sent,
      environment: process.env.APNS_ENVIRONMENT || 'sandbox',
      message:
        sent > 0
          ? `Push sent to ${sent} device(s) via ${process.env.APNS_ENVIRONMENT || 'sandbox'} APNS`
          : 'No pushes sent — check GET /api/dev/test-push for diagnostics',
    })
  } catch (error) {
    if ((error as Error).message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[test-push] Error:', (error as Error).message)
    return Response.json(
      { error: 'Internal server error', details: (error as Error).message },
      { status: 500 }
    )
  }
}
