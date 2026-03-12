'use client'

import { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  addWeeks,
  subWeeks,
  isSameMonth,
  isToday,
  isBefore,
  startOfDay,
} from 'date-fns'
import { ChevronLeft, ChevronRight, Bell, Megaphone } from 'lucide-react'
import { Post, getPostPreviewText } from '@/lib/posts'
import { cn } from '@/lib/utils'
import type { CommunityEvent, EventSubscription } from '@/lib/communityEvents'
import { getOccurrencesInRange } from '@/lib/rrule'

export interface CalendarReminder {
  id: string
  title: string
  remindAt: string
  isCompleted: boolean
}

export interface SubscribedEventEntry {
  event: CommunityEvent
  subscription: EventSubscription
}

interface CalendarViewProps {
  posts: Post[]
  reminders?: CalendarReminder[]
  subscribedEvents?: SubscribedEventEntry[]
  currentDate: Date
  onDateChange: (date: Date) => void
  viewMode?: 'month' | 'week'
  onViewModeChange?: (mode: 'month' | 'week') => void
}

/** Sticker-styled platform badge for a post in the calendar. */
function PostBadge({ post, onClick }: { post: Post; onClick: (e: React.MouseEvent) => void }) {
  return (
    <div
      className={cn(
        'flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold truncate border',
        post.platform === 'twitter' && 'bg-twitter/10 text-twitter border-twitter/30',
        post.platform === 'linkedin' && 'bg-linkedin/10 text-linkedin border-linkedin/30',
        post.platform === 'reddit' && 'bg-reddit/10 text-reddit border-reddit/30'
      )}
      onClick={onClick}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {getPostPreviewText(post).slice(0, 20)}
    </div>
  )
}

/** Bell icon badge for a reminder in the calendar. */
function ReminderBadge({ reminder }: { reminder: CalendarReminder }) {
  return (
    <div
      className={cn(
        'flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold truncate border',
        'bg-accent/10 text-accent border-accent/30',
        reminder.isCompleted && 'opacity-50 line-through'
      )}
      title={reminder.title}
    >
      <Bell className="w-2.5 h-2.5 shrink-0" />
      {reminder.title.slice(0, 20)}
    </div>
  )
}

/** Toggle button group for switching between month and week view. */
function ViewModeToggle({
  viewMode,
  onViewModeChange,
}: {
  viewMode: 'month' | 'week'
  onViewModeChange: (mode: 'month' | 'week') => void
}) {
  return (
    <div className="flex items-center border-2 border-border rounded-md overflow-hidden">
      {(['month', 'week'] as const).map((mode) => (
        <button
          key={mode}
          onClick={() => onViewModeChange(mode)}
          className={cn(
            'px-3 py-1.5 text-xs font-bold capitalize transition-colors',
            viewMode === mode
              ? 'bg-primary text-primary-foreground'
              : 'hover:bg-accent/20 text-muted-foreground'
          )}
        >
          {mode}
        </button>
      ))}
    </div>
  )
}

/** Groups posts by yyyy-MM-dd date key. */
function groupPostsByDate(posts: Post[]) {
  return posts.reduce(
    (acc, post) => {
      if (post.scheduledAt) {
        const date = format(new Date(post.scheduledAt), 'yyyy-MM-dd')
        if (!acc[date]) acc[date] = []
        acc[date].push(post)
      }
      return acc
    },
    {} as Record<string, Post[]>
  )
}

/** Groups reminders by yyyy-MM-dd date key. */
function groupRemindersByDate(reminders: CalendarReminder[]) {
  return reminders.reduce(
    (acc, reminder) => {
      const date = format(new Date(reminder.remindAt), 'yyyy-MM-dd')
      if (!acc[date]) acc[date] = []
      acc[date].push(reminder)
      return acc
    },
    {} as Record<string, CalendarReminder[]>
  )
}

