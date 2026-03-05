// Analytics type definitions

export type AnalyticsProvider = 'google_analytics'

export type SyncStatus = 'pending' | 'syncing' | 'success' | 'error'

/**
 * Analytics connection - represents an OAuth connection to an analytics provider
 */
export interface AnalyticsConnection {
  id: string
  userId: string
  provider: AnalyticsProvider
  propertyId: string
  propertyName?: string
  scopes: string[]
  projectId?: string
  lastSyncAt?: string
  syncStatus: SyncStatus
  syncError?: string
  createdAt: string
  updatedAt: string
}

/**
 * GA4 Metrics - core metrics from Google Analytics 4
 */
export interface GA4Metrics {
  activeUsers: number
  sessions: number
  pageViews: number
  screenPageViews: number
  engagementRate: number
  averageSessionDuration: number
  bounceRate: number
  newUsers: number
  totalUsers: number
  eventCount: number
}

/**
 * GA4 Dimension Row - for breakdown reports
 */
export interface GA4DimensionRow {
  dimension: string
  metrics: Partial<GA4Metrics>
}

/**
 * Analytics Report - date-ranged metrics response
 */
export interface AnalyticsReport {
  connectionId: string
  propertyId: string
  propertyName?: string
  dateRange: {
    startDate: string
    endDate: string
  }
  metrics: GA4Metrics
  topPages?: GA4DimensionRow[]
  topSources?: GA4DimensionRow[]
  fetchedAt: string
}

/**
 * Date range presets for reports
 */
export type DateRangePreset = '7d' | '28d' | '90d' | 'custom'

export interface DateRange {
  preset: DateRangePreset
  startDate?: string
  endDate?: string
}
