import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import {
  transformPostFromDb,
  transformCampaignFromDb,
  type DbPost,
  type DbCampaign,
} from '@/lib/utils'
import { requireAuth, validateScopes } from '@/lib/auth'
import { rateLimit } from '@/lib/rateLimit'
import type { Post, Campaign } from '@/lib/posts'

export const dynamic = 'force-dynamic'

function getPostText(post: Post): string {
  const c = post.content
  if ('subreddit' in c) return c.body || c.title
  if ('text' in c) return c.text
  return ''
}

function postsToCsv(posts: Post[]): string {
  const header = 'id,title,content,platform,status,scheduledAt,campaignId,projectId,createdAt'
  const rows = posts.map((p) => {
    const text = getPostText(p)
    const title = 'title' in p.content ? (p.content as { title?: string }).title || '' : ''
    return [
      p.id,
      csvEscape(title),
      csvEscape(text),
      p.platform,
      p.status,
      p.scheduledAt || '',
      p.campaignId || '',
      '',
      p.createdAt,
    ].join(',')
  })
  return [header, ...rows].join('\n')
}

function campaignsToCsv(campaigns: Campaign[]): string {
  const header = 'id,name,description,status,projectId,createdAt'
  const rows = campaigns.map((c) =>
    [
      c.id,
      csvEscape(c.name),
      csvEscape(c.description || ''),
      c.status,
      c.projectId || '',
      c.createdAt,
    ].join(',')
  )
  return [header, ...rows].join('\n')
}

function csvEscape(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

interface ExportFilters {
  status: string | null
  projectId: string | null
  campaignId: string | null
}

async function fetchExportData(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  type: string,
  filters: ExportFilters
) {
  const buildPostsQuery = () => {
    let query = supabase
      .from('posts')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    if (filters.status) query = query.eq('status', filters.status)
    if (filters.campaignId) query = query.eq('campaign_id', filters.campaignId)
    return query
  }

  const buildCampaignsQuery = () => {
    let query = supabase
      .from('campaigns')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    if (filters.status) query = query.eq('status', filters.status)
    if (filters.projectId) query = query.eq('project_id', filters.projectId)
    return query
  }

  let posts: Post[] = []
  let campaigns: Campaign[] = []

  if (type === 'all') {
    const [postsResult, campaignsResult] = await Promise.all([
      buildPostsQuery(),
      buildCampaignsQuery(),
    ])
    if (postsResult.error) throw postsResult.error
    if (campaignsResult.error) throw campaignsResult.error
    posts = (postsResult.data || []).map((p) => transformPostFromDb(p as DbPost))
    campaigns = (campaignsResult.data || []).map((c) => transformCampaignFromDb(c as DbCampaign))
  } else if (type === 'posts') {
    const { data, error } = await buildPostsQuery()
    if (error) throw error
    posts = (data || []).map((p) => transformPostFromDb(p as DbPost))
  } else if (type === 'campaigns') {
    const { data, error } = await buildCampaignsQuery()
    if (error) throw error
    campaigns = (data || []).map((c) => transformCampaignFromDb(c as DbCampaign))
  }

  return { posts, campaigns }
}

function buildCsvResponse(type: string, posts: Post[], campaigns: Campaign[]) {
  let csv = ''
  if (type === 'posts' || type === 'all') csv += '# Posts\n' + postsToCsv(posts)
  if (type === 'all') csv += '\n\n'
  if (type === 'campaigns' || type === 'all') csv += '# Campaigns\n' + campaignsToCsv(campaigns)
  const totalCount = posts.length + campaigns.length
  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="bullhorn-export-${new Date().toISOString().slice(0, 10)}.csv"`,
      'X-Export-Count': String(totalCount),
    },
  })
}

export async function GET(request: NextRequest) {
  try {
    let userId: string
    try {
      const auth = await requireAuth()
      userId = auth.userId
      if (auth.scopes) {
        validateScopes(auth.scopes, ['posts:read'])
      }
    } catch (authError) {
      const msg = (authError as Error).message
      if (msg === 'Forbidden') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const rateLimitResult = await rateLimit(`export:${userId}`)
    if (!rateLimitResult.success) {
      return NextResponse.json({ error: 'Too many export requests' }, { status: 429 })
    }

    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const format = searchParams.get('format') || 'json'
    const type = searchParams.get('type') || 'all'

    if (!['json', 'csv'].includes(format)) {
      return NextResponse.json({ error: 'Invalid format. Use json or csv.' }, { status: 400 })
    }
    if (!['posts', 'campaigns', 'all'].includes(type)) {
      return NextResponse.json(
        { error: 'Invalid type. Use posts, campaigns, or all.' },
        { status: 400 }
      )
    }

    const filters: ExportFilters = {
      status: searchParams.get('status'),
      projectId: searchParams.get('projectId'),
      campaignId: searchParams.get('campaignId'),
    }

    const { posts, campaigns } = await fetchExportData(supabase, userId, type, filters)

    if (format === 'csv') return buildCsvResponse(type, posts, campaigns)

    return NextResponse.json(
      { posts, campaigns, exportedAt: new Date().toISOString(), version: '1.0' },
      { headers: { 'X-Export-Count': String(posts.length + campaigns.length) } }
    )
  } catch (error) {
    console.error('Error exporting data:', error)
    return NextResponse.json({ error: 'Failed to export data' }, { status: 500 })
  }
}
