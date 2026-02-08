import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type {
  Post,
  PostStatus,
  Platform,
  PlatformContent,
  PublishResult,
  GroupType,
  Campaign,
  CampaignStatus,
  Project,
} from './posts'
import type { AnalyticsConnection, AnalyticsProvider, SyncStatus } from './analytics.types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// ---------------------------------------------------------------------------
// Database row interfaces (snake_case, matching Supabase table columns)
// ---------------------------------------------------------------------------

/** Row shape returned by `select('*')` on the `posts` table */
export interface DbPost {
  id: string
  created_at: string
  updated_at: string
  scheduled_at: string | null
  status: PostStatus
  platform: Platform
  notes?: string | null
  campaign_id?: string | null
  group_id?: string | null
  group_type?: GroupType | null
  content: PlatformContent
  publish_result?: PublishResult | null
  user_id: string
}

/** Partial snake_case shape used when inserting / updating a post */
export interface DbPostInsert {
  id?: string
  created_at?: string
  updated_at?: string
  scheduled_at?: string | null
  status?: PostStatus
  platform?: Platform
  notes?: string | null
  campaign_id?: string | null
  group_id?: string | null
  group_type?: GroupType | null
  content?: PlatformContent
  publish_result?: PublishResult | null
}

/** Row shape returned by `select('*')` on the `campaigns` table */
export interface DbCampaign {
  id: string
  name: string
  description?: string | null
  status: CampaignStatus
  project_id?: string | null
  created_at: string
  updated_at: string
  user_id: string
}

/** Row shape returned by `select('*')` on the `projects` table */
export interface DbProject {
  id: string
  name: string
  description?: string | null
  hashtags: string[]
  brand_colors: { primary?: string; secondary?: string; accent?: string }
  logo_url?: string | null
  created_at: string
  updated_at: string
  user_id: string
}

/** Partial snake_case shape used when inserting / updating a project */
export interface DbProjectInsert {
  name?: string
  description?: string | null
  hashtags?: string[]
  brand_colors?: { primary?: string; secondary?: string; accent?: string } | Record<string, string>
  logo_url?: string | null
}

/** Input shape accepted by transformProjectToDb (wider than Partial<Project> to accept Zod output) */
export interface ProjectUpdateInput {
  name?: string
  description?: string | null
  hashtags?: string[]
  brandColors?: { primary?: string; secondary?: string; accent?: string } | Record<string, string>
  logoUrl?: string | null
}

/** Row shape returned by `select('*')` on the `analytics_connections` table */
export interface DbAnalyticsConnection {
  id: string
  user_id: string
  provider: AnalyticsProvider
  property_id: string
  property_name?: string | null
  access_token: string
  refresh_token: string
  token_expires_at: string
  scopes: string[]
  project_id?: string | null
  last_sync_at?: string | null
  sync_status: SyncStatus
  sync_error?: string | null
  created_at: string
  updated_at: string
}

/** Partial snake_case shape used when updating an analytics connection */
export interface DbAnalyticsConnectionInsert {
  provider?: AnalyticsProvider | string
  property_id?: string
  property_name?: string | null
  access_token?: string
  refresh_token?: string
  token_expires_at?: string
  scopes?: string[]
  project_id?: string | null
  last_sync_at?: string | null
  sync_status?: SyncStatus | string
  sync_error?: string | null
}

/** Input shape accepted by transformAnalyticsConnectionToDb (wider than Partial<AnalyticsConnection>) */
export interface AnalyticsConnectionUpdateInput {
  provider?: string
  propertyId?: string
  propertyName?: string | null
  accessToken?: string
  refreshToken?: string
  tokenExpiresAt?: string
  scopes?: string[]
  projectId?: string | null
  lastSyncAt?: string
  syncStatus?: string
  syncError?: string
}

// ---------------------------------------------------------------------------
// Generic key-case converters (stay loosely typed by design)
// ---------------------------------------------------------------------------

/**
 * Convert snake_case keys to camelCase
 * Used to transform Supabase responses to frontend format
 */
export function snakeToCamel<T extends Record<string, unknown>>(obj: T): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(obj)) {
    const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())
    result[camelKey] = value
  }
  return result
}

/**
 * Convert camelCase keys to snake_case
 * Used to transform frontend data to Supabase format
 */
export function camelToSnake<T extends Record<string, unknown>>(obj: T): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(obj)) {
    const snakeKey = key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)
    result[snakeKey] = value
  }
  return result
}

// ---------------------------------------------------------------------------
// Post transforms
// ---------------------------------------------------------------------------

/**
 * Transform a post from Supabase format (snake_case) to frontend format (camelCase)
 */
