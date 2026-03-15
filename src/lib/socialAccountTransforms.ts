// ---------------------------------------------------------------------------
// Social account types & transforms
// ---------------------------------------------------------------------------

export type SocialProvider = 'twitter' | 'linkedin' | 'reddit'
export type SocialAccountStatus = 'active' | 'expired' | 'revoked' | 'error'

/** Frontend shape of a social account (camelCase, no tokens) */
export interface SocialAccount {
  id: string
  userId: string
  provider: SocialProvider
  providerAccountId: string
  username: string | null
  displayName: string | null
  avatarUrl: string | null
  scopes: string[]
  connectedAt: string
  lastUsedAt: string | null
  status: SocialAccountStatus
  statusError: string | null
  createdAt: string
  updatedAt: string
}

/** Row shape returned by `select(...)` on the `social_accounts` table (snake_case) */
export interface DbSocialAccount {
  id: string
  user_id: string
  provider: string
  provider_account_id: string
  username: string | null
  display_name: string | null
  avatar_url: string | null
  scopes: string[]
  connected_at: string
  last_used_at: string | null
  status: string
  status_error: string | null
  created_at: string
  updated_at: string
}

/**
 * Transform a social account from Supabase format (snake_case) to frontend format (camelCase).
 * IMPORTANT: access_token and refresh_token are never included -- tokens stay server-side only.
 */
export function transformSocialAccountFromDb(db: DbSocialAccount): SocialAccount {
  return {
    id: db.id,
    userId: db.user_id,
    provider: db.provider as SocialProvider,
    providerAccountId: db.provider_account_id,
    username: db.username,
    displayName: db.display_name,
    avatarUrl: db.avatar_url,
    scopes: db.scopes || [],
    connectedAt: db.connected_at,
    lastUsedAt: db.last_used_at,
    status: db.status as SocialAccountStatus,
    statusError: db.status_error,
    createdAt: db.created_at,
    updatedAt: db.updated_at,
  }
}

// ---------------------------------------------------------------------------
// Content utilities
// ---------------------------------------------------------------------------

/**
 * Calculate word count from markdown content.
 * Strips markdown syntax (code blocks, inline code, links, formatting chars)
 * before counting words.
 */
export function calculateWordCount(content: string): number {
  if (!content) return 0
  // Remove markdown syntax and count words
  const text = content
    .replace(/```[\s\S]*?```/g, '') // Remove code blocks
    .replace(/`[^`]*`/g, '') // Remove inline code
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // Convert links to text
    .replace(/[#*_~>\-|]/g, '') // Remove markdown characters
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim()
  return text ? text.split(' ').length : 0
}
