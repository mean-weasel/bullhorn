import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, validateScopes } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// DELETE /api/campaigns/[id]/posts/[postId] - Remove post from campaign
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; postId: string }> }
) {
  try {
    // Require authentication
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

    const { id, postId } = await params
    const supabase = await createClient()

    // CRITICAL: Verify user owns the campaign
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select('id')
      .eq('id', id)
      .eq('user_id', userId)
      .single()

    if (campaignError || !campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    // Verify the post belongs to this campaign AND user owns it
    const { data: post, error: fetchError } = await supabase
      .from('posts')
      .select('campaign_id')
      .eq('id', postId)
      .eq('user_id', userId)
      .single()

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return NextResponse.json({ error: 'Post not found' }, { status: 404 })
      }
      console.error('Database error:', fetchError)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    if (post.campaign_id !== id) {
      return NextResponse.json({ error: 'Post does not belong to this campaign' }, { status: 400 })
    }

    // Remove campaign association (with ownership check)
    const { data, error } = await supabase
      .from('posts')
      .update({ campaign_id: null })
      .eq('id', postId)
      .eq('user_id', userId)
      .select()
      .single()

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Error removing post from campaign:', error)
    return NextResponse.json({ error: 'Failed to remove post from campaign' }, { status: 500 })
  }
}
