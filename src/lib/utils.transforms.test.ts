import { describe, it, expect } from 'vitest'
import {
  transformProjectFromDb,
  transformProjectToDb,
  transformAnalyticsConnectionFromDb,
  transformAnalyticsConnectionToDb,
} from './utils'
import type {
  DbProject,
  DbAnalyticsConnection,
  ProjectUpdateInput,
  AnalyticsConnectionUpdateInput,
} from './utils'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// transformProjectFromDb
// ---------------------------------------------------------------------------

describe('transformProjectFromDb - field mapping', () => {
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
})

describe('transformProjectFromDb - nulls and defaults', () => {
  it('converts null optional fields to undefined', () => {
    const dbProject: DbProject = { ...sampleDbProject, description: null, logo_url: null }
    const project = transformProjectFromDb(dbProject)
    expect(project.description).toBeUndefined()
    expect(project.logoUrl).toBeUndefined()
  })

  it('defaults hashtags to empty array when falsy', () => {
    const dbProject: DbProject = { ...sampleDbProject, hashtags: [] as string[] }
    const project = transformProjectFromDb(dbProject)
    expect(project.hashtags).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// transformProjectToDb
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Project roundtrip
// ---------------------------------------------------------------------------

describe('Project roundtrip', () => {
  it('fromDb -> toDb preserves all editable fields', () => {
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
// transformAnalyticsConnectionFromDb
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// transformAnalyticsConnectionToDb
// ---------------------------------------------------------------------------

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
  })

  it('only includes defined fields (sparse update)', () => {
    const input: AnalyticsConnectionUpdateInput = { syncStatus: 'error', syncError: 'failed' }
    const dbConn = transformAnalyticsConnectionToDb(input)
    expect(dbConn.sync_status).toBe('error')
    expect(dbConn.sync_error).toBe('failed')
    expect(dbConn).not.toHaveProperty('provider')
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

// ---------------------------------------------------------------------------
// AnalyticsConnection roundtrip
// ---------------------------------------------------------------------------

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
  })
})
