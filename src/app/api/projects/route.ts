import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { transformProjectFromDb } from '@/lib/utils'
import { requireAuth } from '@/lib/auth'
import { z } from 'zod'

const createProjectSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional().nullable(),
  hashtags: z.array(z.string()).optional(),
  brandColors: z.record(z.string(), z.string()).optional(),
  logoUrl: z.string().url().optional().nullable(),
})

const SOFT_LIMIT = 3

// GET /api/projects - List projects
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
      .from('projects')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Transform projects from snake_case to camelCase
    const projects = (data || []).map((project) =>
      transformProjectFromDb(project as Record<string, unknown>)
    )

    return NextResponse.json({
      projects,
      meta: {
        count: projects.length,
        softLimit: SOFT_LIMIT,
        atLimit: projects.length >= SOFT_LIMIT,
      },
    })
  } catch (error) {
    console.error('Error fetching projects:', error)
    return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 })
  }
}

// POST /api/projects - Create project
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
    const body = await request.json()
    const parsed = createProjectSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    // Check soft limit (informational only - don't block creation)
    const { count } = await supabase
      .from('projects')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)

    const atLimit = (count || 0) >= SOFT_LIMIT

    const { data, error } = await supabase
      .from('projects')
      .insert({
        user_id: userId,
        name: parsed.data.name.trim(),
        description: parsed.data.description || null,
        hashtags: parsed.data.hashtags || [],
        brand_colors: parsed.data.brandColors || {},
        logo_url: parsed.data.logoUrl || null,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Transform project from snake_case to camelCase
    const project = transformProjectFromDb(data as Record<string, unknown>)
    return NextResponse.json(
      {
        project,
        meta: { atLimit },
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Error creating project:', error)
    return NextResponse.json({ error: 'Failed to create project' }, { status: 500 })
  }
}