/** Expand subscribed events into a date-keyed map of event names + platforms. */
function expandEventsByDate(
  entries: SubscribedEventEntry[],
  rangeStart: Date,
  rangeEnd: Date
): Record<string, { name: string; platform: string }[]> {
  const result: Record<string, { name: string; platform: string }[]> = {}
  for (const { event } of entries) {
    const dates = getOccurrencesInRange(event.recurrenceRule, rangeStart, rangeEnd)
    for (const d of dates) {
      const key = format(d, 'yyyy-MM-dd')
      if (!result[key]) result[key] = []
      result[key].push({ name: event.name, platform: event.platform })
    }
  }
  return result
}

/** Small colored dot representing a community event on a calendar day. */
function EventDot({ name, platform }: { name: string; platform: string }) {
  return (
    <div
      className={cn(
        'flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold truncate border',
        'bg-sticker-purple/10 border-sticker-purple/30 text-sticker-purple',
        platform === 'twitter' && 'bg-twitter/5 border-twitter/20 text-twitter',
        platform === 'linkedin' && 'bg-linkedin/5 border-linkedin/20 text-linkedin',
        platform === 'reddit' && 'bg-reddit/5 border-reddit/20 text-reddit'
      )}
      title={name}
    >
      <Megaphone className="w-2.5 h-2.5 shrink-0" />
      {name.slice(0, 16)}
    </div>
  )
}

/** A single day cell in the month grid. */
function MonthDayCell({
  day,
  currentDate,
  dayPosts,
  dayReminders,
  dayEvents = [],
}: {
  day: Date
  currentDate: Date
  dayPosts: Post[]
  dayReminders: CalendarReminder[]
  dayEvents?: { name: string; platform: string }[]
}) {
  const router = useRouter()
  const dateKey = format(day, 'yyyy-MM-dd')
  const isCurrentMonth = isSameMonth(day, currentDate)
  const isCurrentDay = isToday(day)
  const isPast = isBefore(startOfDay(day), startOfDay(new Date())) && !isCurrentDay
  const totalItems = dayPosts.length + dayReminders.length + dayEvents.length
  const maxVisible = 3
  const visiblePosts = dayPosts.slice(0, maxVisible)
  const slotsAfterPosts = maxVisible - visiblePosts.length
  const visibleReminders = dayReminders.slice(0, Math.max(0, slotsAfterPosts))
  const slotsAfterReminders = slotsAfterPosts - visibleReminders.length
  const visibleEvents = dayEvents.slice(0, Math.max(0, slotsAfterReminders))
  const overflow = totalItems - visiblePosts.length - visibleReminders.length - visibleEvents.length

  return (
    <div
      role={!isPast ? 'button' : undefined}
      tabIndex={!isPast ? 0 : undefined}
      aria-label={!isPast ? `Create post on ${format(day, 'MMMM d, yyyy')}` : undefined}
      onClick={() => !isPast && router.push(`/new?date=${dateKey}`)}
      onKeyDown={
        !isPast
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                router.push(`/new?date=${dateKey}`)
              }
            }
          : undefined
      }
      className={cn(
        'min-h-[80px] md:min-h-[100px] p-1.5 md:p-2 border-r border-b border-border',
        'flex flex-col gap-1 transition-colors',
        !isPast && 'cursor-pointer hover:bg-primary/5',
        isPast && 'cursor-default',
        !isCurrentMonth && 'opacity-30',
        isCurrentDay && 'bg-primary/10'
      )}
    >
      <span
        className={cn(
          'text-sm font-bold text-muted-foreground',
          isCurrentDay &&
            'w-6 h-6 rounded-md bg-primary text-primary-foreground flex items-center justify-center'
        )}
      >
        {format(day, 'd')}
      </span>
      <div className="flex flex-col gap-0.5 mt-auto">
        {visiblePosts.map((post) => (
          <PostBadge
            key={post.id}
            post={post}
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              router.push(`/edit/${post.id}`)
            }}
          />
        ))}
        {visibleReminders.map((r) => (
          <ReminderBadge key={r.id} reminder={r} />
        ))}
        {visibleEvents.map((evt, idx) => (
          <EventDot key={`evt-${idx}`} name={evt.name} platform={evt.platform} />
        ))}
        {overflow > 0 && (
          <span className="text-[10px] text-muted-foreground font-medium">+{overflow} more</span>
        )}
      </div>
    </div>
  )
}

