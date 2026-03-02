import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * Cron: retry-failed (NO-OP)
 *
 * Previously auto-retried failed posts via publishPost().
 * Now a no-op — publishing is external (Claude in Chrome, Share Sheet,
 * manual copy/paste). Users retry manually from the post detail page.
 *
 * Kept as a stub so vercel.json cron config doesn't 404.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return NextResponse.json({
    status: 'no-op',
    message: 'Auto-retry disabled in notification-first architecture',
  })
}
