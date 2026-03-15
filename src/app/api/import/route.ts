import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, parseJsonBody, validateScopes } from '@/lib/auth'
import { rateLimit } from '@/lib/rateLimit'
import { enforceResourceLimit, isPlanLimitError } from '@/lib/planEnforcement'
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

type ImportCampaign = z.infer<typeof importCampaignSchema>
type ImportPost = z.infer<typeof importPostSchema>

export const dynamic = 'force-dynamic'

async function checkImportLimits(
  userId: string,
  importPosts: ImportPost[],
  importCampaigns: ImportCampaign[]
): Promise<NextResponse | null> {
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
    if (postsCheck.current + importPosts.length > postsCheck.limit) {
      return NextResponse.json(
        {
          error: `Import would exceed plan limit. You have ${postsCheck.current}/${postsCheck.limit} posts. Trying to import ${importPosts.length}.`,
        },
        { status: 403 }
      )
    }
  }

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

  return null
}

function buildCampaignInserts(
  importCampaigns: ImportCampaign[],
  existingNames: Set<string>,
  userId: string
) {
  let skipped = 0
  const seenInBatch = new Set<string>()
  const toInsert: Array<{
    user_id: string
    name: string
    description: string | null
    status: string
    project_id: string | null
  }> = []

  for (const campaign of importCampaigns) {
    if (existingNames.has(campaign.name) || seenInBatch.has(campaign.name)) {
      skipped++
      continue
    }
    seenInBatch.add(campaign.name)
    toInsert.push({
      user_id: userId,
      name: campaign.name,
      description: campaign.description || null,
      status: campaign.status || 'active',
      project_id: campaign.projectId || null,
    })
  }

  return { toInsert, skipped }
}

function buildPostInserts(
  importPosts: ImportPost[],
  existingFingerprints: Set<string>,
  userId: string
) {
  let skipped = 0
  const seenInBatch = new Set<string>()
  const toInsert: Array<{
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
    if (contentStr.length > 50_000) {
      skipped++
      continue
    }

    const fingerprint = `${post.platform}::${contentStr}`
    const isDuplicate =
      (existingFingerprints.has(fingerprint) || seenInBatch.has(fingerprint)) &&
      (!post.scheduledAt || post.scheduledAt === null)

    if (isDuplicate) {
      skipped++
      continue
    }

    seenInBatch.add(fingerprint)
    toInsert.push({
      user_id: userId,
      platform: post.platform,
      content: post.content,
      status: post.status || 'draft',
      scheduled_at: post.scheduledAt || null,
      notes: post.notes || null,
      campaign_id: post.campaignId || null,
    })
  }

  return { toInsert, skipped }
}

async function importCampaignBatch(
  supabase: Awaited<ReturnType<typeof createClient>>,
  importCampaigns: ImportCampaign[],
  userId: string
) {
  const { data: existingCampaigns } = await supabase
    .from('campaigns')
    .select('name')
    .eq('user_id', userId)

  const existingNames = new Set((existingCampaigns || []).map((c: { name: string }) => c.name))
  const { toInsert, skipped } = buildCampaignInserts(importCampaigns, existingNames, userId)

  if (toInsert.length === 0) return { imported: 0, skipped }

  const { error } = await supabase.from('campaigns').insert(toInsert)
  if (error) {
    if (isPlanLimitError(error)) return { error: 'Campaign limit reached during import' }
    console.error('Error importing campaigns:', error)
    return { imported: 0, skipped: skipped + toInsert.length }
  }
  return { imported: toInsert.length, skipped }
}

async function importPostBatch(
  supabase: Awaited<ReturnType<typeof createClient>>,
  importPosts: ImportPost[],
  userId: string
) {
  const { data: existingPosts } = await supabase
    .from('posts')
    .select('content, platform')
    .eq('user_id', userId)

  const existingFingerprints = new Set(
    (existingPosts || []).map(
      (p: { content: Record<string, unknown>; platform: string }) =>
        `${p.platform}::${JSON.stringify(p.content)}`
    )
  )
  const { toInsert, skipped } = buildPostInserts(importPosts, existingFingerprints, userId)

  if (toInsert.length === 0) return { imported: 0, skipped }

  const { error } = await supabase.from('posts').insert(toInsert)
  if (error) {
    if (isPlanLimitError(error)) return { error: 'Post limit reached during import' }
    console.error('Error importing posts:', error)
    return { imported: 0, skipped: skipped + toInsert.length }
  }
  return { imported: toInsert.length, skipped }
}

export async function POST(request: NextRequest) {
  try {
    let userId: string
    try {
      const auth = await requireAuth()
      userId = auth.userId
      if (auth.scopes) validateScopes(auth.scopes, ['posts:write', 'campaigns:write'])
    } catch (authError) {
      const msg = (authError as Error).message
      if (msg === 'Forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const rateLimitResult = await rateLimit(`import:${userId}`)
    if (!rateLimitResult.success) {
      return NextResponse.json({ error: 'Too many import requests' }, { status: 429 })
    }

    const supabase = await createClient()
    const jsonResult = await parseJsonBody(request)
    if ('error' in jsonResult) return jsonResult.error
    const parsed = importSchema.safeParse(jsonResult.data)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid import data', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { posts: importPosts, campaigns: importCampaigns } = parsed.data

    const limitError = await checkImportLimits(userId, importPosts, importCampaigns)
    if (limitError) return limitError

    const campaignResult =
      importCampaigns.length > 0
        ? await importCampaignBatch(supabase, importCampaigns, userId)
        : { imported: 0, skipped: 0 }
    if ('error' in campaignResult) {
      return NextResponse.json({ error: campaignResult.error }, { status: 403 })
    }

    const postResult =
      importPosts.length > 0
        ? await importPostBatch(supabase, importPosts, userId)
        : { imported: 0, skipped: 0 }
    if ('error' in postResult) {
      return NextResponse.json({ error: postResult.error }, { status: 403 })
    }

    return NextResponse.json({
      imported: { posts: postResult.imported, campaigns: campaignResult.imported },
      skipped: { posts: postResult.skipped, campaigns: campaignResult.skipped },
    })
  } catch (error) {
    console.error('Error importing data:', error)
    return NextResponse.json({ error: 'Failed to import data' }, { status: 500 })
  }
}
