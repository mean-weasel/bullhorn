'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { AlertTriangle, X } from 'lucide-react'
import { usePlanStore } from '@/lib/planStore'
import { RESOURCE_LABELS } from '@/lib/limits'
import { cn } from '@/lib/utils'

export function UsageBanner() {
  const { fetchPlan, initialized, isNearAnyLimit } = usePlanStore()
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (!initialized) fetchPlan()
  }, [initialized, fetchPlan])

  const nearLimit = isNearAnyLimit()

  if (!nearLimit || dismissed) return null

  const label =
    RESOURCE_LABELS[nearLimit.resource as keyof typeof RESOURCE_LABELS] || nearLimit.resource

  return (
    <div
      className={cn(
        'flex items-center gap-3 px-4 py-2.5',
        'bg-sticker-orange/10 border-b-2 border-sticker-orange/30',
        'text-sm'
      )}
    >
      <AlertTriangle className="w-4 h-4 text-sticker-orange shrink-0" />
      <p className="flex-1 text-foreground">
        <span className="font-bold">{label}:</span> {nearLimit.current} of {nearLimit.limit} used.{' '}
        <Link href="/settings" className="text-primary font-bold hover:underline">
          View plan details
        </Link>
      </p>
      <button
        onClick={() => setDismissed(true)}
        className="p-1 rounded hover:bg-sticker-orange/20 transition-colors"
        aria-label="Dismiss"
      >
        <X className="w-4 h-4 text-muted-foreground" />
      </button>
    </div>
  )
}
