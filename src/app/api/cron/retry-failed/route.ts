import { NextRequest, NextResponse } from 'next/server'
import { verifyCronSecret } from '@/lib/cronAuth'

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
  const authError = verifyCronSecret(request)
  if (authError) return authError

  return NextResponse.json({
    status: 'no-op',
    message: 'Auto-retry disabled in notification-first architecture',
  })
}
