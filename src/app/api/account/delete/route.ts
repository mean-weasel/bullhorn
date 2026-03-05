import { NextResponse } from 'next/server'
import { createClient as createSupabaseJsClient } from '@supabase/supabase-js'
import { requireSessionAuth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

/**
 * POST /api/account/delete
 * Permanently deletes the authenticated user's account and all data.
 * Uses service role to delete from auth.users (cascades via FK).
 */
export async function POST(_request: Request) {
  try {
    const { userId } = await requireSessionAuth()

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    const adminClient = createSupabaseJsClient(supabaseUrl, serviceKey, {
      global: {
        fetch: (url: string | URL | Request, options?: RequestInit) =>
          fetch(url, { ...options, cache: 'no-store' }),
      },
    })

    // Clean up storage buckets (best-effort — failure should NOT block account deletion)
    try {
      const buckets = ['media', 'logos'] as const
      for (const bucket of buckets) {
        const { data: files } = await adminClient.storage.from(bucket).list(userId)
        if (files && files.length > 0) {
          const paths = files.map((f) => `${userId}/${f.name}`)
          await adminClient.storage.from(bucket).remove(paths)
        }
      }
    } catch (storageError) {
      // Log but don't block account deletion
      console.error('Storage cleanup error (non-blocking):', storageError)
    }

    // Delete the auth user — all tables (posts, campaigns, projects, user_profiles, etc.)
    // reference auth.users(id) ON DELETE CASCADE, so this single delete cascades everything.
    const { error: authError } = await adminClient.auth.admin.deleteUser(userId)

    if (authError) {
      console.error('Failed to delete auth user:', authError)
      return NextResponse.json({ error: 'Failed to delete account' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    if ((error as Error).message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Account deletion error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
