/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/ban-ts-comment */
// @ts-nocheck — split test file with shared mock setup
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { clearInFlightRequests } from './requestDedup'
import type { AnalyticsConnection, AnalyticsReport } from './analytics.types'

// ---------------------------------------------------------------------------
// Mock fetch
// ---------------------------------------------------------------------------

const mockFetch = vi.fn()
global.fetch = mockFetch

import { useAnalyticsStore } from './analyticsStore'

beforeEach(() => {
  mockFetch.mockReset()
  clearInFlightRequests()
  useAnalyticsStore.getState().reset()
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeConnection = (overrides: Partial<AnalyticsConnection> = {}): AnalyticsConnection => ({
  id: 'conn-1',
  userId: 'user-1',
  provider: 'google_analytics',
  propertyId: 'GA-123456',
  propertyName: 'My Site',
  scopes: ['analytics.readonly'],
  projectId: 'proj-1',
  syncStatus: 'success',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  ...overrides,
})

const _makeReport = (overrides: Partial<AnalyticsReport> = {}): AnalyticsReport => ({
  connectionId: 'conn-1',
  propertyId: 'GA-123456',
  propertyName: 'My Site',
  dateRange: { startDate: '2024-01-01', endDate: '2024-01-31' },
  metrics: {
    activeUsers: 100,
    sessions: 200,
    pageViews: 500,
    screenPageViews: 500,
    engagementRate: 0.65,
    averageSessionDuration: 120,
    bounceRate: 0.35,
    newUsers: 50,
    totalUsers: 150,
    eventCount: 1000,
  },
  fetchedAt: '2024-02-01T00:00:00Z',
  ...overrides,
})

// ---------------------------------------------------------------------------
// fetchConnections
// ---------------------------------------------------------------------------

describe('fetchConnections (1/2)', () => {
  it('should set loading true while fetching', async () => {
    let capturedLoading = false
    mockFetch.mockImplementation(() => {
      capturedLoading = useAnalyticsStore.getState().loading
      return Promise.resolve({
        ok: true,
        json: async () => ({ connections: [] }),
      })
    })

    await useAnalyticsStore.getState().fetchConnections()
    expect(capturedLoading).toBe(true)
  })

  it('should populate connections on success', async () => {
    const connections = [makeConnection(), makeConnection({ id: 'conn-2', propertyId: 'GA-2' })]
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ connections }),
    })

    await useAnalyticsStore.getState().fetchConnections()

    const state = useAnalyticsStore.getState()
    expect(state.connections).toEqual(connections)
    expect(state.loading).toBe(false)
    expect(state.error).toBeNull()
  })

  it('should set initialized after first fetch', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ connections: [] }),
    })

    expect(useAnalyticsStore.getState().initialized).toBe(false)
    await useAnalyticsStore.getState().fetchConnections()
    expect(useAnalyticsStore.getState().initialized).toBe(true)
  })
})

describe('fetchConnections (2/2)', () => {
  it('should set error on failure', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false })

    await useAnalyticsStore.getState().fetchConnections()

    const state = useAnalyticsStore.getState()
    expect(state.error).toBe('Failed to fetch analytics connections')
    expect(state.loading).toBe(false)
  })

  it('should handle network error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'))

    await useAnalyticsStore.getState().fetchConnections()

    expect(useAnalyticsStore.getState().error).toBe('Network error')
  })

  it('should default to empty array when response has no connections key', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    })

    await useAnalyticsStore.getState().fetchConnections()
    expect(useAnalyticsStore.getState().connections).toEqual([])
  })

  it('should deduplicate concurrent calls', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ connections: [] }),
    })

    await Promise.all([
      useAnalyticsStore.getState().fetchConnections(),
      useAnalyticsStore.getState().fetchConnections(),
    ])

    expect(mockFetch).toHaveBeenCalledTimes(1)
  })
})

// ---------------------------------------------------------------------------
// createConnection
// ---------------------------------------------------------------------------

describe('createConnection (1/3)', () => {
  it('should POST to /api/analytics/connections and add to state', async () => {
    const newConnection = makeConnection()
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ connection: newConnection }),
    })

    const input = {
      provider: 'google_analytics' as const,
      propertyId: 'GA-123456',
      propertyName: 'My Site',
      scopes: ['analytics.readonly'],
      projectId: 'proj-1',
    }

    const result = await useAnalyticsStore.getState().createConnection(input)

    expect(mockFetch).toHaveBeenCalledWith('/api/analytics/connections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    })
    expect(result).toEqual(newConnection)
    expect(useAnalyticsStore.getState().connections).toHaveLength(1)
    expect(useAnalyticsStore.getState().connections[0]).toEqual(newConnection)
  })
})

describe('createConnection (2/3)', () => {
  it('should prepend new connection to existing list', async () => {
    const existing = makeConnection({ id: 'existing-1' })
    useAnalyticsStore.setState({ connections: [existing] })

    const newConnection = makeConnection({ id: 'new-1' })
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ connection: newConnection }),
    })

    await useAnalyticsStore.getState().createConnection({
      provider: 'google_analytics',
      propertyId: 'GA-999',
      scopes: [],
    })

    const connections = useAnalyticsStore.getState().connections
    expect(connections).toHaveLength(2)
    expect(connections[0].id).toBe('new-1')
    expect(connections[1].id).toBe('existing-1')
  })

  it('should set error and throw on failure', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Invalid property ID' }),
    })

    await expect(
      useAnalyticsStore.getState().createConnection({
        provider: 'google_analytics',
        propertyId: 'bad',
        scopes: [],
      })
    ).rejects.toThrow('Invalid property ID')

    expect(useAnalyticsStore.getState().error).toBe('Invalid property ID')
    expect(useAnalyticsStore.getState().loading).toBe(false)
  })
})

describe('createConnection (3/3)', () => {
  it('should use default error message when API returns no error field', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({}),
    })

    await expect(
      useAnalyticsStore.getState().createConnection({
        provider: 'google_analytics',
        propertyId: 'bad',
        scopes: [],
      })
    ).rejects.toThrow('Failed to create connection')
  })
})
