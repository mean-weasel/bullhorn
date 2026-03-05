import { create } from 'zustand'
import { AnalyticsConnection, AnalyticsReport, DateRange } from './analytics.types'
import { dedup } from './requestDedup'

// API URL - use relative path for Next.js API routes
const API_BASE = '/api/analytics'

interface AnalyticsState {
  connections: AnalyticsConnection[]
  reports: Record<string, AnalyticsReport> // keyed by connectionId
  loading: boolean
  error: string | null
  initialized: boolean
}

interface AnalyticsActions {
  // Connection CRUD operations
  fetchConnections: () => Promise<void>
  createConnection: (connection: {
    provider: 'google_analytics'
    propertyId: string
    propertyName?: string
    scopes: string[]
    projectId?: string
  }) => Promise<AnalyticsConnection>
  updateConnection: (id: string, updates: Partial<AnalyticsConnection>) => Promise<void>
  deleteConnection: (id: string) => Promise<void>

  // Getters
  getConnection: (id: string) => AnalyticsConnection | undefined
  getConnectionByPropertyId: (propertyId: string) => AnalyticsConnection | undefined
  getConnectionsByProject: (projectId: string) => AnalyticsConnection[]

  // Reports
  fetchReport: (connectionId: string, dateRange?: DateRange) => Promise<AnalyticsReport | undefined>
  getReport: (connectionId: string) => AnalyticsReport | undefined

  // Reset
  reset: () => void
}

const initialState: AnalyticsState = {
  connections: [],
  reports: {},
  loading: false,
  error: null,
  initialized: false,
}

export const useAnalyticsStore = create<AnalyticsState & AnalyticsActions>()((set, get) => ({
  ...initialState,

  fetchConnections: async () => {
    return dedup('analytics-connections', async () => {
      set({ loading: true, error: null })
      try {
        const res = await fetch(`${API_BASE}/connections`)
        if (!res.ok) throw new Error('Failed to fetch analytics connections')
        const data = await res.json()
        const connections = (data.connections || []) as AnalyticsConnection[]
        set({
          connections,
          loading: false,
          initialized: true,
        })
      } catch (error) {
        set({ error: (error as Error).message, loading: false })
      }
    })
  },

  createConnection: async (connectionData) => {
    set({ loading: true, error: null })
    try {
      const res = await fetch(`${API_BASE}/connections`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(connectionData),
      })
      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || 'Failed to create connection')
      }
      const data = await res.json()
      const newConnection = data.connection as AnalyticsConnection

      set((state) => ({
        connections: [newConnection, ...state.connections],
        loading: false,
      }))

      return newConnection
    } catch (error) {
      set({ error: (error as Error).message, loading: false })
      throw error
    }
  },

  updateConnection: async (id, updates) => {
    set({ loading: true, error: null })
    try {
      const res = await fetch(`${API_BASE}/connections/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || 'Failed to update connection')
      }
      const data = await res.json()
      const updatedConnection = data.connection as AnalyticsConnection

      set((state) => ({
        connections: state.connections.map((c) => (c.id === id ? updatedConnection : c)),
        loading: false,
      }))
    } catch (error) {
      set({ error: (error as Error).message, loading: false })
      throw error
    }
  },

  deleteConnection: async (id) => {
    set({ loading: true, error: null })
    try {
      const res = await fetch(`${API_BASE}/connections/${id}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || 'Failed to delete connection')
      }

      set((state) => ({
        connections: state.connections.filter((c) => c.id !== id),
        reports: Object.fromEntries(Object.entries(state.reports).filter(([key]) => key !== id)),
        loading: false,
      }))
    } catch (error) {
      set({ error: (error as Error).message, loading: false })
      throw error
    }
  },

  getConnection: (id) => get().connections.find((c) => c.id === id),

  getConnectionByPropertyId: (propertyId) =>
    get().connections.find((c) => c.propertyId === propertyId),

  getConnectionsByProject: (projectId) =>
    get().connections.filter((c) => c.projectId === projectId),

  fetchReport: async (connectionId, dateRange) => {
    try {
      const params = new URLSearchParams()
      if (dateRange?.preset) {
        params.set('preset', dateRange.preset)
      }
      if (dateRange?.startDate) {
        params.set('startDate', dateRange.startDate)
      }
      if (dateRange?.endDate) {
        params.set('endDate', dateRange.endDate)
      }

      const url = `${API_BASE}/connections/${connectionId}/report${
        params.toString() ? `?${params.toString()}` : ''
      }`
      const res = await fetch(url)
      if (!res.ok) return undefined

      const data = await res.json()
      const report = data.report as AnalyticsReport

      set((state) => ({
        reports: {
          ...state.reports,
          [connectionId]: report,
        },
      }))

      return report
    } catch {
      return undefined
    }
  },

  getReport: (connectionId) => get().reports[connectionId],

  reset: () => {
    set(initialState)
  },
}))

// Selector hooks for common queries
export const useAnalyticsConnections = () => useAnalyticsStore((state) => state.connections)
export const useAnalyticsLoading = () => useAnalyticsStore((state) => state.loading)
export const useAnalyticsError = () => useAnalyticsStore((state) => state.error)
export const useAnalyticsInitialized = () => useAnalyticsStore((state) => state.initialized)
