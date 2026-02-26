import { createClient as createSupabaseJsClient } from '@supabase/supabase-js'
import * as Sentry from '@sentry/nextjs'
import { headers } from 'next/headers'
import { createClient } from './supabase/server'

/**
 * Check if we're running in test mode.
 * IMPORTANT: Test mode is only allowed when NODE_ENV is NOT 'production'.
 * This prevents accidental RLS bypass in production environments.
 */
export function isTestMode(): boolean {
  // Safety check: Never allow test mode in production
  if (process.env.NODE_ENV === 'production') {
    return false
  }
  return process.env.E2E_TEST_MODE === 'true'
}

/**
 * Check if the current request is authenticated via API key (Bearer bh_*).
 * Reads the Authorization header from the incoming request.
 */
export async function getApiKeyFromHeaders(): Promise<string | null> {
  try {
    const hdrs = await headers()
    const auth = hdrs.get('authorization')
    if (auth && auth.startsWith('Bearer bh_')) {
      return auth.slice('Bearer '.length)
    }
  } catch {
    // headers() can throw in some contexts (e.g. static generation)
  }
  return null
}

/**
 * Available API key scopes.
 * - posts:read / posts:write — Read/create/update/delete posts
 * - campaigns:read / campaigns:write — Read/create/update/delete campaigns
 * - projects:read / projects:write — Read/create/update/delete projects
 * - blog:read / blog:write — Read/create/update/delete blog drafts
 * - launches:read / launches:write — Read/create/update/delete launch posts
 * - media:write — Upload media files
 * - analytics:read — Read analytics data
 */
export type ApiKeyScope =
  | 'posts:read'
  | 'posts:write'
  | 'campaigns:read'
  | 'campaigns:write'
  | 'projects:read'
  | 'projects:write'
  | 'blog:read'
  | 'blog:write'
  | 'launches:read'
  | 'launches:write'
  | 'media:write'
  | 'analytics:read'

/** All available scopes — used as the default when creating new API keys. */
export const ALL_SCOPES: ApiKeyScope[] = [
  'posts:read',
  'posts:write',
  'campaigns:read',
  'campaigns:write',
  'projects:read',
  'projects:write',
  'blog:read',
  'blog:write',
  'launches:read',
  'launches:write',
  'media:write',
  'analytics:read',
]

/**
 * Resolve a raw API key to a user ID and its granted scopes.
 * Validates the key format, looks up the hash, checks expiry/revocation,
 * and updates last_used_at.
 */
export async function resolveApiKey(rawKey: string): Promise<{ userId: string; scopes: string[] }> {
  if (!rawKey.startsWith('bh_') || rawKey.length < 20) {
    throw new Error('Unauthorized')
  }

  // SHA-256 hash the raw key
  const encoder = new TextEncoder()
  const data = encoder.encode(rawKey)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const keyHash = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')

  // Look up key via service role client (no session exists for API key requests)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) {
    throw new Error('Unauthorized')
  }

  const serviceClient = createSupabaseJsClient(supabaseUrl, serviceKey, {
    global: {
      fetch: (url: string | URL | Request, options?: RequestInit) =>
        fetch(url, { ...options, cache: 'no-store' }),
    },
  })

  const { data: apiKey, error } = await serviceClient
    .from('api_keys')
    .select('id, user_id, expires_at, revoked_at, scopes')
    .eq('key_hash', keyHash)
    .single()

  if (error || !apiKey) {
    throw new Error('Unauthorized')
  }

  // Check revocation
  if (apiKey.revoked_at) {
    throw new Error('Unauthorized')
  }

  // Check expiration
  if (apiKey.expires_at && new Date(apiKey.expires_at) < new Date()) {
    throw new Error('Unauthorized')
  }

  // Update last_used_at for audit trail
  await serviceClient
    .from('api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', apiKey.id)

  return { userId: apiKey.user_id, scopes: (apiKey.scopes as string[]) || [] }
}

/**
 * Validate that the given scopes include all required scopes.
 * Throws an error with message 'Forbidden' if any required scope is missing.
 *
 * @param userScopes - Scopes granted to the API key
 * @param required - Scopes required by the route
 * @throws Error with message 'Forbidden' if scopes are insufficient
 */
export function validateScopes(userScopes: string[], required: string[]): void {
  for (const scope of required) {
    if (!userScopes.includes(scope)) {
      throw new Error('Forbidden')
    }
  }
}

