import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, validateScopes } from '@/lib/auth'

export const dynamic = 'force-dynamic'

interface RouteContext {
  params: Promise<{ id: string }>
}

// GET /api/projects/[id]/analytics - Get rolled-up analytics for project
// eslint-disable-next-line max-lines-per-function -- API handler requires auth+db in single try/catch
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
      console.error('Database error:', campaignsError)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
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

    // Get post counts by status in parallel (head: true returns only count, no rows)
    const baseQuery = () =>
      supabase
        .from('posts')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .in('campaign_id', campaignIds)

    const [totalResult, scheduledResult, publishedResult, draftResult, failedResult] =
      await Promise.all([
        baseQuery(),
        baseQuery().eq('status', 'scheduled'),
        baseQuery().eq('status', 'published'),
        baseQuery().eq('status', 'draft'),
        baseQuery().eq('status', 'failed'),
      ])

    const postsError =
      totalResult.error ||
      scheduledResult.error ||
      publishedResult.error ||
      draftResult.error ||
      failedResult.error

    if (postsError) {
      console.error('Database error:', postsError)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    return NextResponse.json({
      analytics: {
        totalCampaigns,
        totalPosts: totalResult.count ?? 0,
        scheduledPosts: scheduledResult.count ?? 0,
        publishedPosts: publishedResult.count ?? 0,
        draftPosts: draftResult.count ?? 0,
        failedPosts: failedResult.count ?? 0,
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
