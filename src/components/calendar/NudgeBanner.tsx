'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { X, CalendarClock } from 'lucide-react'
import { useCommunityEventsStore } from '@/lib/communityEvents'
import type { CommunityEvent, EventSubscription } from '@/lib/communityEvents'
import { getNextOccurrence } from '@/lib/rrule'
import { cn } from '@/lib/utils'

interface NudgeBannerProps {
  className?: string
}

interface Nudge {
  event: CommunityEvent
  nextOccurrence: Date
  hoursUntil: number
}

/** Format hours-until into a human-readable string */
function formatTimeUntil(hoursUntil: number): string {
  if (hoursUntil < 1) return 'less than an hour away'
  if (hoursUntil < 2) return 'about 1 hour away'
  if (hoursUntil < 24) return `about ${Math.round(hoursUntil)} hours away`
  return 'tomorrow'
}

/** Check if a user has content scheduled around a given time for a platform */
async function hasScheduledContent(platform: string, around: Date): Promise<boolean> {
  const windowMs = 4 * 60 * 60 * 1000 // 4-hour window
  const start = new Date(around.getTime() - windowMs)
  const end = new Date(around.getTime() + windowMs)

  try {
    const res = await fetch(`/api/calendar?start=${start.toISOString()}&end=${end.toISOString()}`)
    if (!res.ok) return false
    const data = await res.json()
    const posts = data.posts || []
    return posts.some((p: { platform?: string }) => p.platform === platform)
  } catch {
    return false
  }
}

/** Find the most urgent nudge from subscriptions */
async function findUrgentNudge(
  subscriptions: EventSubscription[],
  events: CommunityEvent[]
): Promise<Nudge | null> {
  const now = new Date()
  const eventMap = new Map(events.map((e) => [e.id, e]))
  const candidates: Nudge[] = []

  for (const sub of subscriptions) {
    const event = sub.event || eventMap.get(sub.eventId)
    if (!event || !event.isActive) continue

    const next = getNextOccurrence(event.recurrenceRule, now)
    if (!next) continue

    const hoursUntil = (next.getTime() - now.getTime()) / (1000 * 60 * 60)
    if (hoursUntil < 0 || hoursUntil > 24) continue

    candidates.push({ event, nextOccurrence: next, hoursUntil })
  }

  // Sort by most urgent first
  candidates.sort((a, b) => a.hoursUntil - b.hoursUntil)

  // Check if user has scheduled content for each candidate
  for (const candidate of candidates) {
    const hasContent = await hasScheduledContent(candidate.event.platform, candidate.nextOccurrence)
    if (!hasContent) return candidate
  }

  return null
}

export function NudgeBanner({ className }: NudgeBannerProps) {
  const [nudge, setNudge] = useState<Nudge | null>(null)
  const [dismissed, setDismissed] = useState(false)
  const [checked, setChecked] = useState(false)

  const subscriptions = useCommunityEventsStore((s) => s.subscriptions)
  const events = useCommunityEventsStore((s) => s.events)
  const initialized = useCommunityEventsStore((s) => s.initialized)
  const fetchSubscriptions = useCommunityEventsStore((s) => s.fetchSubscriptions)

  // Fetch subscriptions on mount (subscriptions include joined event data)
  useEffect(() => {
    if (!initialized) {
      fetchSubscriptions()
    }
  }, [initialized, fetchSubscriptions])

  // Check for nudges when data is available
  useEffect(() => {
    if (!initialized || subscriptions.length === 0) return

    let cancelled = false
    findUrgentNudge(subscriptions, events).then((result) => {
      if (!cancelled) {
        setNudge(result)
        setChecked(true)
      }
    })
    return () => {
      cancelled = true
    }
  }, [initialized, subscriptions, events])

  // Derive loading: not initialized, or has subscriptions but hasn't checked yet
  const loading = !initialized || (subscriptions.length > 0 && !checked)

  // Don't render anything if loading, dismissed, or no nudge
  if (loading || dismissed || !nudge) return null

  const timeText = formatTimeUntil(nudge.hoursUntil)
  const targetText = nudge.event.target || nudge.event.platform

  return (
    <div
      className={cn(
        'relative p-4 rounded-lg',
        'bg-accent/10 border-[3px] border-accent',
        'shadow-[4px_4px_0_hsl(var(--accent))]',
        'animate-fade-in',
        className
      )}
    >
      <button
        onClick={() => setDismissed(true)}
        className={cn(
          'absolute top-2 right-2 p-1 rounded-md',
          'text-muted-foreground hover:text-foreground',
          'hover:bg-accent/20 transition-colors'
        )}
        aria-label="Dismiss nudge"
      >
        <X className="w-4 h-4" />
      </button>

      <div className="flex items-start gap-3 pr-8">
        <div className="p-2 rounded-lg bg-accent/20 shrink-0">
          <CalendarClock className="w-5 h-5 text-accent" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-foreground">
            {nudge.event.name} is {timeText}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            You have no content scheduled for {targetText}.
          </p>
          <Link
            href="/new"
            className={cn(
              'inline-flex items-center gap-1 mt-2 px-3 py-1.5 rounded-md text-xs font-bold',
              'bg-accent text-white',
              'border-2 border-border',
              'shadow-sticker-hover',
              'hover:-translate-y-px hover:shadow-sticker-sm',
              'transition-all duration-200'
            )}
          >
            Create Post
          </Link>
        </div>
      </div>
    </div>
  )
}
