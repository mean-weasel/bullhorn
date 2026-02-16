import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { z } from 'zod'

const importPostSchema = z.object({
  platform: z.enum(['twitter', 'linkedin', 'reddit']),
  content: z.record(z.string(), z.unknown()),
  status: z.enum(['draft', 'scheduled', 'published', 'failed', 'archived']).optional(),
  scheduledAt: z.string().nullable().optional(),
  notes: z.string().optional().nullable(),
  campaignId: z.string().uuid().optional().nullable(),
})

const importCampaignSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional().nullable(),
  status: z.enum(['draft', 'active', 'completed', 'archived']).optional(),
  projectId: z.string().uuid().optional().nullable(),
})

const importSchema = z.object({
  posts: z.array(importPostSchema).optional().default([]),
  campaigns: z.array(importCampaignSchema).optional().default([]),
  version: z.string().optional(),
})

export async function POST(request: NextRequest) {
  try {
    let userId: string
    try {
      const auth = await requireAuth()
      userId = auth.userId
    } catch {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = await createClient()
    const body = await request.json()
    const parsed = importSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid import data', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { posts: importPosts, campaigns: importCampaigns } = parsed.data

    let postsImported = 0
    let postsSkipped = 0
    let campaignsImported = 0
    let campaignsSkipped = 0

    // Import campaigns first (posts may reference them)
    for (const campaign of importCampaigns) {
      // Check for duplicate by name + user
      const { data: existing } = await supabase
        .from('campaigns')
        .select('id')
        .eq('user_id', userId)
        .eq('name', campaign.name)
        .limit(1)

      if (existing && existing.length > 0) {
        campaignsSkipped++
        continue
      }

      const { error } = await supabase.from('campaigns').insert({
        user_id: userId,
        name: campaign.name,
        description: campaign.description || null,
        status: campaign.status || 'active',
        project_id: campaign.projectId || null,
      })

      if (error) {
        console.error('Error importing campaign:', error)
        campaignsSkipped++
      } else {
        campaignsImported++
      }
    }

    // Import posts
    for (const post of importPosts) {
      // Check for duplicate by content + platform + scheduledAt
      const contentStr = JSON.stringify(post.content)
      const { data: existingPosts } = await supabase
        .from('posts')
        .select('id, content')
        .eq('user_id', userId)
        .eq('platform', post.platform)

      const isDuplicate = (existingPosts || []).some(
        (existing) =>
          JSON.stringify(existing.content) === contentStr &&
          (!post.scheduledAt || post.scheduledAt === null)
      )

      if (isDuplicate) {
        postsSkipped++
        continue
      }

      const { error } = await supabase.from('posts').insert({
        user_id: userId,
        platform: post.platform,
        content: post.content,
        status: post.status || 'draft',
        scheduled_at: post.scheduledAt || null,
        notes: post.notes || null,
        campaign_id: post.campaignId || null,
      })

      if (error) {
        console.error('Error importing post:', error)
        postsSkipped++
      } else {
        postsImported++
      }
    }

    return NextResponse.json({
      imported: { posts: postsImported, campaigns: campaignsImported },
      skipped: { posts: postsSkipped, campaigns: campaignsSkipped },
    })
  } catch (error) {
    console.error('Error importing data:', error)
    return NextResponse.json({ error: 'Failed to import data' }, { status: 500 })
  }
}
