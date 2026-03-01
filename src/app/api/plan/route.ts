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

    // Fetch profile and all resource counts in parallel
    const [profileResult, posts, campaigns, projects, blogDrafts, launchPosts] = await Promise.all([
      supabase.from('user_profiles').select('plan, storage_used_bytes').eq('id', userId).single(),
      supabase.from('posts').select('*', { count: 'exact', head: true }).eq('user_id', userId),
      supabase.from('campaigns').select('*', { count: 'exact', head: true }).eq('user_id', userId),
      supabase.from('projects').select('*', { count: 'exact', head: true }).eq('user_id', userId),
      supabase
        .from('blog_drafts')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId),
      supabase
        .from('launch_posts')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId),
    ])

    const plan = (profileResult.data?.plan as PlanType) || 'free'
    const storageUsedBytes = profileResult.data?.storage_used_bytes || 0
    const planLimits = PLAN_LIMITS[plan]

    return NextResponse.json({
      plan,
      limits: {
        posts: { current: posts.count ?? 0, limit: planLimits.posts },
        campaigns: { current: campaigns.count ?? 0, limit: planLimits.campaigns },
        projects: { current: projects.count ?? 0, limit: planLimits.projects },
        blogDrafts: { current: blogDrafts.count ?? 0, limit: planLimits.blogDrafts },
        launchPosts: { current: launchPosts.count ?? 0, limit: planLimits.launchPosts },
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
