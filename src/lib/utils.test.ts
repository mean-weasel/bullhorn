import { describe, it, expect } from 'vitest'
import {
  cn,
  snakeToCamel,
  camelToSnake,
  transformPostFromDb,
  transformPostToDb,
  transformCampaignFromDb,
  transformProjectFromDb,
  transformProjectToDb,
  transformAnalyticsConnectionFromDb,
  transformAnalyticsConnectionToDb,
} from './utils'
import type {
  DbPost,
  DbCampaign,
  DbProject,
  DbAnalyticsConnection,
  ProjectUpdateInput,
  AnalyticsConnectionUpdateInput,
} from './utils'

// ---------------------------------------------------------------------------
// cn (class name merging)
// ---------------------------------------------------------------------------

describe('cn', () => {
  it('merges simple class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar')
  })

  it('handles conditional classes via clsx syntax', () => {
    expect(cn('base', false && 'hidden', 'visible')).toBe('base visible')
  })

  it('uses tailwind-merge to resolve conflicts', () => {
    // tailwind-merge should keep only the last conflicting utility
    expect(cn('p-4', 'p-2')).toBe('p-2')
    expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500')
  })

  it('handles arrays', () => {
    expect(cn(['foo', 'bar'])).toBe('foo bar')
  })

  it('handles undefined and null inputs', () => {
    expect(cn('a', undefined, null, 'b')).toBe('a b')
  })

  it('returns empty string for no inputs', () => {
    expect(cn()).toBe('')
  })
})

// ---------------------------------------------------------------------------
// snakeToCamel / camelToSnake
// ---------------------------------------------------------------------------

describe('snakeToCamel', () => {
  it('converts simple snake_case keys to camelCase', () => {
    const input = { user_id: '123', first_name: 'Alice' }
    expect(snakeToCamel(input)).toEqual({ userId: '123', firstName: 'Alice' })
  })

  it('leaves already-camelCase keys unchanged', () => {
    const input = { name: 'test', createdAt: '2024-01-01' }
    expect(snakeToCamel(input)).toEqual({ name: 'test', createdAt: '2024-01-01' })
  })

  it('handles keys with multiple underscores', () => {
    const input = { long_snake_case_key: true }
    expect(snakeToCamel(input)).toEqual({ longSnakeCaseKey: true })
  })

  it('preserves values of all types', () => {
    const input = {
      num_val: 42,
      bool_val: false,
      null_val: null,
      arr_val: [1, 2, 3],
      obj_val: { nested: true },
    }
    const result = snakeToCamel(input)
    expect(result.numVal).toBe(42)
    expect(result.boolVal).toBe(false)
    expect(result.nullVal).toBeNull()
    expect(result.arrVal).toEqual([1, 2, 3])
    expect(result.objVal).toEqual({ nested: true })
  })

  it('handles an empty object', () => {
    expect(snakeToCamel({})).toEqual({})
  })
})

describe('camelToSnake', () => {
  it('converts camelCase keys to snake_case', () => {
    const input = { userId: '123', firstName: 'Alice' }
    expect(camelToSnake(input)).toEqual({ user_id: '123', first_name: 'Alice' })
  })

  it('leaves already-snake_case keys unchanged', () => {
    const input = { name: 'test', id: '1' }
    expect(camelToSnake(input)).toEqual({ name: 'test', id: '1' })
  })

  it('handles consecutive uppercase letters', () => {
    const input = { myURLPath: '/api' }
    // Each uppercase letter gets its own underscore prefix
    expect(camelToSnake(input)).toEqual({ my_u_r_l_path: '/api' })
  })

  it('handles an empty object', () => {
    expect(camelToSnake({})).toEqual({})
  })
})

describe('snakeToCamel and camelToSnake roundtrip', () => {
  it('roundtrips simple keys', () => {
    const original = { user_id: '1', created_at: '2024-01-01' }
    const camel = snakeToCamel(original)
    const backToSnake = camelToSnake(camel)
    expect(backToSnake).toEqual(original)
  })
})

// ---------------------------------------------------------------------------
// transformPostFromDb / transformPostToDb
// ---------------------------------------------------------------------------