export function transformPostFromDb(dbPost: DbPost): Post {
  return {
    id: dbPost.id,
    createdAt: dbPost.created_at,
    updatedAt: dbPost.updated_at,
    scheduledAt: dbPost.scheduled_at,
    status: dbPost.status,
    platform: dbPost.platform,
    notes: dbPost.notes ?? undefined,
    campaignId: dbPost.campaign_id ?? undefined,
    groupId: dbPost.group_id ?? undefined,
    groupType: dbPost.group_type ?? undefined,
    content: dbPost.content,
    publishResult: dbPost.publish_result ?? undefined,
  }
}

/**
 * Transform a post from frontend format (camelCase) to Supabase format (snake_case)
 */
export function transformPostToDb(post: Partial<Post>): DbPostInsert {
  return {
    id: post.id,
    created_at: post.createdAt,
    updated_at: post.updatedAt,
    scheduled_at: post.scheduledAt,
    status: post.status,
    platform: post.platform,
    notes: post.notes,
    campaign_id: post.campaignId,
    group_id: post.groupId,
    group_type: post.groupType,
    content: post.content,
    publish_result: post.publishResult,
  }
}

// ---------------------------------------------------------------------------
// Campaign transforms
// ---------------------------------------------------------------------------

/**
 * Transform a campaign from Supabase format (snake_case) to frontend format (camelCase)
 */
export function transformCampaignFromDb(dbCampaign: DbCampaign): Campaign {
  return {
    id: dbCampaign.id,
    name: dbCampaign.name,
    description: dbCampaign.description ?? undefined,
    status: dbCampaign.status,
    projectId: dbCampaign.project_id ?? undefined,
    createdAt: dbCampaign.created_at,
    updatedAt: dbCampaign.updated_at,
  }
}

// ---------------------------------------------------------------------------
// Project transforms
// ---------------------------------------------------------------------------

/**
 * Transform a project from Supabase format (snake_case) to frontend format (camelCase)
 */
export function transformProjectFromDb(dbProject: DbProject): Project {
  return {
    id: dbProject.id,
    name: dbProject.name,
    description: dbProject.description ?? undefined,
    hashtags: dbProject.hashtags || [],
    brandColors: dbProject.brand_colors || {},
    logoUrl: dbProject.logo_url ?? undefined,
    createdAt: dbProject.created_at,
    updatedAt: dbProject.updated_at,
  }
}

/**
 * Transform a project from frontend format (camelCase) to Supabase format (snake_case)
 */
export function transformProjectToDb(project: ProjectUpdateInput): DbProjectInsert {
  const result: DbProjectInsert = {}
  if (project.name !== undefined) result.name = project.name
  if (project.description !== undefined) result.description = project.description
  if (project.hashtags !== undefined) result.hashtags = project.hashtags
  if (project.brandColors !== undefined) result.brand_colors = project.brandColors
  if (project.logoUrl !== undefined) result.logo_url = project.logoUrl
  return result
}

// ---------------------------------------------------------------------------
// Analytics connection transforms
// ---------------------------------------------------------------------------

/**
 * Transform an analytics connection from Supabase format (snake_case) to frontend format (camelCase)
 */
export function transformAnalyticsConnectionFromDb(
  dbConnection: DbAnalyticsConnection
): AnalyticsConnection {
  return {
    id: dbConnection.id,
    userId: dbConnection.user_id,
    provider: dbConnection.provider,
    propertyId: dbConnection.property_id,
    propertyName: dbConnection.property_name ?? undefined,
    accessToken: dbConnection.access_token,
    refreshToken: dbConnection.refresh_token,
    tokenExpiresAt: dbConnection.token_expires_at,
    scopes: dbConnection.scopes || [],
    projectId: dbConnection.project_id ?? undefined,
    lastSyncAt: dbConnection.last_sync_at ?? undefined,
    syncStatus: dbConnection.sync_status,
    syncError: dbConnection.sync_error ?? undefined,
    createdAt: dbConnection.created_at,
    updatedAt: dbConnection.updated_at,
  }
}

/**
 * Transform an analytics connection from frontend format (camelCase) to Supabase format (snake_case)
 */
export function transformAnalyticsConnectionToDb(
  connection: AnalyticsConnectionUpdateInput
): DbAnalyticsConnectionInsert {
  const result: DbAnalyticsConnectionInsert = {}
  if (connection.provider !== undefined) result.provider = connection.provider
  if (connection.propertyId !== undefined) result.property_id = connection.propertyId
  if (connection.propertyName !== undefined) result.property_name = connection.propertyName
  if (connection.accessToken !== undefined) result.access_token = connection.accessToken
  if (connection.refreshToken !== undefined) result.refresh_token = connection.refreshToken
  if (connection.tokenExpiresAt !== undefined) result.token_expires_at = connection.tokenExpiresAt
  if (connection.scopes !== undefined) result.scopes = connection.scopes
  if (connection.projectId !== undefined) result.project_id = connection.projectId
  if (connection.lastSyncAt !== undefined) result.last_sync_at = connection.lastSyncAt
  if (connection.syncStatus !== undefined) result.sync_status = connection.syncStatus
  if (connection.syncError !== undefined) result.sync_error = connection.syncError
  return result
}
