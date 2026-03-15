import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseJsClient } from '@supabase/supabase-js'
import { verifyCronSecret } from '@/lib/cronAuth'

export const dynamic = 'force-dynamic'

/**
 * Cron: cleanup-media
 *
 * Finds and removes orphaned media files — files in Supabase Storage
 * that are not referenced by any post's content. Also reconciles
 * storage_used_bytes for each affected user.
 *
 * Intended to run weekly via Vercel cron.
 */

function createServiceClient() {
  return createSupabaseJsClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      global: {
        fetch: (url, options) => fetch(url, { ...options, cache: 'no-store' }),
      },
    }
  )
}

export async function GET(request: NextRequest) {
  const authError = verifyCronSecret(request)
  if (authError) return authError

  const supabase = createServiceClient()

  try {
    // Get all users with storage
    const { data: users, error: usersError } = await supabase
      .from('user_profiles')
      .select('id, storage_used_bytes')
      .gt('storage_used_bytes', 0)
      .limit(100)

    if (usersError) {
      console.error('[cleanup-media] Failed to fetch users:', usersError)
      return NextResponse.json({ error: 'Database query failed' }, { status: 500 })
    }

    let orphansRemoved = 0
    let bytesReclaimed = 0
    let usersProcessed = 0

    for (const user of users || []) {
      // List all files in user's media folder
      const { data: storageFiles } = await supabase.storage.from('media').list(user.id, {
        limit: 500,
      })

      if (!storageFiles?.length) continue

      // Get all media URLs referenced by this user's posts
      const { data: posts } = await supabase.from('posts').select('content').eq('user_id', user.id)

      const referencedFiles = new Set<string>()
      for (const post of posts || []) {
        const content = post.content as Record<string, unknown>
        if (Array.isArray(content?.mediaUrls)) {
          for (const url of content.mediaUrls) {
            const match = (url as string).match(/\/api\/media\/([^/?#]+)/)
            if (match) referencedFiles.add(match[1])
          }
        }
        if (typeof content?.mediaUrl === 'string') {
          const match = content.mediaUrl.match(/\/api\/media\/([^/?#]+)/)
          if (match) referencedFiles.add(match[1])
        }
      }

      // Find orphaned files (in storage but not referenced by any post)
      const orphans = storageFiles.filter((f) => !referencedFiles.has(f.name))

      if (orphans.length === 0) continue

      // Delete orphans
      const orphanPaths = orphans.map((f) => `${user.id}/${f.name}`)
      const orphanBytes = orphans.reduce((sum, f) => sum + (f.metadata?.size ?? 0), 0)

      const { error: removeError } = await supabase.storage.from('media').remove(orphanPaths)

      if (removeError) {
        console.error(`[cleanup-media] Failed to remove orphans for ${user.id}:`, removeError)
        continue
      }

      // Decrement storage counter
      if (orphanBytes > 0) {
        await supabase.rpc('decrement_storage_used', {
          user_id_param: user.id,
          bytes_param: orphanBytes,
        })
      }

      orphansRemoved += orphans.length
      bytesReclaimed += orphanBytes
      usersProcessed++
    }

    console.log(
      `[cleanup-media] Processed ${usersProcessed} users, removed ${orphansRemoved} orphans, reclaimed ${bytesReclaimed} bytes`
    )
    return NextResponse.json({ usersProcessed, orphansRemoved, bytesReclaimed })
  } catch (err) {
    console.error('[cleanup-media] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
