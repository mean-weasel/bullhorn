import { requireSessionAuth, ALL_SCOPES, parseJsonBody, hashApiKey } from '@/lib/auth'
import { createClient as createSupabaseJsClient } from '@supabase/supabase-js'
import { getUserPlan, isPlanLimitError } from '@/lib/planEnforcement'
import { PLAN_LIMITS } from '@/lib/limits'
import { randomBytes } from 'crypto'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const createApiKeySchema = z.object({
  name: z.string().min(1).max(200),
  expiresAt: z.string().optional().nullable(),
  scopes: z.array(z.string()).optional(),
})

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
    const { userId } = await requireSessionAuth()
    const supabase = getServiceClient()

    const { data, error } = await supabase
      .from('api_keys')
      .select(
        'id, name, key_prefix, scopes, expires_at, last_used_at, revoked_at, created_at, updated_at'
      )
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(100)

    if (error) throw error

    return Response.json({ apiKeys: (data || []).map(transformKeyFromDb) })
  } catch (error) {
    if ((error as Error).message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// eslint-disable-next-line max-lines-per-function -- API handler requires auth+db in single try/catch
export async function POST(request: Request) {
  try {
    const { userId } = await requireSessionAuth()
    const jsonResult = await parseJsonBody(request)
    if ('error' in jsonResult) return jsonResult.error
    const body = jsonResult.data
    const parsed = createApiKeySchema.safeParse(body)
    if (!parsed.success) {
      return Response.json(
        { error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    // Enforce API key limit (count only non-revoked keys)
    const plan = await getUserPlan(userId)
    const limit = PLAN_LIMITS[plan].apiKeys
    const supabase = getServiceClient()
    const { count } = await supabase
      .from('api_keys')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .is('revoked_at', null)
    const current = count || 0
    if (current >= limit) {
      return Response.json(
        { error: 'API key limit reached', limit, current, plan },
        { status: 403 }
      )
    }

    // Generate raw key: bh_ + 40 hex chars (20 random bytes = 160 bits)
    const rawKey = `bh_${randomBytes(20).toString('hex')}`
    const keyPrefix = rawKey.slice(0, 12)

    // HMAC-SHA256 hash for storage (falls back to SHA-256 if secret not set)
    const keyHash = hashApiKey(rawKey)

    const { data, error } = await supabase
      .from('api_keys')
      .insert({
        user_id: userId,
        name: parsed.data.name.trim(),
        key_hash: keyHash,
        key_prefix: keyPrefix,
        scopes: parsed.data.scopes || ALL_SCOPES,
        expires_at: parsed.data.expiresAt || null,
      })
      .select(
        'id, name, key_prefix, scopes, expires_at, last_used_at, revoked_at, created_at, updated_at'
      )
      .single()

    if (error) {
      if (isPlanLimitError(error)) {
        return Response.json({ error: 'API key limit reached' }, { status: 403 })
      }
      throw error
    }

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
