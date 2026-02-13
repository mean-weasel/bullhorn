import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, validateScopes } from '@/lib/auth'

interface RouteContext {
  params: Promise<{ id: string }>
}

// GET /api/projects/[id]/analytics - Get rolled-up analytics for project
export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const auth = await requireAuth()
    const userId = auth.userId
    if (auth.scopes) {
      validateScopes(auth.scopes, ['analytics:read'])
    }
    const { id: projectId } = await context.params
    const supabase = await createClient()

    // Verify project exists and user owns it (defense-in-depth alongside RLS)
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id')
      .eq('id', projectId)
      .eq('user_id', userId)
      .single()

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Get campaign IDs for this project (defense-in-depth: also check user_id)
    const { data: campaigns, error: campaignsError } = await supabase
      .from('campaigns')
      .select('id')
      .eq('project_id', projectId)
      .eq('user_id', userId)

    if (campaignsError) {
      return NextResponse.json({ error: campaignsError.message }, { status: 500 })
    }

    const campaignIds = (campaigns || []).map((c) => c.id)
    const totalCampaigns = campaignIds.length

    // If no campaigns, return zero counts
    if (totalCampaigns === 0) {
      return NextResponse.json({
        analytics: {
          totalCampaigns: 0,
          totalPosts: 0,
          scheduledPosts: 0,
          publishedPosts: 0,
          draftPosts: 0,
          failedPosts: 0,
        },
      })
    }

    // Get post counts by status for all campaigns in project (defense-in-depth)
    const { data: posts, error: postsError } = await supabase
      .from('posts')
      .select('status')
      .eq('user_id', userId)
      .in('campaign_id', campaignIds)

    if (postsError) {
      return NextResponse.json({ error: postsError.message }, { status: 500 })
    }

    const postStatuses = posts || []
    const totalPosts = postStatuses.length
    const scheduledPosts = postStatuses.filter((p) => p.status === 'scheduled').length
    const publishedPosts = postStatuses.filter((p) => p.status === 'published').length
    const draftPosts = postStatuses.filter((p) => p.status === 'draft').length
    const failedPosts = postStatuses.filter((p) => p.status === 'failed').length

    return NextResponse.json({
      analytics: {
        totalCampaigns,
        totalPosts,
        scheduledPosts,
        publishedPosts,
        draftPosts,
        failedPosts,
      },
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Error fetching project analytics:', error)
    return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 })
  }
}