/** Month grid: 7-column layout with weekday headers. */
function MonthGrid({
  currentDate,
  postsByDate,
  remindersByDate,
  eventsByDate = {},
}: {
  currentDate: Date
  postsByDate: Record<string, Post[]>
  remindersByDate: Record<string, CalendarReminder[]>
  eventsByDate?: Record<string, { name: string; platform: string }[]>
}) {
  const monthStart = startOfMonth(currentDate)
  const monthEnd = endOfMonth(currentDate)
  const calendarDays = eachDayOfInterval({ start: monthStart, end: monthEnd })
  const startPadding = monthStart.getDay()
  const paddedDays: (Date | null)[] = Array(startPadding).fill(null).concat(calendarDays)

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[560px]">
        <div className="grid grid-cols-7 border-b-2 border-border bg-secondary/50">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
            <div
              key={d}
              className="py-3 text-center text-xs font-extrabold uppercase tracking-wider text-muted-foreground"
            >
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {paddedDays.map((day, i) => {
            if (!day) {
              return (
                <div
                  key={`pad-${i}`}
                  className="aspect-square border-r border-b border-border opacity-30"
                />
              )
            }
            const dateKey = format(day, 'yyyy-MM-dd')
            return (
              <MonthDayCell
                key={dateKey}
                day={day}
                currentDate={currentDate}
                dayPosts={postsByDate[dateKey] || []}
                dayReminders={remindersByDate[dateKey] || []}
                dayEvents={eventsByDate[dateKey] || []}
              />
            )
          })}
        </div>
      </div>
    </div>
  )
}

/** A single day row in week view with time-sorted items. */
function WeekDayRow({
  day,
  dayPosts,
  dayReminders,
  dayEvents = [],
}: {
  day: Date
  dayPosts: Post[]
  dayReminders: CalendarReminder[]
  dayEvents?: { name: string; platform: string }[]
}) {
  const router = useRouter()
  const isCurrentDay = isToday(day)
  const isPast = isBefore(startOfDay(day), startOfDay(new Date())) && !isCurrentDay
  const dateKey = format(day, 'yyyy-MM-dd')

  type TimeItem =
    | { kind: 'post'; time: Date; post: Post }
    | { kind: 'reminder'; time: Date; reminder: CalendarReminder }

  const items: TimeItem[] = [
    ...dayPosts.map((p) => ({
      kind: 'post' as const,
      time: new Date(p.scheduledAt!),
      post: p,
    })),
    ...dayReminders.map((r) => ({
      kind: 'reminder' as const,
      time: new Date(r.remindAt),
      reminder: r,
    })),
  ].sort((a, b) => a.time.getTime() - b.time.getTime())

  const hasContent = items.length > 0 || dayEvents.length > 0

  return (
    <div
      className={cn(
        'flex gap-4 p-3 border-b-2 border-border transition-colors',
        isCurrentDay && 'bg-primary/10',
        !isPast && 'hover:bg-primary/5'
      )}
    >
      <div className="w-20 shrink-0 text-center">
        <div className="text-xs font-extrabold uppercase text-muted-foreground">
          {format(day, 'EEE')}
        </div>
        <div
          className={cn(
            'text-2xl font-extrabold',
            isCurrentDay && 'text-primary',
            isPast && 'text-muted-foreground'
          )}
        >
          {format(day, 'd')}
        </div>
        <div className="text-[10px] text-muted-foreground">{format(day, 'MMM')}</div>
      </div>

      <div className="flex-1 flex flex-col gap-1 min-h-[48px]">
        {!hasContent && (
          <div
            onClick={() => !isPast && router.push(`/new?date=${dateKey}`)}
            className={cn(
              'text-xs text-muted-foreground italic py-2',
              !isPast && 'cursor-pointer hover:text-foreground'
            )}
          >
            {isPast ? 'No items' : 'Click to add a post'}
          </div>
        )}
        {dayEvents.map((evt, idx) => (
          <WeekEventItem key={`evt-${idx}`} name={evt.name} platform={evt.platform} />
        ))}
        {items.map((item) => {
          if (item.kind === 'post') {
            return <WeekPostItem key={item.post.id} post={item.post} time={item.time} />
          }
          return (
            <WeekReminderItem key={item.reminder.id} reminder={item.reminder} time={item.time} />
          )
        })}
      </div>
    </div>
  )
}