const sampleDbPost: DbPost = {
  id: 'post-001',
  created_at: '2024-06-01T12:00:00Z',
  updated_at: '2024-06-02T08:00:00Z',
  scheduled_at: '2024-06-05T15:00:00Z',
  status: 'scheduled',
  platform: 'twitter',
  notes: 'Remember hashtags',
  campaign_id: 'camp-001',
  group_id: 'grp-001',
  group_type: 'reddit-crosspost',
  content: { text: 'Hello world!', mediaUrls: ['https://img.example.com/1.png'] },
  publish_result: {
    success: true,
    postId: 'tw-12345',
    postUrl: 'https://twitter.com/user/status/12345',
    publishedAt: '2024-06-05T15:01:00Z',
  },
  user_id: 'user-abc',
}

describe('transformPostFromDb', () => {
  it('maps all snake_case fields to camelCase', () => {
    const post = transformPostFromDb(sampleDbPost)
    expect(post.id).toBe('post-001')
    expect(post.createdAt).toBe('2024-06-01T12:00:00Z')
    expect(post.updatedAt).toBe('2024-06-02T08:00:00Z')
    expect(post.scheduledAt).toBe('2024-06-05T15:00:00Z')
    expect(post.status).toBe('scheduled')
    expect(post.platform).toBe('twitter')
    expect(post.notes).toBe('Remember hashtags')
    expect(post.campaignId).toBe('camp-001')
    expect(post.groupId).toBe('grp-001')
    expect(post.groupType).toBe('reddit-crosspost')
    expect(post.content).toEqual({
      text: 'Hello world!',
      mediaUrls: ['https://img.example.com/1.png'],
    })
    expect(post.publishResult).toEqual({
      success: true,
      postId: 'tw-12345',
      postUrl: 'https://twitter.com/user/status/12345',
      publishedAt: '2024-06-05T15:01:00Z',
    })
  })

  it('does not include user_id in the output', () => {
    const post = transformPostFromDb(sampleDbPost) as unknown as Record<string, unknown>
    expect(post.user_id).toBeUndefined()
    expect(post.userId).toBeUndefined()
  })

  it('converts null optional fields to undefined', () => {
    const dbPost: DbPost = {
      ...sampleDbPost,
      notes: null,
      campaign_id: null,
      group_id: null,
      group_type: null,
      publish_result: null,
      scheduled_at: null,
    }
    const post = transformPostFromDb(dbPost)
    expect(post.notes).toBeUndefined()
    expect(post.campaignId).toBeUndefined()
    expect(post.groupId).toBeUndefined()
    expect(post.groupType).toBeUndefined()
    expect(post.publishResult).toBeUndefined()
    expect(post.scheduledAt).toBeNull()
  })
})

describe('transformPostToDb', () => {
  it('maps camelCase fields to snake_case', () => {
    const post = transformPostFromDb(sampleDbPost)
    const dbPost = transformPostToDb(post)
    expect(dbPost.id).toBe('post-001')
    expect(dbPost.created_at).toBe('2024-06-01T12:00:00Z')
    expect(dbPost.updated_at).toBe('2024-06-02T08:00:00Z')
    expect(dbPost.scheduled_at).toBe('2024-06-05T15:00:00Z')
    expect(dbPost.status).toBe('scheduled')
    expect(dbPost.platform).toBe('twitter')
    expect(dbPost.notes).toBe('Remember hashtags')
    expect(dbPost.campaign_id).toBe('camp-001')
    expect(dbPost.group_id).toBe('grp-001')
    expect(dbPost.group_type).toBe('reddit-crosspost')
  })

  it('handles partial post data', () => {
    const partial = { status: 'draft' as const, platform: 'linkedin' as const }
    const dbPost = transformPostToDb(partial)
    expect(dbPost.status).toBe('draft')
    expect(dbPost.platform).toBe('linkedin')
    expect(dbPost.id).toBeUndefined()
    expect(dbPost.notes).toBeUndefined()
  })
})

