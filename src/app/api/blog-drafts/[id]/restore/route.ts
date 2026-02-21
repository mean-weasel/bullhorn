import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, validateScopes } from '@/lib/auth'
import { transformDraftFromDb } from '@/lib/utils'

export const dynamic = 'force-dynamic'

// POST /api/blog-drafts/[id]/restore - Restore an archived blog draft
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth()
    const userId = auth.userId
    if (auth.scopes) {
      validateScopes(auth.scopes, ['blog:write'])
    }
    const { id } = await params
    const supabase = await createClient()

    // Defense-in-depth: filter by user_id alongside RLS
    const { data: currentDraft, error: fetchError } = await supabase
      .from('blog_drafts')
      .select('status')
      .eq('id', id)
      .eq('user_id', userId)
      .single()

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return NextResponse.json({ error: 'Blog draft not found' }, { status: 404 })
      }
      console.error('Database error:', fetchError)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    if (currentDraft.status !== 'archived') {
      return NextResponse.json({ error: 'Blog draft is not archived' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('blog_drafts')
      .update({ status: 'draft' })
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single()

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    // Transform to camelCase for frontend
    return NextResponse.json({ draft: transformDraftFromDb(data) })
  } catch (error) {
    if (error instanceof Error && error.message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Error restoring blog draft:', error)
    return NextResponse.json({ error: 'Failed to restore blog draft' }, { status: 500 })
  }
}