/** A post item rendered in week view with time and platform dot. */
function WeekPostItem({ post, time }: { post: Post; time: Date }) {
  const router = useRouter()
  return (
    <div
      onClick={() => router.push(`/edit/${post.id}`)}
      className={cn(
        'flex items-center gap-2 px-2 py-1.5 rounded border cursor-pointer',
        'hover:shadow-sticker-hover transition-all',
        post.platform === 'twitter' && 'bg-twitter/10 border-twitter/30',
        post.platform === 'linkedin' && 'bg-linkedin/10 border-linkedin/30',
        post.platform === 'reddit' && 'bg-reddit/10 border-reddit/30'
      )}
    >
      <span
        className={cn(
          'w-2 h-2 rounded-full shrink-0',
          post.platform === 'twitter' && 'bg-twitter',
          post.platform === 'linkedin' && 'bg-linkedin',
          post.platform === 'reddit' && 'bg-reddit'
        )}
      />
      <span className="text-[11px] font-bold text-muted-foreground w-12 shrink-0">
        {format(time, 'h:mm a')}
      </span>
      <span className="text-xs font-semibold truncate">
        {getPostPreviewText(post).slice(0, 50)}
      </span>
    </div>
  )
}

/** A reminder item rendered in week view with time and bell icon. */
function WeekReminderItem({ reminder, time }: { reminder: CalendarReminder; time: Date }) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 px-2 py-1.5 rounded border',
        'bg-accent/10 border-accent/30',
        reminder.isCompleted && 'opacity-50'
      )}
      title={reminder.title}
    >
      <Bell className="w-3 h-3 text-accent shrink-0" />
      <span className="text-[11px] font-bold text-muted-foreground w-12 shrink-0">
        {format(time, 'h:mm a')}
      </span>
      <span
        className={cn('text-xs font-semibold truncate', reminder.isCompleted && 'line-through')}
      >
        {reminder.title.slice(0, 50)}
      </span>
    </div>
  )
}

/** A community event item rendered in week view. */
function WeekEventItem({ name, platform }: { name: string; platform: string }) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 px-2 py-1.5 rounded border',
        'bg-sticker-purple/10 border-sticker-purple/30',
        platform === 'twitter' && 'bg-twitter/5 border-twitter/20',
        platform === 'linkedin' && 'bg-linkedin/5 border-linkedin/20',
        platform === 'reddit' && 'bg-reddit/5 border-reddit/20'
      )}
      title={name}
    >
      <Megaphone className="w-3 h-3 text-sticker-purple shrink-0" />
      <span className="text-[11px] font-bold text-muted-foreground w-12 shrink-0">Event</span>
      <span className="text-xs font-semibold truncate">{name.slice(0, 50)}</span>
    </div>
  )
}

