import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { transformCampaignFromDb, type DbCampaign } from '@/lib/utils'
import { requireAuth } from '@/lib/auth'
import { z } from 'zod'

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
    } catch {
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

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
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
    } catch {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = await createClient()
    const body = await request.json()
    const parsed = createCampaignSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('campaigns')
      .insert({
        user_id: userId,
        name: parsed.data.name,
        description: parsed.data.description,
        status: parsed.data.status || 'active',
        project_id: parsed.data.projectId || null,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Transform campaign from snake_case to camelCase
    const campaign = transformCampaignFromDb(data as DbCampaign)
    return NextResponse.json({ campaign }, { status: 201 })
  } catch (error) {
    console.error('Error creating campaign:', error)
    return NextResponse.json({ error: 'Failed to create campaign' }, { status: 500 })
  }
}
