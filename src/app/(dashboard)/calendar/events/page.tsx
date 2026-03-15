'use client'

import { useEffect, useState, useCallback } from 'react'
import { Megaphone, Loader2 } from 'lucide-react'
import { useCommunityEventsStore } from '@/lib/communityEvents'
import { EventBrowser } from '@/components/calendar/EventBrowser'

// eslint-disable-next-line max-lines-per-function -- component JSX rendering, extraction would fragment UI
export default function CommunityEventsPage() {
  const events = useCommunityEventsStore((s) => s.events)
  const subscriptions = useCommunityEventsStore((s) => s.subscriptions)
  const loading = useCommunityEventsStore((s) => s.loading)
  const error = useCommunityEventsStore((s) => s.error)
  const initialized = useCommunityEventsStore((s) => s.initialized)
  const fetchEvents = useCommunityEventsStore((s) => s.fetchEvents)
  const fetchSubscriptions = useCommunityEventsStore((s) => s.fetchSubscriptions)
  const subscribe = useCommunityEventsStore((s) => s.subscribe)
  const unsubscribe = useCommunityEventsStore((s) => s.unsubscribe)

  const [actionError, setActionError] = useState<string | null>(null)

  // Fetch events and subscriptions on mount
  useEffect(() => {
    if (!initialized) {
      fetchEvents()
    }
    fetchSubscriptions()
  }, [initialized, fetchEvents, fetchSubscriptions])

  const handleSubscribe = useCallback(
    async (eventId: string) => {
      setActionError(null)
      try {
        await subscribe(eventId)
      } catch (err) {
        setActionError((err as Error).message)
      }
    },
    [subscribe]
  )

  const handleUnsubscribe = useCallback(
    async (subscriptionId: string) => {
      setActionError(null)
      try {
        await unsubscribe(subscriptionId)
      } catch (err) {
        setActionError((err as Error).message)
      }
    },
    [unsubscribe]
  )

  return (
    <div className="min-h-[calc(100vh-4rem)] p-4 md:p-6 max-w-7xl mx-auto">
      {/* Page header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2.5 rounded-md bg-sticker-purple/10 border-[3px] border-border shadow-sticker-sm">
          <Megaphone className="w-5 h-5 text-sticker-purple" />
        </div>
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Community Events</h1>
          <p className="text-sm text-muted-foreground">
            Subscribe to recurring events and get notified when to post
          </p>
        </div>
      </div>

      {/* Error banner */}
      {(error || actionError) && (
        <div className="mb-4 p-3 rounded-md bg-destructive/10 border-2 border-destructive/30 text-sm font-medium text-destructive">
          {actionError || error}
          {actionError && (
            <button
              onClick={() => setActionError(null)}
              className="ml-2 underline text-xs font-bold"
            >
              Dismiss
            </button>
          )}
        </div>
      )}

      {/* Loading state */}
      {loading && !initialized ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
          <span className="ml-2 text-sm font-bold text-muted-foreground">Loading events...</span>
        </div>
      ) : (
        <EventBrowser
          events={events}
          subscriptions={subscriptions}
          onSubscribe={handleSubscribe}
          onUnsubscribe={handleUnsubscribe}
        />
      )}
    </div>
  )
}
