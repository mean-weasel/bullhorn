import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, parseJsonBody, validateScopes } from '@/lib/auth'
import { rateLimit } from '@/lib/rateLimit'
import { enforceResourceLimit } from '@/lib/planEnforcement'
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
  posts: z.array(importPostSchema).max(500).optional().default([]),
  campaigns: z.array(importCampaignSchema).max(100).optional().default([]),
  version: z.string().optional(),
})

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    let userId: string
    try {
      const auth = await requireAuth()
      userId = auth.userId
      if (auth.scopes) {
        validateScopes(auth.scopes, ['posts:write', 'campaigns:write'])
      }
    } catch (authError) {
      const msg = (authError as Error).message
      if (msg === 'Forbidden') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const rateLimitResult = await rateLimit(`import:${userId}`)
    if (!rateLimitResult.success) {
      return NextResponse.json({ error: 'Too many import requests' }, { status: 429 })
    }

    const supabase = await createClient()
    const jsonResult = await parseJsonBody(request)
    if ('error' in jsonResult) return jsonResult.error
    const body = jsonResult.data
    const parsed = importSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid import data', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { posts: importPosts, campaigns: importCampaigns } = parsed.data

    // Enforce plan limits for posts
    if (importPosts.length > 0) {
      const postsCheck = await enforceResourceLimit(userId, 'posts')
      if (!postsCheck.allowed) {
        return NextResponse.json(
          {
            error: `Plan limit reached. You have ${postsCheck.current}/${postsCheck.limit} posts on the ${postsCheck.plan} plan.`,
          },
          { status: 403 }
        )
      }
      // Check if import would exceed limit
      if (postsCheck.current + importPosts.length > postsCheck.limit) {
        return NextResponse.json(
          {
            error: `Import would exceed plan limit. You have ${postsCheck.current}/${postsCheck.limit} posts. Trying to import ${importPosts.length}.`,
          },
          { status: 403 }
        )
      }
    }

    // Enforce plan limits for campaigns
    if (importCampaigns.length > 0) {
      const campaignsCheck = await enforceResourceLimit(userId, 'campaigns')
      if (!campaignsCheck.allowed) {
        return NextResponse.json(
          {
            error: `Plan limit reached. You have ${campaignsCheck.current}/${campaignsCheck.limit} campaigns on the ${campaignsCheck.plan} plan.`,
          },
          { status: 403 }
        )
      }
      if (campaignsCheck.current + importCampaigns.length > campaignsCheck.limit) {
        return NextResponse.json(
          {
            error: `Import would exceed plan limit. You have ${campaignsCheck.current}/${campaignsCheck.limit} campaigns. Trying to import ${importCampaigns.length}.`,
          },
          { status: 403 }
        )
      }
    }

    let campaignsImported = 0
    let campaignsSkipped = 0
    let postsImported = 0
    let postsSkipped = 0

    // --- Batch import campaigns ---
    if (importCampaigns.length > 0) {
      // One query: fetch all existing campaign names for this user
      const { data: existingCampaigns } = await supabase
        .from('campaigns')
        .select('name')
        .eq('user_id', userId)

      const existingCampaignNames = new Set(
        (existingCampaigns || []).map((c: { name: string }) => c.name)
      )

      // Also deduplicate within the import batch itself (first occurrence wins)
      const seenInBatch = new Set<string>()
      const campaignsToInsert: Array<{
        user_id: string
        name: string
        description: string | null
        status: string
        project_id: string | null
      }> = []

      for (const campaign of importCampaigns) {
        if (existingCampaignNames.has(campaign.name) || seenInBatch.has(campaign.name)) {
          campaignsSkipped++
          continue
        }
        seenInBatch.add(campaign.name)
        campaignsToInsert.push({
          user_id: userId,
          name: campaign.name,
          description: campaign.description || null,
          status: campaign.status || 'active',
          project_id: campaign.projectId || null,
        })
      }

      if (campaignsToInsert.length > 0) {
        const { error } = await supabase.from('campaigns').insert(campaignsToInsert)
        if (error) {
          console.error('Error importing campaigns:', error)
          campaignsSkipped += campaignsToInsert.length
        } else {
          campaignsImported = campaignsToInsert.length
        }
      }
    }

    // --- Batch import posts ---
    if (importPosts.length > 0) {
      // One query: fetch all existing posts (content + platform) for this user
      const { data: existingPosts } = await supabase
        .from('posts')
        .select('content, platform')
        .eq('user_id', userId)

      // Build a Set of fingerprints for fast duplicate lookup
      const existingPostFingerprints = new Set(
        (existingPosts || []).map(
          (p: { content: Record<string, unknown>; platform: string }) =>
            `${p.platform}::${JSON.stringify(p.content)}`
        )
      )

      // Also deduplicate within the import batch itself
      const seenInBatch = new Set<string>()
      const postsToInsert: Array<{
        user_id: string
        platform: string
        content: Record<string, unknown>
        status: string
        scheduled_at: string | null
        notes: string | null
        campaign_id: string | null
      }> = []

      for (const post of importPosts) {
        const contentStr = JSON.stringify(post.content)

        // Skip oversized content (50 KB max per post)
        if (contentStr.length > 50_000) {
          postsSkipped++
          continue
        }

        const fingerprint = `${post.platform}::${contentStr}`

        // Preserve original duplicate logic: skip if content matches AND no scheduledAt
        const isDuplicate =
          (existingPostFingerprints.has(fingerprint) || seenInBatch.has(fingerprint)) &&
          (!post.scheduledAt || post.scheduledAt === null)

        if (isDuplicate) {
          postsSkipped++
          continue
        }

        seenInBatch.add(fingerprint)
        postsToInsert.push({
          user_id: userId,
          platform: post.platform,
          content: post.content,
          status: post.status || 'draft',
          scheduled_at: post.scheduledAt || null,
          notes: post.notes || null,
          campaign_id: post.campaignId || null,
        })
      }

      if (postsToInsert.length > 0) {
        const { error } = await supabase.from('posts').insert(postsToInsert)
        if (error) {
          console.error('Error importing posts:', error)
          postsSkipped += postsToInsert.length
        } else {
          postsImported = postsToInsert.length
        }
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
