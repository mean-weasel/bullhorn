import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, validateScopes, type ApiKeyScope } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// GET /api/posts/[id]/media - Get signed download URLs for post media
// eslint-disable-next-line max-lines-per-function -- near-borderline, extraction would hurt readability
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    let userId: string
    try {
      const auth = await requireAuth()
      userId = auth.userId

      if (auth.scopes) {
        const required: ApiKeyScope[] = ['posts:read']
        validateScopes(auth.scopes, required)
      }
    } catch (authError) {
      const msg = (authError as Error).message
      if (msg === 'Forbidden') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = await createClient()
    const { id } = await params

    const { data: post, error } = await supabase
      .from('posts')
      .select('id, content, platform')
      .eq('id', id)
      .eq('user_id', userId)
      .single()

    if (error || !post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 })
    }

    const content = post.content as Record<string, unknown>
    const mediaFiles: string[] = []

    if (content.mediaUrls && Array.isArray(content.mediaUrls)) {
      mediaFiles.push(...(content.mediaUrls as string[]))
    }
    if (content.mediaUrl && typeof content.mediaUrl === 'string') {
      mediaFiles.push(content.mediaUrl)
    }

    if (mediaFiles.length === 0) {
      return NextResponse.json({ media: [], message: 'No media attached to this post' })
    }

    const media = await Promise.all(
      mediaFiles.map(async (fileUrl) => {
        const filename = fileUrl.split('/').pop() || fileUrl
        const storagePath = `${userId}/${filename}`
        const { data: signedUrl } = await supabase.storage
          .from('media')
          .createSignedUrl(storagePath, 3600)

        return {
          filename,
          originalUrl: fileUrl,
          downloadUrl: signedUrl?.signedUrl || null,
          expiresIn: 3600,
        }
      })
    )

    return NextResponse.json({ media })
  } catch (error) {
    console.error('Error fetching post media:', error)
    return NextResponse.json({ error: 'Failed to fetch post media' }, { status: 500 })
  }
}
