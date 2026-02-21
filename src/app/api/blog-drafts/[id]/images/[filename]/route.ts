import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// DELETE /api/blog-drafts/[id]/images/[filename] - Remove image from blog draft
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; filename: string }> }
) {
  try {
    const { userId } = await requireAuth()
    const { id, filename } = await params
    const supabase = await createClient()

    // Decode filename in case it's URL encoded
    const decodedFilename = decodeURIComponent(filename)

    // Get current draft (defense-in-depth: also check user_id)
    const { data: draft, error: fetchError } = await supabase
      .from('blog_drafts')
      .select('images')
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

    // Remove image from array
    const images = (draft.images || []).filter(
      (img: { filename: string }) => img.filename !== decodedFilename
    )

    // Update draft
    const { data, error } = await supabase
      .from('blog_drafts')
      .update({ images })
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single()

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Error removing image from blog draft:', error)
    return NextResponse.json({ error: 'Failed to remove image' }, { status: 500 })
  }
}
