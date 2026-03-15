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
    expect(useAnalyticsStore.getState().getConnectionByPropertyId('GA-nonexistent')).toBeUndefined()
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
