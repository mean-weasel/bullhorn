'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { Calendar, Bell, ChevronRight } from 'lucide-react'
import { format, addDays, startOfDay, isSameDay } from 'date-fns'
import { cn } from '@/lib/utils'
import { type Post, type Platform, PLATFORM_INFO } from '@/lib/posts'

interface Reminder {
  id: string
  title: string
  remindAt: string
  isCompleted: boolean
}

interface CalendarWidgetProps {
  posts: Post[]
  reminders: Reminder[]
  days?: number
}

/** Map platform → hex color for the dot */
const PLATFORM_DOT_COLOR: Record<Platform, string> = {
  twitter: '#1DA1F2',
  linkedin: '#0A66C2',
  reddit: '#FF4500',
}

interface DayData {
  date: Date
  isToday: boolean
  posts: Post[]
  reminders: Reminder[]
}

export function CalendarWidget({ posts, reminders, days = 7 }: CalendarWidgetProps) {
  const today = startOfDay(new Date())

  const dayRows: DayData[] = useMemo(() => {
    return Array.from({ length: days }, (_, i) => {
      const date = addDays(today, i)
      const dayPosts = posts.filter(
        (p) => p.scheduledAt && isSameDay(new Date(p.scheduledAt), date)
      )
      const dayReminders = reminders.filter(
        (r) => !r.isCompleted && isSameDay(new Date(r.remindAt), date)
      )
      return {
        date,
        isToday: i === 0,
        posts: dayPosts,
        reminders: dayReminders,
      }
    })
  }, [posts, reminders, days, today])

  return (
    <div className="sticker-card p-0 overflow-hidden animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b-[3px] border-border">
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-1.5 rounded-lg bg-sticker-blue/10 shrink-0">
            <Calendar className="w-4 h-4 text-sticker-blue" />
          </div>
          <h2 className="text-sm font-bold uppercase tracking-widest text-sticker-blue truncate">
            Week Ahead
          </h2>
        </div>
        <Link
          href="/posts?status=scheduled"
          className="text-xs font-medium text-muted-foreground hover:text-sticker-blue transition-colors flex items-center gap-1 whitespace-nowrap shrink-0"
        >
          View Calendar
          <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Day rows */}
      <div className="divide-y divide-border/50">
        {dayRows.map((day) => {
          const itemCount = day.posts.length + day.reminders.length
          const hasItems = itemCount > 0
          return (
            <div
              key={day.date.toISOString()}
              className={cn('flex items-center gap-3 px-4 py-2.5', day.isToday && 'bg-primary/10')}
            >
              {/* Day label */}
              <div
                className={cn(
                  'w-16 shrink-0 text-xs',
                  day.isToday
                    ? 'font-extrabold text-foreground'
                    : 'font-medium text-muted-foreground'
                )}
              >
                <span>{format(day.date, 'EEE')}</span> <span>{format(day.date, 'd')}</span>
              </div>

              {/* Dots + bells */}
              <div className="flex items-center gap-1 flex-1 min-w-0 flex-wrap">
                {hasItems ? (
                  <>
                    {day.posts.map((post) => (
                      <span
                        key={post.id}
                        title={`${PLATFORM_INFO[post.platform].label} post`}
                        className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                        style={{
                          backgroundColor: PLATFORM_DOT_COLOR[post.platform],
                        }}
                      />
                    ))}
                    {day.reminders.map((rem) => (
                      <span key={rem.id} title={rem.title} className="shrink-0">
                        <Bell className="w-3 h-3 text-sticker-pink" />
                      </span>
                    ))}
                  </>
                ) : (
                  <span className="text-xs text-muted-foreground/50 font-medium">&mdash;</span>
                )}
              </div>

              {/* Count */}
              {hasItems && (
                <span
                  className={cn(
                    'text-[10px] font-bold tabular-nums shrink-0',
                    day.isToday ? 'text-foreground' : 'text-muted-foreground'
                  )}
                >
                  {itemCount}
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