/**
 * Require authentication for API routes.
 * Returns the authenticated user's ID or throws a 401-style error.
 *
 * Supports two auth methods:
 * 1. Bearer bh_* API key in Authorization header
 * 2. Supabase session cookie (standard browser auth)
 *
 * In test mode (non-production only), returns a test user ID.
 *
 * @throws Error with message 'Unauthorized' if not authenticated
 */
// Valid UUID for test user (used in E2E tests)
const TEST_USER_ID = '00000000-0000-0000-0000-000000000001'

export async function requireAuth(): Promise<{ userId: string; scopes?: string[] }> {
  // In test mode (non-production only), use a consistent test user ID
  if (isTestMode()) {
    return { userId: TEST_USER_ID }
  }

  // Check for API key auth first
  const apiKey = await getApiKeyFromHeaders()
  if (apiKey) {
    const resolved = await resolveApiKey(apiKey)
    Sentry.setUser({ id: resolved.userId })
    return resolved
  }

  // Fall through to cookie-based session auth
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    throw new Error('Unauthorized')
  }

  Sentry.setUser({ id: user.id })
  return { userId: user.id }
}

/**
 * Helper to get user ID or null (for optional auth scenarios).
 * Useful for routes that can work with or without authentication.
 */
export async function getOptionalAuth(): Promise<{ userId: string | null }> {
  if (isTestMode()) {
    return { userId: TEST_USER_ID }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return { userId: user?.id || null }
}

/**
 * Validate that a user owns a specific project.
 * Returns the project if found and owned by user, throws error otherwise.
 *
 * @param projectId - The project ID to check
 * @param userId - The user ID that should own the project
 * @throws Error with 'Project not found' if project doesn't exist or isn't owned
 */
export async function validateProjectOwnership(
  projectId: string,
  userId: string
): Promise<{ id: string; name: string }> {
  const supabase = await createClient()

  const { data: project, error } = await supabase
    .from('projects')
    .select('id, name')
    .eq('id', projectId)
    .eq('user_id', userId)
    .single()

  if (error || !project) {
    throw new Error('Project not found')
  }

  return project
}

/**
 * Validate that a user owns a specific campaign.
 * Returns the campaign if found and owned by user, throws error otherwise.
 *
 * @param campaignId - The campaign ID to check
 * @param userId - The user ID that should own the campaign
 * @throws Error with 'Campaign not found' if campaign doesn't exist or isn't owned
 */
export async function validateCampaignOwnership(
  campaignId: string,
  userId: string
): Promise<{ id: string; name: string; projectId: string | null }> {
  const supabase = await createClient()

  const { data: campaign, error } = await supabase
    .from('campaigns')
    .select('id, name, project_id')
    .eq('id', campaignId)
    .eq('user_id', userId)
    .single()

  if (error || !campaign) {
    throw new Error('Campaign not found')
  }

  return {
    id: campaign.id,
    name: campaign.name,
    projectId: campaign.project_id,
  }
}

/**
 * Validate that a user owns a specific post.
 * Returns the post if found and owned by user, throws error otherwise.
 *
 * @param postId - The post ID to check
 * @param userId - The user ID that should own the post
 * @throws Error with 'Post not found' if post doesn't exist or isn't owned
 */
export async function validatePostOwnership(
  postId: string,
  userId: string
): Promise<{ id: string; campaignId: string | null }> {
  const supabase = await createClient()

  const { data: post, error } = await supabase
    .from('posts')
    .select('id, campaign_id')
    .eq('id', postId)
    .eq('user_id', userId)
    .single()

  if (error || !post) {
    throw new Error('Post not found')
  }

  return {
    id: post.id,
    campaignId: post.campaign_id,
  }
}

/**
 * Validate that a user owns a specific blog draft.
 * Returns the blog draft if found and owned by user, throws error otherwise.
 *
 * @param draftId - The blog draft ID to check
 * @param userId - The user ID that should own the draft
 * @throws Error with 'Blog draft not found' if draft doesn't exist or isn't owned
 */
export async function validateBlogDraftOwnership(
  draftId: string,
  userId: string
): Promise<{ id: string; title: string }> {
  const supabase = await createClient()

  const { data: draft, error } = await supabase
    .from('blog_drafts')
    .select('id, title')
    .eq('id', draftId)
    .eq('user_id', userId)
    .single()

  if (error || !draft) {
    throw new Error('Blog draft not found')
  }

  return {
    id: draft.id,
    title: draft.title,
  }
}
