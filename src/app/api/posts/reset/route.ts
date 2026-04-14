import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// Test user ID - must match the one in auth.ts
const TEST_USER_ID = '00000000-0000-0000-0000-000000000001'
const TEST_USER_EMAIL = 'test@example.com'

export async function POST() {
  // SECURITY: Never allow reset on Vercel (build or runtime).
  // Can't gate on NODE_ENV !== 'production' because `next start` forces
  // NODE_ENV=production in CI; VERCEL=1 is the correct Vercel-only signal.
  if (process.env.VERCEL === '1') {
    return NextResponse.json({ error: 'Reset endpoint is disabled on Vercel' }, { status: 403 })
  }

  // Only allow in E2E test mode (requires CI=true + E2E_TEST_MODE=true)
  if (process.env.E2E_TEST_MODE !== 'true' || process.env.CI !== 'true') {
    return NextResponse.json(
      { error: 'Reset endpoint only available in test mode' },
      { status: 403 }
    )
  }

  try {
    const supabase = await createClient()

    // Ensure test user exists in auth.users (required for foreign key constraints)
    // Use admin API to create user if it doesn't exist
    const { data: existingUser } = await supabase.auth.admin.getUserById(TEST_USER_ID)
    if (!existingUser?.user) {
      await supabase.auth.admin.createUser({
        email: TEST_USER_EMAIL,
        email_confirm: true,
        user_metadata: { name: 'Test User' },
        // Set specific ID for the test user
        id: TEST_USER_ID,
      })
    }

    // Delete all test data in parallel batches (respecting foreign key constraints)
    // Note: In test mode, RLS is bypassed so this works without auth

    // Batch 1: posts, launch_posts, blog_drafts (no FK deps between them)
    await Promise.all([
      supabase.from('posts').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
      supabase.from('launch_posts').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
      supabase.from('blog_drafts').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
    ])

    // Batch 2: campaigns, project_accounts (depend on posts being deleted)
    await Promise.all([
      supabase.from('campaigns').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
      supabase.from('project_accounts').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
    ])

    // Batch 3: projects (depends on campaigns and project_accounts)
    await supabase.from('projects').delete().neq('id', '00000000-0000-0000-0000-000000000000')

    // Reset plan to free and storage to 0 for E2E limit testing
    await supabase
      .from('user_profiles')
      .update({ plan: 'free', storage_used_bytes: 0 })
      .eq('id', TEST_USER_ID)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error resetting database:', error)
    return NextResponse.json({ error: 'Failed to reset database' }, { status: 500 })
  }
}
