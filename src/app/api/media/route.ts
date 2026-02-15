import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const { userId } = await requireAuth()

    const supabase = await createClient()

    const { data: files, error } = await supabase.storage.from('media').list(userId)

    if (error) {
      console.error('Supabase storage list error:', error)
      return NextResponse.json({ error: 'Failed to list files' }, { status: 500 })
    }

    const result = (files || [])
      .filter((f) => f.name !== '.emptyFolderPlaceholder')
      .map((f) => ({
        filename: f.name,
        url: `/api/media/${f.name}`,
        size: f.metadata?.size ?? null,
        mimetype: f.metadata?.mimetype ?? null,
        createdAt: f.created_at,
      }))

    return NextResponse.json({ files: result })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Error listing media:', error)
    return NextResponse.json({ error: 'Failed to list files' }, { status: 500 })
  }
}
