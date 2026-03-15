import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { transformPostFromDb, type DbPost } from '@/lib/utils'
import { requireAuth, validateScopes } from '@/lib/auth'
import { publishPost } from '@/lib/publishers'
import { CHAR_LIMITS, getTextFromContent } from '@/lib/posts'

export const dynamic = 'force-dynamic'

/** Statuses from which a post can be immediately published. */
const PUBLISHABLE_STATUSES = ['draft', 'scheduled', 'failed']

// POST /api/posts/[id]/publish - Immediately publish a post
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth()
    const userId = auth.userId
    if (auth.scopes) {
      validateScopes(auth.scopes, ['posts:write'])
    }
    const { id } = await params
    const supabase = await createClient()

    // 1. Fetch post and verify ownership
    const { data: postRow, error: fetchError } = await supabase
      .from('posts')
      .select('*')
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

    // 2. Validate the post is in a publishable status
    if (!PUBLISHABLE_STATUSES.includes(postRow.status)) {
      return NextResponse.json(
        { error: 'Post cannot be published in its current status' },
        { status: 400 }
      )
    }

    // 2b. Validate content does not exceed platform character limit
    const transformedPost = transformPostFromDb(postRow as DbPost)
    const textContent = getTextFromContent(transformedPost.content, transformedPost.platform)
    const charLimit = CHAR_LIMITS[transformedPost.platform]
    if (textContent.length > charLimit) {
      return NextResponse.json(
        {
          error: `Content exceeds the ${charLimit}-character limit`,
        },
        { status: 400 }
      )
    }

    // 3. Find an active social account for this platform
    const accountQuery = supabase
      .from('social_accounts')
      .select('id')
      .eq('user_id', userId)
      .eq('provider', postRow.platform)
      .eq('status', 'active')

    const { data: account, error: accountError } = await accountQuery.limit(1).single()

    if (accountError || !account) {
      return NextResponse.json(
        { error: `No ${postRow.platform} account connected` },
        { status: 400 }
      )
    }

    // 4. Set status to 'publishing' (optimistic lock)
    const { error: lockError } = await supabase
      .from('posts')
      .update({ status: 'publishing' })
      .eq('id', id)
      .eq('user_id', userId)

    if (lockError) {
      console.error('Failed to set publishing status:', lockError)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    // 5. Call the publisher
    const post = transformedPost
    const result = await publishPost(post, account.id)

    // 6. Update post with result
    const finalStatus = result.success ? 'published' : 'failed'
    const { data: updatedRow, error: updateError } = await supabase
      .from('posts')
      .update({
        status: finalStatus,
        publish_result: result.publishResult ?? null,
      })
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single()

    if (updateError) {
      console.error('Failed to update post after publish:', updateError)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    const updatedPost = transformPostFromDb(updatedRow as DbPost)

    if (result.success) {
      return NextResponse.json({
        success: true,
        post: updatedPost,
        publishResult: result.publishResult,
      })
    }

    return NextResponse.json(
      { success: false, post: updatedPost, error: result.error },
      { status: 422 }
    )
  } catch (error) {
    if (error instanceof Error && error.message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Error publishing post:', error)
    return NextResponse.json({ error: 'Failed to publish post' }, { status: 500 })
  }
}
