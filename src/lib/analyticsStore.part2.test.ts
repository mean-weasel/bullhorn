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

const makeReport = (overrides: Partial<AnalyticsReport> = {}): AnalyticsReport => ({
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

// ---------------------------------------------------------------------------
// updateConnection
// ---------------------------------------------------------------------------

describe('updateConnection', () => {
  it('should PATCH and update the connection in state', async () => {
    const original = makeConnection()
    useAnalyticsStore.setState({ connections: [original] })

    const updated = { ...original, propertyName: 'Updated Site' }
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ connection: updated }),
    })

    await useAnalyticsStore.getState().updateConnection('conn-1', {
      propertyName: 'Updated Site',
    })

    expect(mockFetch).toHaveBeenCalledWith('/api/analytics/connections/conn-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ propertyName: 'Updated Site' }),
    })
    expect(useAnalyticsStore.getState().connections[0].propertyName).toBe('Updated Site')
  })

  it('should set error and throw on failure', async () => {
    useAnalyticsStore.setState({ connections: [makeConnection()] })
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Update failed' }),
    })

    await expect(
      useAnalyticsStore.getState().updateConnection('conn-1', { propertyName: 'Fail' })
    ).rejects.toThrow('Update failed')

    expect(useAnalyticsStore.getState().error).toBe('Update failed')
    expect(useAnalyticsStore.getState().loading).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// deleteConnection
// ---------------------------------------------------------------------------

describe('deleteConnection', () => {
  it('should DELETE and remove the connection from state', async () => {
    useAnalyticsStore.setState({
      connections: [makeConnection({ id: 'conn-1' }), makeConnection({ id: 'conn-2' })],
    })

    mockFetch.mockResolvedValueOnce({ ok: true })

    await useAnalyticsStore.getState().deleteConnection('conn-1')

    expect(mockFetch).toHaveBeenCalledWith('/api/analytics/connections/conn-1', {
      method: 'DELETE',
    })
    const connections = useAnalyticsStore.getState().connections
    expect(connections).toHaveLength(1)
    expect(connections[0].id).toBe('conn-2')
  })

  it('should also remove the report for the deleted connection', async () => {
    const report = makeReport({ connectionId: 'conn-1' })
    useAnalyticsStore.setState({
      connections: [makeConnection({ id: 'conn-1' })],
      reports: { 'conn-1': report },
    })

    mockFetch.mockResolvedValueOnce({ ok: true })

    await useAnalyticsStore.getState().deleteConnection('conn-1')

    expect(useAnalyticsStore.getState().reports).toEqual({})
  })

  it('should set error and throw on failure', async () => {
    useAnalyticsStore.setState({ connections: [makeConnection()] })
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Delete denied' }),
    })

    await expect(useAnalyticsStore.getState().deleteConnection('conn-1')).rejects.toThrow(
      'Delete denied'
    )

    expect(useAnalyticsStore.getState().error).toBe('Delete denied')
    expect(useAnalyticsStore.getState().loading).toBe(false)
  })
})
