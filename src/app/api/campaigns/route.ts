import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { transformCampaignFromDb, type DbCampaign } from '@/lib/utils'
import { requireAuth, validateScopes, parseJsonBody } from '@/lib/auth'
import { enforceResourceLimit } from '@/lib/planEnforcement'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const createCampaignSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional().nullable(),
  status: z.enum(['active', 'paused', 'completed', 'archived']).optional(),
  projectId: z.string().uuid().optional().nullable(),
})

// GET /api/campaigns - List campaigns
// Supports filtering: ?status=active&projectId=uuid (or projectId=unassigned for null)
export async function GET(request: NextRequest) {
  try {
    // Require authentication
    let userId: string
    try {
      const auth = await requireAuth()
      userId = auth.userId
      if (auth.scopes) {
        validateScopes(auth.scopes, ['campaigns:read'])
      }
    } catch (authError) {
      const msg = (authError as Error).message
      if (msg === 'Forbidden') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = await createClient()
    const { searchParams } = new URL(request.url)

    const status = searchParams.get('status')
    const projectId = searchParams.get('projectId')

    let query = supabase
      .from('campaigns')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })

    if (status && status !== 'all') {
      query = query.eq('status', status)
    }

    // Filter by project
    if (projectId === 'unassigned') {
      query = query.is('project_id', null)
    } else if (projectId) {
      query = query.eq('project_id', projectId)
    }

    const { data, error } = await query.limit(100)

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    // Transform campaigns from snake_case to camelCase
    const campaigns = (data || []).map((campaign) =>
      transformCampaignFromDb(campaign as DbCampaign)
    )
    return NextResponse.json({ campaigns })
  } catch (error) {
    console.error('Error fetching campaigns:', error)
    return NextResponse.json({ error: 'Failed to fetch campaigns' }, { status: 500 })
  }
}

// POST /api/campaigns - Create campaign
export async function POST(request: NextRequest) {
  try {
    // Require authentication - throws if not authenticated
    let userId: string
    try {
      const auth = await requireAuth()
      userId = auth.userId
      if (auth.scopes) {
        validateScopes(auth.scopes, ['campaigns:write'])
      }
    } catch (authError) {
      const msg = (authError as Error).message
      if (msg === 'Forbidden') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Enforce plan limit
    const limitCheck = await enforceResourceLimit(userId, 'campaigns')
    if (!limitCheck.allowed) {
      return NextResponse.json(
        {
          error: 'Campaign limit reached',
          limit: limitCheck.limit,
          current: limitCheck.current,
          plan: limitCheck.plan,
        },
        { status: 403 }
      )
    }

    const supabase = await createClient()
    const jsonResult = await parseJsonBody(request)
    if ('error' in jsonResult) return jsonResult.error
    const body = jsonResult.data
    const parsed = createCampaignSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const name = parsed.data.name.trim()
    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('campaigns')
      .insert({
        user_id: userId,
        name,
        description: parsed.data.description,
        status: parsed.data.status || 'active',
        project_id: parsed.data.projectId || null,
      })
      .select()
      .single()

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    // Transform campaign from snake_case to camelCase
    const campaign = transformCampaignFromDb(data as DbCampaign)
    return NextResponse.json({ campaign }, { status: 201 })
  } catch (error) {
    console.error('Error creating campaign:', error)
    return NextResponse.json({ error: 'Failed to create campaign' }, { status: 500 })
  }
}
