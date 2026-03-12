'use client'

import { useState, useMemo } from 'react'
import { Search, Calendar } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { CommunityEvent, EventSubscription } from '@/lib/communityEvents'
import { EventCard } from './EventCard'

type PlatformFilter = 'all' | 'twitter' | 'linkedin' | 'reddit'

interface EventBrowserProps {
  events: CommunityEvent[]
  subscriptions: EventSubscription[]
  onSubscribe: (eventId: string) => void
  onUnsubscribe: (subscriptionId: string) => void
}

const FILTER_TABS: { value: PlatformFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'twitter', label: 'Twitter' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'reddit', label: 'Reddit' },
]

const TAB_ACTIVE_STYLES: Record<PlatformFilter, string> = {
  all: 'bg-primary text-primary-foreground',
  twitter: 'bg-twitter text-white',
  linkedin: 'bg-linkedin text-white',
  reddit: 'bg-reddit text-white',
}

export function EventBrowser({
  events,
  subscriptions,
  onSubscribe,
  onUnsubscribe,
}: EventBrowserProps) {
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>('all')
  const [searchQuery, setSearchQuery] = useState('')

  const subscriptionsByEventId = useMemo(() => {
    const map = new Map<string, EventSubscription>()
    for (const sub of subscriptions) {
      map.set(sub.eventId, sub)
    }
    return map
  }, [subscriptions])

  const filteredEvents = useMemo(() => {
    let result = events
    if (platformFilter !== 'all') {
      result = result.filter((e) => e.platform === platformFilter)
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(
        (e) =>
          e.name.toLowerCase().includes(q) ||
          (e.target && e.target.toLowerCase().includes(q)) ||
          e.tags.some((t) => t.toLowerCase().includes(q))
      )
    }
    return result
  }, [events, platformFilter, searchQuery])

  return (
    <div className="space-y-4">
      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search events..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="sticker-input w-full pl-9 pr-4 py-2.5 text-sm"
        />
      </div>

      {/* Platform filter tabs */}
      <div className="flex items-center gap-1 border-[3px] border-border rounded-md overflow-hidden shadow-sticker-sm">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setPlatformFilter(tab.value)}
            className={cn(
              'flex-1 px-3 py-2 text-xs font-bold transition-colors',
              platformFilter === tab.value
                ? TAB_ACTIVE_STYLES[tab.value]
                : 'bg-card text-muted-foreground hover:text-foreground hover:bg-secondary'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Event grid */}
      {filteredEvents.length === 0 ? (
        <div className="text-center py-12 px-4">
          <div className="w-14 h-14 mx-auto mb-4 rounded-md bg-secondary flex items-center justify-center border-[3px] border-border shadow-sticker-sm">
            <Calendar className="w-7 h-7 text-muted-foreground" />
          </div>
          <p className="text-sm font-bold text-muted-foreground">
            {searchQuery || platformFilter !== 'all'
              ? 'No events match your filter'
              : 'No community events available'}
          </p>
          {(searchQuery || platformFilter !== 'all') && (
            <button
              onClick={() => {
                setSearchQuery('')
                setPlatformFilter('all')
              }}
              className="mt-2 text-xs font-bold text-primary hover:underline"
            >
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredEvents.map((event) => (
            <EventCard
              key={event.id}
              event={event}
              subscription={subscriptionsByEventId.get(event.id)}
              onSubscribe={onSubscribe}
              onUnsubscribe={onUnsubscribe}
            />
          ))}
        </div>
      )}
    </div>
  )
}
