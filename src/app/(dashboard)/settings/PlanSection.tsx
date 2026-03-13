'use client'

import { useEffect } from 'react'
import { Crown } from 'lucide-react'
import { usePlanStore } from '@/lib/planStore'
import { RESOURCE_LABELS } from '@/lib/limits'
import { type GenericResource } from '@/lib/planEnforcement'
import { cn } from '@/lib/utils'

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / Math.pow(1024, i)).toFixed(i > 1 ? 1 : 0)} ${units[i]}`
}

function UsageBar({
  label,
  current,
  limit,
  formatValue,
}: {
  label: string
  current: number
  limit: number
  formatValue?: (v: number) => string
}) {
  const pct = Math.min((current / limit) * 100, 100)
  const isNearLimit = pct >= 80
  const isAtLimit = current >= limit
  const fmt = formatValue || String

  return (
    <div>
      <div className="flex items-center justify-between text-sm mb-1.5">
        <span className="text-muted-foreground font-medium">{label}</span>
        <span
          className={cn(
            'font-bold text-xs',
            isAtLimit ? 'text-destructive' : isNearLimit ? 'text-amber-500' : 'text-foreground'
          )}
        >
          {fmt(current)} / {fmt(limit)}
        </span>
      </div>
      <div className="h-2.5 bg-muted rounded-full overflow-hidden border border-border">
        <div
          className={cn(
            'h-full rounded-full transition-all',
            isAtLimit
              ? 'bg-destructive'
              : isNearLimit
                ? 'bg-amber-500'
                : 'bg-linear-to-r from-[hsl(var(--gold))] to-[hsl(var(--gold-dark))]'
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

export function PlanSection() {
  const { plan, limits, storage, fetchPlan, initialized, loading } = usePlanStore()

  useEffect(() => {
    if (!initialized) {
      fetchPlan()
    }
  }, [initialized, fetchPlan])

  if (loading && !initialized) {
    return (
      <div className="p-6 rounded-md border-[3px] border-border bg-card shadow-sticker mb-6">
        <div className="h-6 w-32 bg-muted rounded animate-pulse mb-4" />
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-8 bg-muted rounded animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  const resourceKeys: (GenericResource | 'apiKeys')[] = [
    'posts',
    'campaigns',
    'projects',
    'blogDrafts',
    'launchPosts',
    'apiKeys',
  ]

  return (
    <div className="p-6 rounded-md border-[3px] border-border bg-card shadow-sticker mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-extrabold uppercase tracking-wider text-foreground">
          <Crown className="w-4 h-4 inline-block mr-1 -mt-0.5" /> Plan & Usage
        </h2>
        <span
          className={cn(
            'px-3 py-1 rounded-full text-xs font-bold border-2',
            plan === 'pro'
              ? 'bg-linear-to-r from-[hsl(var(--gold))] to-[hsl(var(--gold-dark))] text-primary-foreground border-[hsl(var(--gold-dark))]'
              : 'bg-muted text-muted-foreground border-border'
          )}
        >
          {plan === 'pro' ? 'Pro' : 'Free'}
        </span>
      </div>

      <div className="space-y-3 mb-4">
        {resourceKeys.map((key) => (
          <UsageBar
            key={key}
            label={RESOURCE_LABELS[key]}
            current={limits[key].current}
            limit={limits[key].limit}
          />
        ))}
        <UsageBar
          label={RESOURCE_LABELS.storageBytes}
          current={Number(storage.usedBytes)}
          limit={Number(storage.limitBytes)}
          formatValue={formatBytes}
        />
      </div>

      {plan === 'free' && (
        <div className="text-center">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">
            Free during beta
          </p>
          <p className="text-xs text-muted-foreground">Paid plans with higher limits coming soon</p>
        </div>
      )}
    </div>
  )
}
