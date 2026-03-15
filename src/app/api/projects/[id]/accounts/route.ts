import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, validateScopes, parseJsonBody } from '@/lib/auth'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const addAccountSchema = z.object({
  accountId: z.string().min(1),
})

interface RouteContext {
  params: Promise<{ id: string }>
}

// GET /api/projects/[id]/accounts - List accounts associated with project
export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    // Require authentication
    let userId: string
    try {
      const auth = await requireAuth()
      userId = auth.userId
      if (auth.scopes) {
        validateScopes(auth.scopes, ['projects:read'])
      }
    } catch (authError) {
      const msg = (authError as Error).message
      if (msg === 'Forbidden') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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

    // Fetch account associations
    const { data, error } = await supabase
      .from('project_accounts')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
      .limit(500)

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    // Transform to camelCase
    const accounts = (data || []).map((pa) => ({
      id: pa.id,
      projectId: pa.project_id,
      accountId: pa.account_id,
      createdAt: pa.created_at,
    }))

    return NextResponse.json({ accounts })
  } catch (error) {
    console.error('Error fetching project accounts:', error)
    return NextResponse.json({ error: 'Failed to fetch accounts' }, { status: 500 })
  }
}

// POST /api/projects/[id]/accounts - Add account to project
// eslint-disable-next-line max-lines-per-function -- API handler requires auth+db in single try/catch
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    // Require authentication
    let userId: string
    try {
      const auth = await requireAuth()
      userId = auth.userId
      if (auth.scopes) {
        validateScopes(auth.scopes, ['projects:write'])
      }
    } catch (authError) {
      const msg = (authError as Error).message
      if (msg === 'Forbidden') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: projectId } = await context.params
    const supabase = await createClient()
    const jsonResult = await parseJsonBody(request)
    if ('error' in jsonResult) return jsonResult.error
    const body = jsonResult.data
    const parsed = addAccountSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

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

    // Create association
    const { data, error } = await supabase
      .from('project_accounts')
      .insert({
        project_id: projectId,
        account_id: parsed.data.accountId,
      })
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        // Unique violation
        return NextResponse.json(
          { error: 'Account already associated with project' },
          { status: 409 }
        )
      }
      console.error('Database error:', error)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    return NextResponse.json(
      {
        account: {
          id: data.id,
          projectId: data.project_id,
          accountId: data.account_id,
          createdAt: data.created_at,
        },
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Error adding account to project:', error)
    return NextResponse.json({ error: 'Failed to add account' }, { status: 500 })
  }
}

// DELETE /api/projects/[id]/accounts - Remove account from project
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    // Require authentication
    let userId: string
    try {
      const auth = await requireAuth()
      userId = auth.userId
      if (auth.scopes) {
        validateScopes(auth.scopes, ['projects:write'])
      }
    } catch (authError) {
      const msg = (authError as Error).message
      if (msg === 'Forbidden') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: projectId } = await context.params
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const accountId = searchParams.get('accountId')

    if (!accountId) {
      return NextResponse.json({ error: 'accountId query parameter is required' }, { status: 400 })
    }

    // Verify project ownership (defense-in-depth alongside RLS)
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id')
      .eq('id', projectId)
      .eq('user_id', userId)
      .single()

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Delete association
    const { error } = await supabase
      .from('project_accounts')
      .delete()
      .eq('project_id', projectId)
      .eq('account_id', accountId)

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error removing account from project:', error)
    return NextResponse.json({ error: 'Failed to remove account' }, { status: 500 })
  }
}
