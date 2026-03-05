import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import {
  transformAnalyticsConnectionFromDb,
  transformAnalyticsConnectionToDb,
  type DbAnalyticsConnection,
} from '@/lib/utils'
import { requireAuth, parseJsonBody, validateScopes } from '@/lib/auth'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

/** Columns safe to return to the browser (excludes OAuth tokens) */
const SAFE_COLUMNS =
  'id, user_id, provider, property_id, property_name, scopes, project_id, last_sync_at, sync_status, sync_error, created_at, updated_at'

const updateAnalyticsConnectionSchema = z.object({
  propertyId: z.string().min(1).optional(),
  propertyName: z.string().max(500).optional().nullable(),
  provider: z.string().optional(),
  scopes: z.array(z.string()).optional(),
  projectId: z.string().uuid().optional().nullable(),
  syncStatus: z.string().optional(),
})

interface RouteContext {
  params: Promise<{ id: string }>
}

// GET /api/analytics/connections/[id] - Get single connection
export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    // Require authentication
    let userId: string
    try {
      const auth = await requireAuth()
      userId = auth.userId
      if (auth.scopes) {
        validateScopes(auth.scopes, ['analytics:read'])
      }
    } catch (authError) {
      const msg = (authError as Error).message
      if (msg === 'Forbidden') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await context.params
    const supabase = await createClient()

    // Defense-in-depth: filter by user_id even though RLS should handle this
    const { data, error } = await supabase
      .from('analytics_connections')
      .select(SAFE_COLUMNS)
      .eq('id', id)
      .eq('user_id', userId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Connection not found' }, { status: 404 })
      }
      console.error('Database error:', error)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    const connection = transformAnalyticsConnectionFromDb(data as DbAnalyticsConnection)
    return NextResponse.json({ connection })
  } catch (error) {
    console.error('Error fetching analytics connection:', error)
    return NextResponse.json({ error: 'Failed to fetch analytics connection' }, { status: 500 })
  }
}

// PATCH /api/analytics/connections/[id] - Update connection
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    // Require authentication
    let userId: string
    try {
      const auth = await requireAuth()
      userId = auth.userId
      if (auth.scopes) {
        validateScopes(auth.scopes, ['analytics:read'])
      }
    } catch (authError) {
      const msg = (authError as Error).message
      if (msg === 'Forbidden') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await context.params
    const supabase = await createClient()
    const jsonResult = await parseJsonBody(request)
    if ('error' in jsonResult) return jsonResult.error
    const body = jsonResult.data
    const parsed = updateAnalyticsConnectionSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    // Transform updates to snake_case
    const updates = transformAnalyticsConnectionToDb(parsed.data)

    // Update with ownership check (RLS handles this, but add defense-in-depth)
    const { data, error } = await supabase
      .from('analytics_connections')
      .update(updates)
      .eq('id', id)
      .eq('user_id', userId)
      .select(SAFE_COLUMNS)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Connection not found' }, { status: 404 })
      }
      console.error('Database error:', error)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    const connection = transformAnalyticsConnectionFromDb(data as DbAnalyticsConnection)
    return NextResponse.json({ connection })
  } catch (error) {
    console.error('Error updating analytics connection:', error)
    return NextResponse.json({ error: 'Failed to update analytics connection' }, { status: 500 })
  }
}

// DELETE /api/analytics/connections/[id] - Delete connection
export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    // Require authentication
    let userId: string
    try {
      const auth = await requireAuth()
      userId = auth.userId
      if (auth.scopes) {
        validateScopes(auth.scopes, ['analytics:read'])
      }
    } catch (authError) {
      const msg = (authError as Error).message
      if (msg === 'Forbidden') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await context.params
    const supabase = await createClient()

    // Delete with ownership check
    const { error } = await supabase
      .from('analytics_connections')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting analytics connection:', error)
    return NextResponse.json({ error: 'Failed to delete analytics connection' }, { status: 500 })
  }
}
