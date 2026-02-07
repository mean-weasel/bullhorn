import { requireAuth } from '@/lib/auth'
import { createClient as createSupabaseJsClient } from '@supabase/supabase-js'
import { randomBytes, createHash } from 'crypto'

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing Supabase config')
  return createSupabaseJsClient(url, key)
}

function transformKeyFromDb(row: {
  id: string
  name: string
  key_prefix: string
  scopes: string[]
  expires_at: string | null
  last_used_at: string | null
  revoked_at: string | null
  created_at: string
  updated_at: string
}) {
  return {
    id: row.id,
    name: row.name,
    keyPrefix: row.key_prefix,
    scopes: row.scopes,
    expiresAt: row.expires_at,
    lastUsedAt: row.last_used_at,
    revokedAt: row.revoked_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function GET() {
  try {
    const { userId } = await requireAuth()
    const supabase = getServiceClient()

    const { data, error } = await supabase
      .from('api_keys')
      .select(
        'id, name, key_prefix, scopes, expires_at, last_used_at, revoked_at, created_at, updated_at'
      )
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) throw error

    return Response.json({ apiKeys: (data || []).map(transformKeyFromDb) })
  } catch (error) {
    if ((error as Error).message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const { userId } = await requireAuth()
    const body = await request.json()

    const { name, expiresAt, scopes } = body as {
      name?: string
      expiresAt?: string
      scopes?: string[]
    }

    if (!name || name.trim() === '') {
      return Response.json({ error: 'Name is required' }, { status: 400 })
    }

    // Generate raw key: bh_ + 40 hex chars (20 random bytes = 160 bits)
    const rawKey = `bh_${randomBytes(20).toString('hex')}`
    const keyPrefix = rawKey.slice(0, 12)

    // SHA-256 hash for storage
    const keyHash = createHash('sha256').update(rawKey).digest('hex')

    const supabase = getServiceClient()

    const { data, error } = await supabase
      .from('api_keys')
      .insert({
        user_id: userId,
        name: name.trim(),
        key_hash: keyHash,
        key_prefix: keyPrefix,
        scopes: scopes || [],
        expires_at: expiresAt || null,
      })
      .select(
        'id, name, key_prefix, scopes, expires_at, last_used_at, revoked_at, created_at, updated_at'
      )
      .single()

    if (error) throw error

    // Return the raw key exactly once — it is never stored or retrievable again
    return Response.json(
      {
        apiKey: {
          ...transformKeyFromDb(data),
          rawKey,
        },
      },
      { status: 201 }
    )
  } catch (error) {
    if ((error as Error).message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