/** Week view: vertical list of 7 days with time-sorted posts and reminders. */
function WeekGrid({
  currentDate,
  postsByDate,
  remindersByDate,
  eventsByDate = {},
}: {
  currentDate: Date
  postsByDate: Record<string, Post[]>
  remindersByDate: Record<string, CalendarReminder[]>
  eventsByDate?: Record<string, { name: string; platform: string }[]>
}) {
  const weekStart = startOfWeek(currentDate)
  const weekEnd = endOfWeek(currentDate)
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd })

  return (
    <div>
      {weekDays.map((day) => {
        const dateKey = format(day, 'yyyy-MM-dd')
        return (
          <WeekDayRow
            key={dateKey}
            day={day}
            dayPosts={postsByDate[dateKey] || []}
            dayReminders={remindersByDate[dateKey] || []}
            dayEvents={eventsByDate[dateKey] || []}
          />
        )
      })}
    </div>
  )
}

export function CalendarView({
  posts,
  reminders = [],
  subscribedEvents = [],
  currentDate,
  onDateChange,
  viewMode = 'month',
  onViewModeChange,
}: CalendarViewProps) {
  const postsByDate = groupPostsByDate(posts)
  const remindersByDate = groupRemindersByDate(reminders)
  const isWeek = viewMode === 'week'

  // Expand subscribed community events into the current view range
  const eventsByDate = useMemo(() => {
    if (subscribedEvents.length === 0) return {}
    const rangeStart = isWeek ? startOfWeek(currentDate) : startOfMonth(currentDate)
    const rangeEnd = isWeek ? endOfWeek(currentDate) : endOfMonth(currentDate)
    return expandEventsByDate(subscribedEvents, rangeStart, rangeEnd)
  }, [subscribedEvents, currentDate, isWeek])

  const navigatePrev = () => {
    if (isWeek) {
      onDateChange(subWeeks(currentDate, 1))
    } else {
      const next = new Date(currentDate)
      next.setMonth(next.getMonth() - 1)
      onDateChange(next)
    }
  }

  const navigateNext = () => {
    if (isWeek) {
      onDateChange(addWeeks(currentDate, 1))
    } else {
      const next = new Date(currentDate)
      next.setMonth(next.getMonth() + 1)
      onDateChange(next)
    }
  }

  const headerLabel = isWeek
    ? `${format(startOfWeek(currentDate), 'MMM d')} - ${format(endOfWeek(currentDate), 'MMM d, yyyy')}`
    : format(currentDate, 'MMMM yyyy')

  return (
    <div className="bg-card border-[3px] border-border rounded-md shadow-sticker overflow-hidden">
      {/* Calendar header */}
      <div className="flex items-center justify-between p-4 border-b-[3px] border-border bg-primary/5">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-extrabold tracking-tight">{headerLabel}</h2>
          <div className="flex items-center gap-1">
            <button
              onClick={navigatePrev}
              aria-label={isWeek ? 'Previous week' : 'Previous month'}
              className={cn(
                'p-1.5 rounded-md',
                'text-muted-foreground hover:text-foreground',
                'hover:bg-accent border-2 border-transparent hover:border-border',
                'transition-all'
              )}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => onDateChange(new Date())}
              className={cn(
                'px-3 py-1.5 text-xs font-bold rounded-md',
                'hover:bg-accent border-2 border-transparent hover:border-border',
                'transition-all'
              )}
            >
              Today
            </button>
            <button
              onClick={navigateNext}
              aria-label={isWeek ? 'Next week' : 'Next month'}
              className={cn(
                'p-1.5 rounded-md',
                'text-muted-foreground hover:text-foreground',
                'hover:bg-accent border-2 border-transparent hover:border-border',
                'transition-all'
              )}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
        {onViewModeChange && (
          <ViewModeToggle viewMode={viewMode} onViewModeChange={onViewModeChange} />
        )}
      </div>

      {/* Calendar body */}
      {isWeek ? (
        <WeekGrid
          currentDate={currentDate}
          postsByDate={postsByDate}
          remindersByDate={remindersByDate}
          eventsByDate={eventsByDate}
        />
      ) : (
        <MonthGrid
          currentDate={currentDate}
          postsByDate={postsByDate}
          remindersByDate={remindersByDate}
          eventsByDate={eventsByDate}
        />
      )}
    </div>
  )
}
