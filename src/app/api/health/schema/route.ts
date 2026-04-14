import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * Schema health canary.
 *
 * Probes every user-facing table with `select *` and every RPC with a no-op
 * invocation. The intent is to catch PostgREST schema-cache drift: the failure
 * mode where a migration lands in the database but PostgREST has not yet
 * reloaded its cached schema, so the live app sees spurious 500s on the
 * affected table or RPC.
 *
 * Gated on E2E test mode + VERCEL!=1 so this endpoint is invisible in
 * production and preview deploys. A future PR can add a Bearer CRON_SECRET
 * path if we want to run this as a nightly synthetic check against prod.
 *
 * KEEP IN SYNC: when a migration adds or removes a user-facing table or RPC,
 * update the TABLES and RPCS constants below.
 */

const TABLES = [
  'analytics_connections',
  'api_keys',
  'blog_drafts',
  'campaigns',
  'community_events',
  'deleted_accounts',
  'launch_posts',
  'notification_preferences',
  'plan_changes',
  'posts',
  'pro_waitlist',
  'project_accounts',
  'projects',
  'push_device_tokens',
  'reminders',
  'social_accounts',
  'user_event_subscriptions',
  'user_profiles',
  'web_push_subscriptions',
] as const

// bytes_param: 0 + an all-zero UUID that matches no user row → the UPDATE
// inside each RPC is a structurally-valid no-op (zero rows affected).
const SAFE_UUID = '00000000-0000-0000-0000-000000000000'
const RPCS = [
  { name: 'increment_storage_used', args: { user_id_param: SAFE_UUID, bytes_param: 0 } },
  { name: 'decrement_storage_used', args: { user_id_param: SAFE_UUID, bytes_param: 0 } },
] as const

export async function GET() {
  if (
    process.env.VERCEL === '1' ||
    process.env.E2E_TEST_MODE !== 'true' ||
    process.env.CI !== 'true'
  ) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const supabase = await createClient()
  const errors: string[] = []

  for (const table of TABLES) {
    const { error } = await supabase.from(table).select('*').limit(1)
    if (error) errors.push(`table ${table}: ${error.message}`)
  }

  for (const { name, args } of RPCS) {
    const { error } = await supabase.rpc(name, args)
    if (error) errors.push(`rpc ${name}: ${error.message}`)
  }

  if (errors.length) {
    return NextResponse.json({ ok: false, errors }, { status: 500 })
  }
  return NextResponse.json({ ok: true, tables: TABLES.length, rpcs: RPCS.length })
}
