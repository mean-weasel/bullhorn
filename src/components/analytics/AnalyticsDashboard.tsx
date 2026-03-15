'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  BarChart3,
  Users,
  Eye,
  Clock,
  TrendingUp,
  RefreshCw,
  Loader2,
  AlertCircle,
} from 'lucide-react'
import { useAnalyticsStore } from '@/lib/analyticsStore'
import { DateRangePreset } from '@/lib/analytics.types'
import { cn } from '@/lib/utils'

interface AnalyticsDashboardProps {
  connectionId: string
  className?: string
  compact?: boolean
}

const DATE_RANGE_OPTIONS: { value: DateRangePreset; label: string }[] = [
  { value: '7d', label: 'Last 7 days' },
  { value: '28d', label: 'Last 28 days' },
  { value: '90d', label: 'Last 90 days' },
]

function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M'
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K'
  }
  return num.toLocaleString()
}

function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${Math.round(seconds)}s`
  }
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = Math.round(seconds % 60)
  return `${minutes}m ${remainingSeconds}s`
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`
}

interface MetricCardProps {
  label: string
  value: string | number
  icon: React.ReactNode
  trend?: 'up' | 'down' | 'neutral'
  compact?: boolean
}

function MetricCard({ label, value, icon, compact = false }: MetricCardProps) {
  return (
    <div className={cn('bg-card border border-border rounded-xl', compact ? 'p-3' : 'p-4')}>
      <div className="flex items-center gap-2 mb-2">
        <div className="text-muted-foreground">{icon}</div>
        <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
      </div>
      <div
        className={cn(
          'font-display font-bold text-[hsl(var(--gold-dark))]',
          compact ? 'text-xl' : 'text-2xl'
        )}
      >
        {value}
      </div>
    </div>
  )
}

// eslint-disable-next-line max-lines-per-function
export function AnalyticsDashboard({
  connectionId,
  className,
  compact = false,
}: AnalyticsDashboardProps) {
  const [dateRange, setDateRange] = useState<DateRangePreset>('28d')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const { fetchReport, getReport, getConnection } = useAnalyticsStore()
  const connection = getConnection(connectionId)
  const report = getReport(connectionId)

  const loadReport = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const result = await fetchReport(connectionId, { preset: dateRange })
      if (!result) {
        setError('Failed to fetch analytics data')
      }
    } catch (err) {
      setError((err as Error).message || 'Failed to fetch analytics')
    } finally {
      setIsLoading(false)
    }
  }, [connectionId, dateRange, fetchReport])

  useEffect(() => {
    loadReport()
  }, [loadReport])

  const handleRefresh = () => {
    loadReport()
  }

  if (!connection) {
    return (
      <div className={cn('text-muted-foreground text-center py-8', className)}>
        Connection not found
      </div>
    )
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-blue-500" />
          <h3 className="font-semibold">{connection.propertyName || 'Analytics'}</h3>
        </div>
        <div className="flex items-center gap-2">
          {/* Date range selector */}
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value as DateRangePreset)}
            className={cn(
              'px-3 py-1.5 text-sm rounded-lg',
              'bg-background border border-border',
              'focus:outline-hidden focus:ring-2 focus:ring-[hsl(var(--gold))]/50'
            )}
          >
            {DATE_RANGE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          {/* Refresh button */}
          <button
            onClick={handleRefresh}
            disabled={isLoading}
            className={cn(
              'p-1.5 rounded-lg',
              'text-muted-foreground hover:text-foreground',
              'hover:bg-muted transition-colors',
              isLoading && 'opacity-50 cursor-not-allowed'
            )}
            title="Refresh data"
          >
            <RefreshCw className={cn('w-4 h-4', isLoading && 'animate-spin')} />
          </button>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Loading state */}
      {isLoading && !report && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">Loading analytics...</span>
        </div>
      )}

      {/* Metrics grid */}
      {report && (
        <div className={cn('grid gap-3', compact ? 'grid-cols-2' : 'grid-cols-2 md:grid-cols-4')}>
          <MetricCard
            label="Active Users"
            value={formatNumber(report.metrics.activeUsers)}
            icon={<Users className="w-4 h-4" />}
            compact={compact}
          />
          <MetricCard
            label="Sessions"
            value={formatNumber(report.metrics.sessions)}
            icon={<TrendingUp className="w-4 h-4" />}
            compact={compact}
          />
          <MetricCard
            label="Page Views"
            value={formatNumber(report.metrics.pageViews)}
            icon={<Eye className="w-4 h-4" />}
            compact={compact}
          />
          <MetricCard
            label="Avg. Duration"
            value={formatDuration(report.metrics.averageSessionDuration)}
            icon={<Clock className="w-4 h-4" />}
            compact={compact}
          />
          {!compact && (
            <>
              <MetricCard
                label="New Users"
                value={formatNumber(report.metrics.newUsers)}
                icon={<Users className="w-4 h-4" />}
              />
              <MetricCard
                label="Total Users"
                value={formatNumber(report.metrics.totalUsers)}
                icon={<Users className="w-4 h-4" />}
              />
              <MetricCard
                label="Engagement Rate"
                value={formatPercent(report.metrics.engagementRate)}
                icon={<TrendingUp className="w-4 h-4" />}
              />
              <MetricCard
                label="Bounce Rate"
                value={formatPercent(report.metrics.bounceRate)}
                icon={<TrendingUp className="w-4 h-4" />}
              />
            </>
          )}
        </div>
      )}

      {/* Last synced info */}
      {report && (
        <div className="text-xs text-muted-foreground text-right">
          Last updated: {new Date(report.fetchedAt).toLocaleString()}
        </div>
      )}
    </div>
  )
}
