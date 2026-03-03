import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { transformCampaignFromDb, type DbCampaign } from '@/lib/utils'
import { requireAuth, validateScopes } from '@/lib/auth'

export const dynamic = 'force-dynamic'

interface RouteContext {
  params: Promise<{ id: string }>
}

// GET /api/projects/[id]/campaigns - List campaigns in project
export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const auth = await requireAuth()
    const userId = auth.userId
    if (auth.scopes) {
      validateScopes(auth.scopes, ['projects:read'])
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

    // Fetch campaigns for this project (defense-in-depth: also check user_id)
    const { data, error } = await supabase
      .from('campaigns')
      .select('*')
      .eq('project_id', projectId)
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(500)

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    const campaigns = (data || []).map((campaign) =>
      transformCampaignFromDb(campaign as DbCampaign)
    )
    return NextResponse.json({ campaigns })
  } catch (error) {
    if (error instanceof Error && error.message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Error fetching project campaigns:', error)
    return NextResponse.json({ error: 'Failed to fetch campaigns' }, { status: 500 })
  }
}
