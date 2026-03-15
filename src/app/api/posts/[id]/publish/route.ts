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
function validatePublishable(
  postRow: { status: string },
  post: ReturnType<typeof transformPostFromDb>
) {
  if (!PUBLISHABLE_STATUSES.includes(postRow.status)) {
    return { error: 'Post cannot be published in its current status' }
  }
  const textContent = getTextFromContent(post.content, post.platform)
  const charLimit = CHAR_LIMITS[post.platform]
  if (textContent.length > charLimit) {
    return { error: `Content exceeds the ${charLimit}-character limit` }
  }
  return null
}

async function findActiveAccount(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  platform: string
) {
  const { data, error } = await supabase
    .from('social_accounts')
    .select('id')
    .eq('user_id', userId)
    .eq('provider', platform)
    .eq('status', 'active')
    .limit(1)
    .single()
  return { account: data, error }
}

async function executePublish(
  supabase: Awaited<ReturnType<typeof createClient>>,
  post: ReturnType<typeof transformPostFromDb>,
  accountId: string,
  id: string,
  userId: string
) {
  const { error: lockError } = await supabase
    .from('posts')
    .update({ status: 'publishing' })
    .eq('id', id)
    .eq('user_id', userId)

  if (lockError) throw new Error('Failed to set publishing status')

  const result = await publishPost(post, accountId)
  const { data: updatedRow, error: updateError } = await supabase
    .from('posts')
    .update({
      status: result.success ? 'published' : 'failed',
      publish_result: result.publishResult ?? null,
    })
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single()

  if (updateError) throw new Error('Failed to update post after publish')

  const updatedPost = transformPostFromDb(updatedRow as DbPost)
  return { result, updatedPost }
}

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth()
    const userId = auth.userId
    if (auth.scopes) validateScopes(auth.scopes, ['posts:write'])

    const { id } = await params
    const supabase = await createClient()

    const { data: postRow, error: fetchError } = await supabase
      .from('posts')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single()

    if (fetchError) {
      if (fetchError.code === 'PGRST116')
        return NextResponse.json({ error: 'Post not found' }, { status: 404 })
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    const post = transformPostFromDb(postRow as DbPost)
    const valErr = validatePublishable(postRow, post)
    if (valErr) return NextResponse.json(valErr, { status: 400 })

    const { account, error: accountError } = await findActiveAccount(
      supabase,
      userId,
      postRow.platform
    )
    if (accountError || !account) {
      return NextResponse.json(
        { error: `No ${postRow.platform} account connected` },
        { status: 400 }
      )
    }

    const { result, updatedPost } = await executePublish(supabase, post, account.id, id, userId)

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
    if (error instanceof Error && error.message === 'Forbidden')
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    if (error instanceof Error && error.message === 'Unauthorized')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    console.error('Error publishing post:', error)
    return NextResponse.json({ error: 'Failed to publish post' }, { status: 500 })
  }
}
