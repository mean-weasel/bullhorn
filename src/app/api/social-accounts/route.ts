import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { transformSocialAccountFromDb, type DbSocialAccount } from '@/lib/utils'
import { requireSessionAuth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// Safe columns — never return access_token or refresh_token to the client
const SAFE_COLUMNS =
  'id, user_id, provider, provider_account_id, username, display_name, ' +
  'avatar_url, scopes, connected_at, last_used_at, status, status_error, ' +
  'created_at, updated_at'

// GET /api/social-accounts — List user's connected social accounts
export async function GET() {
  try {
    let userId: string
    try {
      const auth = await requireSessionAuth()
      userId = auth.userId
    } catch {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = await createClient()

    const { data, error } = await supabase
      .from('social_accounts')
      .select(SAFE_COLUMNS)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(100)

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    const accounts = (data || []).map((row) =>
      transformSocialAccountFromDb(row as unknown as DbSocialAccount)
    )

    return NextResponse.json({ accounts })
  } catch (error) {
    console.error('Error fetching social accounts:', error)
    return NextResponse.json({ error: 'Failed to fetch social accounts' }, { status: 500 })
  }
}
