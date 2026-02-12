import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth'
import { PLAN_LIMITS, type PlanType } from '@/lib/limits'

// Ensure this route is always dynamic (never cached by Next.js)
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    let userId: string
    try {
      const auth = await requireAuth()
      userId = auth.userId
    } catch {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = await createClient()

    // Get user plan and storage info
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('plan, storage_used_bytes')
      .eq('id', userId)
      .single()

    const plan = (profile?.plan as PlanType) || 'free'
    const storageUsedBytes = profile?.storage_used_bytes || 0
    const planLimits = PLAN_LIMITS[plan]

    // Count all resources in parallel
    const [posts, campaigns, projects, blogDrafts, launchPosts] = await Promise.all([
      supabase.from('posts').select('id').eq('user_id', userId),
      supabase.from('campaigns').select('id').eq('user_id', userId),
      supabase.from('projects').select('id').eq('user_id', userId),
      supabase.from('blog_drafts').select('id').eq('user_id', userId),
      supabase.from('launch_posts').select('id').eq('user_id', userId),
    ])

    return NextResponse.json({
      plan,
      limits: {
        posts: { current: posts.data?.length ?? 0, limit: planLimits.posts },
        campaigns: { current: campaigns.data?.length ?? 0, limit: planLimits.campaigns },
        projects: { current: projects.data?.length ?? 0, limit: planLimits.projects },
        blogDrafts: { current: blogDrafts.data?.length ?? 0, limit: planLimits.blogDrafts },
        launchPosts: { current: launchPosts.data?.length ?? 0, limit: planLimits.launchPosts },
      },
      storage: {
        usedBytes: storageUsedBytes,
        limitBytes: planLimits.storageBytes,
      },
    })
  } catch (error) {
    console.error('Error fetching plan info:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
