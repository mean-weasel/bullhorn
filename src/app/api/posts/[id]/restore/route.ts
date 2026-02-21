import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { transformPostFromDb, type DbPost } from '@/lib/utils'
import { requireAuth, validateScopes } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// POST /api/posts/[id]/restore - Restore an archived post
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth()
    const userId = auth.userId
    if (auth.scopes) {
      validateScopes(auth.scopes, ['posts:write'])
    }
    const { id } = await params
    const supabase = await createClient()

    // Get current post to validate it's archived (defense-in-depth: also check user_id)
    const { data: currentPost, error: fetchError } = await supabase
      .from('posts')
      .select('status')
      .eq('id', id)
      .eq('user_id', userId)
      .single()

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return NextResponse.json({ error: 'Post not found' }, { status: 404 })
      }
      console.error('Database error:', fetchError)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    if (currentPost.status !== 'archived') {
      return NextResponse.json({ error: 'Post is not archived' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('posts')
      .update({ status: 'draft' })
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single()

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    // Transform post from snake_case to camelCase
    const post = transformPostFromDb(data as DbPost)
    return NextResponse.json({ post })
  } catch (error) {
    if (error instanceof Error && error.message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Error restoring post:', error)
    return NextResponse.json({ error: 'Failed to restore post' }, { status: 500 })
  }
}
