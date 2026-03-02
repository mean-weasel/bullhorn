import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { transformAnalyticsConnectionFromDb, type DbAnalyticsConnection } from '@/lib/utils'
import { requireAuth, parseJsonBody } from '@/lib/auth'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const createAnalyticsConnectionSchema = z.object({
  propertyId: z.string().min(1),
  propertyName: z.string().max(500).optional().nullable(),
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1),
  tokenExpiresAt: z.string().min(1),
  provider: z.string().optional(),
  scopes: z.array(z.string()).optional(),
  projectId: z.string().uuid().optional().nullable(),
})

// GET /api/analytics/connections - List connections
export async function GET() {
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

    // Defense-in-depth: filter by user_id even though RLS should handle this
    const { data, error } = await supabase
      .from('analytics_connections')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(100)

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    // Transform connections from snake_case to camelCase
    const connections = (data || []).map((conn) =>
      transformAnalyticsConnectionFromDb(conn as DbAnalyticsConnection)
    )

    return NextResponse.json({ connections })
  } catch (error) {
    console.error('Error fetching analytics connections:', error)
    return NextResponse.json({ error: 'Failed to fetch analytics connections' }, { status: 500 })
  }
}

// POST /api/analytics/connections - Create connection
export async function POST(request: NextRequest) {
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
    const jsonResult = await parseJsonBody(request)
    if ('error' in jsonResult) return jsonResult.error
    const body = jsonResult.data
    const parsed = createAnalyticsConnectionSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    // Check if connection already exists for this property
    const { data: existing } = await supabase
      .from('analytics_connections')
      .select('id')
      .eq('user_id', userId)
      .eq('property_id', parsed.data.propertyId)
      .single()

    if (existing) {
      return NextResponse.json(
        { error: 'Connection already exists for this property' },
        { status: 409 }
      )
    }

    const { data, error } = await supabase
      .from('analytics_connections')
      .insert({
        user_id: userId,
        provider: parsed.data.provider || 'google_analytics',
        property_id: parsed.data.propertyId,
        property_name: parsed.data.propertyName || null,
        access_token: parsed.data.accessToken,
        refresh_token: parsed.data.refreshToken,
        token_expires_at: parsed.data.tokenExpiresAt,
        scopes: parsed.data.scopes || [],
        project_id: parsed.data.projectId || null,
        sync_status: 'pending',
      })
      .select()
      .single()

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    // Transform connection from snake_case to camelCase
    const connection = transformAnalyticsConnectionFromDb(data as DbAnalyticsConnection)
    return NextResponse.json({ connection }, { status: 201 })
  } catch (error) {
    console.error('Error creating analytics connection:', error)
    return NextResponse.json({ error: 'Failed to create analytics connection' }, { status: 500 })
  }
}
