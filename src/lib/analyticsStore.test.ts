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

describe('useAnalyticsStore', () => {
  describe('fetchConnections', () => {
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

  describe('createConnection', () => {
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

  // ---------------------------------------------------------------------------
  // getConnection
  // ---------------------------------------------------------------------------

  describe('getConnection', () => {
    it('should return a connection by id', () => {
      const connection = makeConnection()
      useAnalyticsStore.setState({ connections: [connection] })
      expect(useAnalyticsStore.getState().getConnection('conn-1')).toEqual(connection)
    })

    it('should return undefined for unknown id', () => {
      useAnalyticsStore.setState({ connections: [makeConnection()] })
      expect(useAnalyticsStore.getState().getConnection('nonexistent')).toBeUndefined()
    })
  })

  // ---------------------------------------------------------------------------
  // getConnectionByPropertyId
  // ---------------------------------------------------------------------------

  describe('getConnectionByPropertyId', () => {
    it('should return a connection by propertyId', () => {
      const connection = makeConnection({ propertyId: 'GA-999' })
      useAnalyticsStore.setState({ connections: [connection] })
      expect(useAnalyticsStore.getState().getConnectionByPropertyId('GA-999')).toEqual(connection)
    })

    it('should return undefined for unknown propertyId', () => {
      useAnalyticsStore.setState({ connections: [makeConnection()] })
      expect(
        useAnalyticsStore.getState().getConnectionByPropertyId('GA-nonexistent')
      ).toBeUndefined()
    })
  })

  // ---------------------------------------------------------------------------
  // getConnectionsByProject
  // ---------------------------------------------------------------------------

  describe('getConnectionsByProject', () => {
    it('should filter connections by projectId', () => {
      useAnalyticsStore.setState({
        connections: [
          makeConnection({ id: 'c1', projectId: 'proj-1' }),
          makeConnection({ id: 'c2', projectId: 'proj-2' }),
          makeConnection({ id: 'c3', projectId: 'proj-1' }),
        ],
      })

      const result = useAnalyticsStore.getState().getConnectionsByProject('proj-1')
      expect(result).toHaveLength(2)
      expect(result.map((c) => c.id)).toEqual(['c1', 'c3'])
    })

    it('should return empty array when no connections match', () => {
      useAnalyticsStore.setState({
        connections: [makeConnection({ projectId: 'proj-1' })],
      })

      const result = useAnalyticsStore.getState().getConnectionsByProject('proj-other')
      expect(result).toEqual([])
    })
  })

  // ---------------------------------------------------------------------------
  // fetchReport
  // ---------------------------------------------------------------------------

  describe('fetchReport', () => {
    it('should fetch report and store in state', async () => {
      const report = makeReport()
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ report }),
      })

      const result = await useAnalyticsStore.getState().fetchReport('conn-1')

      expect(mockFetch).toHaveBeenCalledWith('/api/analytics/connections/conn-1/report')
      expect(result).toEqual(report)
      expect(useAnalyticsStore.getState().reports['conn-1']).toEqual(report)
    })

    it('should pass preset date range as query params', async () => {
      const report = makeReport()
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ report }),
      })

      await useAnalyticsStore.getState().fetchReport('conn-1', { preset: '28d' })

      expect(mockFetch).toHaveBeenCalledWith('/api/analytics/connections/conn-1/report?preset=28d')
    })

    it('should pass custom date range as query params', async () => {
      const report = makeReport()
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ report }),
      })

      await useAnalyticsStore.getState().fetchReport('conn-1', {
        preset: 'custom',
        startDate: '2024-01-01',
        endDate: '2024-01-31',
      })

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/analytics/connections/conn-1/report?preset=custom&startDate=2024-01-01&endDate=2024-01-31'
      )
    })

    it('should return undefined on failure', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false })

      const result = await useAnalyticsStore.getState().fetchReport('conn-1')
      expect(result).toBeUndefined()
    })

    it('should return undefined on network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      const result = await useAnalyticsStore.getState().fetchReport('conn-1')
      expect(result).toBeUndefined()
    })
  })

  // ---------------------------------------------------------------------------
  // getReport
  // ---------------------------------------------------------------------------

  describe('getReport', () => {
    it('should return a report by connectionId', () => {
      const report = makeReport()
      useAnalyticsStore.setState({ reports: { 'conn-1': report } })
      expect(useAnalyticsStore.getState().getReport('conn-1')).toEqual(report)
    })

    it('should return undefined when no report exists', () => {
      expect(useAnalyticsStore.getState().getReport('conn-1')).toBeUndefined()
    })
  })

  // ---------------------------------------------------------------------------
  // reset
  // ---------------------------------------------------------------------------

  describe('reset', () => {
    it('should reset state to initial values', () => {
      useAnalyticsStore.setState({
        connections: [makeConnection()],
        reports: { 'conn-1': makeReport() },
        loading: true,
        error: 'some error',
        initialized: true,
      })

      useAnalyticsStore.getState().reset()

      const state = useAnalyticsStore.getState()
      expect(state.connections).toEqual([])
      expect(state.reports).toEqual({})
      expect(state.loading).toBe(false)
      expect(state.error).toBeNull()
      expect(state.initialized).toBe(false)
    })
  })
})