describe('Post roundtrip', () => {
  it('fromDb -> toDb preserves core fields', () => {
    const post = transformPostFromDb(sampleDbPost)
    const dbPost = transformPostToDb(post)
    expect(dbPost.id).toBe(sampleDbPost.id)
    expect(dbPost.created_at).toBe(sampleDbPost.created_at)
    expect(dbPost.updated_at).toBe(sampleDbPost.updated_at)
    expect(dbPost.scheduled_at).toBe(sampleDbPost.scheduled_at)
    expect(dbPost.status).toBe(sampleDbPost.status)
    expect(dbPost.platform).toBe(sampleDbPost.platform)
    expect(dbPost.content).toEqual(sampleDbPost.content)
  })
})

// ---------------------------------------------------------------------------
// transformCampaignFromDb
// ---------------------------------------------------------------------------

describe('transformCampaignFromDb', () => {
  const sampleDbCampaign: DbCampaign = {
    id: 'camp-001',
    name: 'Summer Launch',
    description: 'Launch campaign for summer product',
    status: 'active',
    project_id: 'proj-001',
    created_at: '2024-05-01T00:00:00Z',
    updated_at: '2024-05-15T00:00:00Z',
    user_id: 'user-abc',
  }

  it('maps all fields correctly', () => {
    const campaign = transformCampaignFromDb(sampleDbCampaign)
    expect(campaign.id).toBe('camp-001')
    expect(campaign.name).toBe('Summer Launch')
    expect(campaign.description).toBe('Launch campaign for summer product')
    expect(campaign.status).toBe('active')
    expect(campaign.projectId).toBe('proj-001')
    expect(campaign.createdAt).toBe('2024-05-01T00:00:00Z')
    expect(campaign.updatedAt).toBe('2024-05-15T00:00:00Z')
  })

  it('does not include user_id in the output', () => {
    const campaign = transformCampaignFromDb(sampleDbCampaign) as unknown as Record<string, unknown>
    expect(campaign.userId).toBeUndefined()
    expect(campaign.user_id).toBeUndefined()
  })

  it('converts null optional fields to undefined', () => {
    const dbCampaign: DbCampaign = {
      ...sampleDbCampaign,
      description: null,
      project_id: null,
    }
    const campaign = transformCampaignFromDb(dbCampaign)
    expect(campaign.description).toBeUndefined()
    expect(campaign.projectId).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// transformProjectFromDb / transformProjectToDb
// ---------------------------------------------------------------------------

describe('transformProjectFromDb', () => {
  const sampleDbProject: DbProject = {
    id: 'proj-001',
    name: 'Bullhorn',
    description: 'Social media scheduler',
    hashtags: ['#launch', '#saas'],
    brand_colors: { primary: '#fbbf24', secondary: '#ec4899', accent: '#3b82f6' },
    logo_url: 'https://example.com/logo.png',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-03-01T00:00:00Z',
    user_id: 'user-abc',
  }

  it('maps all fields correctly', () => {
    const project = transformProjectFromDb(sampleDbProject)
    expect(project.id).toBe('proj-001')
    expect(project.name).toBe('Bullhorn')
    expect(project.description).toBe('Social media scheduler')
    expect(project.hashtags).toEqual(['#launch', '#saas'])
    expect(project.brandColors).toEqual({
      primary: '#fbbf24',
      secondary: '#ec4899',
      accent: '#3b82f6',
    })
    expect(project.logoUrl).toBe('https://example.com/logo.png')
    expect(project.createdAt).toBe('2024-01-01T00:00:00Z')
    expect(project.updatedAt).toBe('2024-03-01T00:00:00Z')
  })

  it('does not include user_id in the output', () => {
    const project = transformProjectFromDb(sampleDbProject) as unknown as Record<string, unknown>
    expect(project.userId).toBeUndefined()
    expect(project.user_id).toBeUndefined()
  })

  it('converts null optional fields to undefined', () => {
    const dbProject: DbProject = {
      ...sampleDbProject,
      description: null,
      logo_url: null,
    }
    const project = transformProjectFromDb(dbProject)
    expect(project.description).toBeUndefined()
    expect(project.logoUrl).toBeUndefined()
  })

  it('defaults hashtags to empty array when falsy', () => {
    const dbProject: DbProject = {
      ...sampleDbProject,
      hashtags: [] as string[],
    }
    const project = transformProjectFromDb(dbProject)
    expect(project.hashtags).toEqual([])
  })
})

describe('transformProjectToDb', () => {
  it('maps all provided fields', () => {
    const input: ProjectUpdateInput = {
      name: 'New Name',
      description: 'Updated description',
      hashtags: ['#updated'],
      brandColors: { primary: '#000' },
      logoUrl: 'https://example.com/new-logo.png',
    }
    const dbProject = transformProjectToDb(input)
    expect(dbProject.name).toBe('New Name')
    expect(dbProject.description).toBe('Updated description')
    expect(dbProject.hashtags).toEqual(['#updated'])
    expect(dbProject.brand_colors).toEqual({ primary: '#000' })
    expect(dbProject.logo_url).toBe('https://example.com/new-logo.png')
  })

  it('only includes defined fields (sparse update)', () => {
    const input: ProjectUpdateInput = { name: 'Just Name' }
    const dbProject = transformProjectToDb(input)
    expect(dbProject.name).toBe('Just Name')
    expect(dbProject).not.toHaveProperty('description')
    expect(dbProject).not.toHaveProperty('hashtags')
    expect(dbProject).not.toHaveProperty('brand_colors')
    expect(dbProject).not.toHaveProperty('logo_url')
  })

  it('allows null for nullable fields', () => {
    const input: ProjectUpdateInput = { description: null, logoUrl: null }
    const dbProject = transformProjectToDb(input)
    expect(dbProject.description).toBeNull()
    expect(dbProject.logo_url).toBeNull()
  })

  it('returns empty object when given empty input', () => {
    const dbProject = transformProjectToDb({})
    expect(dbProject).toEqual({})
  })
})

describe('Project roundtrip', () => {
  it('fromDb -> toDb preserves all editable fields', () => {
    const sampleDbProject: DbProject = {
      id: 'proj-001',
      name: 'Bullhorn',
      description: 'desc',
      hashtags: ['#a'],
      brand_colors: { primary: '#000' },
      logo_url: 'https://logo.png',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-03-01T00:00:00Z',
      user_id: 'user-abc',
    }
    const project = transformProjectFromDb(sampleDbProject)
    const dbProject = transformProjectToDb({
      name: project.name,
      description: project.description,
      hashtags: project.hashtags,
      brandColors: project.brandColors,
      logoUrl: project.logoUrl,
    })
    expect(dbProject.name).toBe(sampleDbProject.name)
    expect(dbProject.description).toBe(sampleDbProject.description)
    expect(dbProject.hashtags).toEqual(sampleDbProject.hashtags)
    expect(dbProject.brand_colors).toEqual(sampleDbProject.brand_colors)
    expect(dbProject.logo_url).toBe(sampleDbProject.logo_url)
  })
})

// ---------------------------------------------------------------------------
// transformAnalyticsConnectionFromDb / transformAnalyticsConnectionToDb
// ---------------------------------------------------------------------------

const sampleDbAnalyticsConnection: DbAnalyticsConnection = {
  id: 'ac-001',
  user_id: 'user-abc',
  provider: 'google_analytics',
  property_id: 'GA-12345',
  property_name: 'My Website',
  access_token: 'access-tok-abc',
  refresh_token: 'refresh-tok-xyz',
  token_expires_at: '2024-12-31T23:59:59Z',
  scopes: ['analytics.readonly'],
  project_id: 'proj-001',
  last_sync_at: '2024-06-01T00:00:00Z',
  sync_status: 'success',
  sync_error: null,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-06-01T00:00:00Z',
}

// Note: DbAnalyticsConnection still has token fields (full DB row shape)
// but AnalyticsConnection (frontend type) and transform functions no longer include them

describe('transformAnalyticsConnectionFromDb', () => {
  it('maps all fields correctly', () => {
    const conn = transformAnalyticsConnectionFromDb(sampleDbAnalyticsConnection)
    expect(conn.id).toBe('ac-001')
    expect(conn.userId).toBe('user-abc')
    expect(conn.provider).toBe('google_analytics')
    expect(conn.propertyId).toBe('GA-12345')
    expect(conn.propertyName).toBe('My Website')
    expect(conn.scopes).toEqual(['analytics.readonly'])
    expect(conn.projectId).toBe('proj-001')
    expect(conn.lastSyncAt).toBe('2024-06-01T00:00:00Z')
    expect(conn.syncStatus).toBe('success')
    expect(conn.syncError).toBeUndefined()
    expect(conn.createdAt).toBe('2024-01-01T00:00:00Z')
    expect(conn.updatedAt).toBe('2024-06-01T00:00:00Z')
  })

  it('converts null optional fields to undefined', () => {
    const dbConn: DbAnalyticsConnection = {
      ...sampleDbAnalyticsConnection,
      property_name: null,
      project_id: null,
      last_sync_at: null,
      sync_error: null,
    }
    const conn = transformAnalyticsConnectionFromDb(dbConn)
    expect(conn.propertyName).toBeUndefined()
    expect(conn.projectId).toBeUndefined()
    expect(conn.lastSyncAt).toBeUndefined()
    expect(conn.syncError).toBeUndefined()
  })
})

describe('transformAnalyticsConnectionToDb', () => {
  it('maps all provided fields', () => {
    const input: AnalyticsConnectionUpdateInput = {
      provider: 'google_analytics',
      propertyId: 'GA-99999',
      propertyName: 'New Site',
      scopes: ['analytics.readonly', 'analytics.edit'],
      projectId: 'proj-002',
      lastSyncAt: '2024-07-01T00:00:00Z',
      syncStatus: 'syncing',
      syncError: 'timeout',
    }
    const dbConn = transformAnalyticsConnectionToDb(input)
    expect(dbConn.provider).toBe('google_analytics')
    expect(dbConn.property_id).toBe('GA-99999')
    expect(dbConn.property_name).toBe('New Site')
    expect(dbConn.scopes).toEqual(['analytics.readonly', 'analytics.edit'])
    expect(dbConn.project_id).toBe('proj-002')
    expect(dbConn.last_sync_at).toBe('2024-07-01T00:00:00Z')
    expect(dbConn.sync_status).toBe('syncing')
    expect(dbConn.sync_error).toBe('timeout')
  })

  it('only includes defined fields (sparse update)', () => {
    const input: AnalyticsConnectionUpdateInput = { syncStatus: 'error', syncError: 'failed' }
    const dbConn = transformAnalyticsConnectionToDb(input)
    expect(dbConn.sync_status).toBe('error')
    expect(dbConn.sync_error).toBe('failed')
    expect(dbConn).not.toHaveProperty('provider')
    expect(dbConn).not.toHaveProperty('property_id')
  })

  it('allows null for nullable fields', () => {
    const input: AnalyticsConnectionUpdateInput = { propertyName: null, projectId: null }
    const dbConn = transformAnalyticsConnectionToDb(input)
    expect(dbConn.property_name).toBeNull()
    expect(dbConn.project_id).toBeNull()
  })

  it('returns empty object when given empty input', () => {
    const dbConn = transformAnalyticsConnectionToDb({})
    expect(dbConn).toEqual({})
  })
})

describe('AnalyticsConnection roundtrip', () => {
  it('fromDb -> toDb preserves editable fields', () => {
    const conn = transformAnalyticsConnectionFromDb(sampleDbAnalyticsConnection)
    const dbConn = transformAnalyticsConnectionToDb({
      provider: conn.provider,
      propertyId: conn.propertyId,
      propertyName: conn.propertyName,
      scopes: conn.scopes,
      projectId: conn.projectId,
      lastSyncAt: conn.lastSyncAt,
      syncStatus: conn.syncStatus,
      syncError: conn.syncError,
    })
    expect(dbConn.provider).toBe(sampleDbAnalyticsConnection.provider)
    expect(dbConn.property_id).toBe(sampleDbAnalyticsConnection.property_id)
    expect(dbConn.property_name).toBe(sampleDbAnalyticsConnection.property_name)
    expect(dbConn.scopes).toEqual(sampleDbAnalyticsConnection.scopes)
    expect(dbConn.project_id).toBe(sampleDbAnalyticsConnection.project_id)
    expect(dbConn.last_sync_at).toBe(sampleDbAnalyticsConnection.last_sync_at)
    expect(dbConn.sync_status).toBe(sampleDbAnalyticsConnection.sync_status)
  })
})
