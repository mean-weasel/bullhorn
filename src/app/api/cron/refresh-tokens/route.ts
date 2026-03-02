import { createClient as createSupabaseJsClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { refreshTokenIfNeeded, type SocialAccountWithTokens } from '@/lib/tokenRefresh'
import { verifyCronSecret } from '@/lib/cronAuth'

export const dynamic = 'force-dynamic'

/** Provider-specific refresh thresholds in milliseconds */
const REFRESH_THRESHOLDS: Record<string, number> = {
  twitter: 60 * 60 * 1000, // 1 hour before expiry
  reddit: 30 * 60 * 1000, // 30 minutes before expiry
  linkedin: 7 * 24 * 60 * 60 * 1000, // 7 days before expiry
}

function createServiceClient() {
  return createSupabaseJsClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      global: {
        fetch: (url, options) => fetch(url, { ...options, cache: 'no-store' }),
      },
    }
  )
}

function needsRefresh(provider: string, tokenExpiresAt: string | null): boolean {
  if (!tokenExpiresAt) return true
  const threshold = REFRESH_THRESHOLDS[provider]
  if (!threshold) return false
  const expiryMs = new Date(tokenExpiresAt).getTime()
  return expiryMs - Date.now() < threshold
}

async function fetchAccountsToRefresh() {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('social_accounts')
    .select('id, provider, access_token, refresh_token, token_expires_at')
    .eq('status', 'active')
    .not('refresh_token', 'is', null)
    .limit(100)

  if (error) throw new Error(`Failed to fetch accounts: ${error.message}`)
  return (data || []) as SocialAccountWithTokens[]
}

async function processAccounts(accounts: SocialAccountWithTokens[]) {
  let refreshed = 0
  let failed = 0
  let skipped = 0

  for (const account of accounts) {
    if (!needsRefresh(account.provider, account.token_expires_at)) {
      skipped++
      continue
    }
    try {
      await refreshTokenIfNeeded(account)
      refreshed++
    } catch (err) {
      console.error(`Token refresh failed for ${account.id}:`, err)
      failed++
    }
  }

  return { refreshed, failed, skipped }
}

export async function GET(request: NextRequest) {
  const authError = verifyCronSecret(request)
  if (authError) return authError

  try {
    const accounts = await fetchAccountsToRefresh()
    const { refreshed, failed, skipped } = await processAccounts(accounts)

    return NextResponse.json({
      processed: accounts.length,
      refreshed,
      failed,
      skipped,
    })
  } catch (err) {
    console.error('Cron refresh-tokens error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
