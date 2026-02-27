'use client'

import { cn } from '@/lib/utils'
import type { CommunityEvent, EventSubscription } from '@/lib/communityEvents'

interface EventCardProps {
  event: CommunityEvent
  subscription?: EventSubscription
  onSubscribe: (eventId: string) => void
  onUnsubscribe: (subscriptionId: string) => void
}

const PLATFORM_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  twitter: { bg: 'bg-twitter/10', text: 'text-twitter', border: 'border-twitter/40' },
  linkedin: { bg: 'bg-linkedin/10', text: 'text-linkedin', border: 'border-linkedin/40' },
  reddit: { bg: 'bg-reddit/10', text: 'text-reddit', border: 'border-reddit/40' },
}

const PLATFORM_LABELS: Record<string, string> = {
  twitter: 'Twitter',
  linkedin: 'LinkedIn',
  reddit: 'Reddit',
}

const DAY_NAMES: Record<string, string> = {
  MO: 'Monday',
  TU: 'Tuesday',
  WE: 'Wednesday',
  TH: 'Thursday',
  FR: 'Friday',
  SA: 'Saturday',
  SU: 'Sunday',
}

/** Convert an RRULE string to human-readable text. */
export function formatRecurrenceRule(rule: string): string {
  const parts = rule.replace(/^RRULE:/, '').split(';')
  const params: Record<string, string> = {}
  for (const part of parts) {
    const [key, val] = part.split('=')
    if (key && val) params[key] = val
  }

  const freq = params.FREQ
  const byDay = params.BYDAY
  const interval = params.INTERVAL ? parseInt(params.INTERVAL, 10) : 1

  if (freq === 'WEEKLY' && byDay) {
    const days = byDay.split(',').map((d) => DAY_NAMES[d] || d)
    const prefix = interval > 1 ? `Every ${interval} weeks on` : 'Every'
    return `${prefix} ${days.join(', ')}`
  }
  if (freq === 'DAILY') {
    return interval > 1 ? `Every ${interval} days` : 'Every day'
  }
  if (freq === 'MONTHLY') {
    return interval > 1 ? `Every ${interval} months` : 'Every month'
  }
  if (freq === 'WEEKLY') {
    return interval > 1 ? `Every ${interval} weeks` : 'Every week'
  }
  return rule
}

export function EventCard({ event, subscription, onSubscribe, onUnsubscribe }: EventCardProps) {
  const style = PLATFORM_STYLES[event.platform] || PLATFORM_STYLES.twitter

  return (
    <div className="sticker-card-hover p-4 bg-card flex flex-col gap-2">
      {/* Platform badge + subscription indicator */}
      <div className="flex items-center justify-between">
        <span
          className={cn(
            'sticker-badge text-[11px] font-extrabold uppercase tracking-wider px-2.5 py-0.5',
            style.bg,
            style.text,
            style.border
          )}
        >
          {PLATFORM_LABELS[event.platform] || event.platform}
        </span>
        {subscription && (
          <span className="text-[10px] font-bold text-sticker-green uppercase tracking-wider">
            Subscribed
          </span>
        )}
      </div>

      {/* Event name */}
      <h3 className="text-sm font-extrabold leading-tight">{event.name}</h3>

      {/* Target (subreddit, hashtag, etc.) */}
      {event.target && <p className="text-xs font-bold text-muted-foreground">{event.target}</p>}

      {/* Recurrence description */}
      <p className="text-xs text-muted-foreground">{formatRecurrenceRule(event.recurrenceRule)}</p>

      {/* Tags */}
      {event.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {event.tags.map((tag) => (
            <span
              key={tag}
              className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-secondary text-muted-foreground border border-border"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Subscribe / Unsubscribe button */}
      <div className="mt-1">
        {subscription ? (
          <button
            onClick={() => onUnsubscribe(subscription.id)}
            className={cn(
              'sticker-button w-full text-xs py-1.5',
              'bg-secondary text-muted-foreground hover:bg-destructive/10 hover:text-destructive'
            )}
          >
            Unsubscribe
          </button>
        ) : (
          <button
            onClick={() => onSubscribe(event.id)}
            className="sticker-button w-full text-xs py-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
          >
            Subscribe
          </button>
        )}
      </div>
    </div>
  )
}
