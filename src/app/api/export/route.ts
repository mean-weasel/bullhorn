import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import {
  transformPostFromDb,
  transformCampaignFromDb,
  type DbPost,
  type DbCampaign,
} from '@/lib/utils'
import { requireAuth } from '@/lib/auth'
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

export async function GET(request: NextRequest) {
  try {
    let userId: string
    try {
      const auth = await requireAuth()
      userId = auth.userId
    } catch {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = await createClient()
    const { searchParams } = new URL(request.url)

    const format = searchParams.get('format') || 'json'
    const type = searchParams.get('type') || 'all'
    const status = searchParams.get('status')
    const projectId = searchParams.get('projectId')
    const campaignId = searchParams.get('campaignId')

    if (!['json', 'csv'].includes(format)) {
      return NextResponse.json({ error: 'Invalid format. Use json or csv.' }, { status: 400 })
    }

    if (!['posts', 'campaigns', 'all'].includes(type)) {
      return NextResponse.json(
        { error: 'Invalid type. Use posts, campaigns, or all.' },
        { status: 400 }
      )
    }

    let posts: Post[] = []
    let campaigns: Campaign[] = []

    // Fetch posts
    if (type === 'posts' || type === 'all') {
      let query = supabase
        .from('posts')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (status) {
        query = query.eq('status', status)
      }
      if (campaignId) {
        query = query.eq('campaign_id', campaignId)
      }

      const { data, error } = await query
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      posts = (data || []).map((p) => transformPostFromDb(p as DbPost))
    }

    // Fetch campaigns
    if (type === 'campaigns' || type === 'all') {
      let query = supabase
        .from('campaigns')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (status) {
        query = query.eq('status', status)
      }
      if (projectId) {
        query = query.eq('project_id', projectId)
      }

      const { data, error } = await query
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      campaigns = (data || []).map((c) => transformCampaignFromDb(c as DbCampaign))
    }

    const totalCount = posts.length + campaigns.length

    // CSV format
    if (format === 'csv') {
      let csv = ''
      if (type === 'posts' || type === 'all') {
        csv += '# Posts\n' + postsToCsv(posts)
      }
      if (type === 'all') {
        csv += '\n\n'
      }
      if (type === 'campaigns' || type === 'all') {
        csv += '# Campaigns\n' + campaignsToCsv(campaigns)
      }

      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="bullhorn-export-${new Date().toISOString().slice(0, 10)}.csv"`,
          'X-Export-Count': String(totalCount),
        },
      })
    }

    // JSON format
    const body = {
      posts,
      campaigns,
      exportedAt: new Date().toISOString(),
      version: '1.0',
    }

    return NextResponse.json(body, {
      headers: {
        'X-Export-Count': String(totalCount),
      },
    })
  } catch (error) {
    console.error('Error exporting data:', error)
    return NextResponse.json({ error: 'Failed to export data' }, { status: 500 })
  }
}
