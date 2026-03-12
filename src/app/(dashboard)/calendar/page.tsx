'use client'

import { useEffect, useState, useMemo } from 'react'
import { format, isToday, isSameDay } from 'date-fns'
import { Calendar, Bell } from 'lucide-react'
import { useCalendarStore } from '@/lib/calendarStore'
import { useRemindersStore } from '@/lib/reminders'
import { getPostPreviewText } from '@/lib/posts'
import { cn } from '@/lib/utils'
import { CalendarView } from '../posts/CalendarView'

type ViewMode = 'month' | 'week'

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [viewMode, setViewMode] = useState<ViewMode>('month')

  // Calendar store — fetches posts + reminders via /api/calendar
  const calendarPosts = useCalendarStore((s) => s.posts)
  const fetchCalendarData = useCalendarStore((s) => s.fetchCalendarData)

  // Reminders store (for today's agenda sidebar)
  const reminders = useRemindersStore((s) => s.reminders)
  const fetchReminders = useRemindersStore((s) => s.fetchReminders)
  const remindersInitialized = useRemindersStore((s) => s.initialized)

  // Fetch calendar data for the current month range
  useEffect(() => {
    const start = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
    const end = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0, 23, 59, 59)
    fetchCalendarData(start.toISOString(), end.toISOString())
  }, [currentDate, fetchCalendarData])

  useEffect(() => {
    if (!remindersInitialized) fetchReminders()
  }, [remindersInitialized, fetchReminders])

  // Today's posts
  const todayPosts = useMemo(
    () =>
      calendarPosts
        .filter((p) => p.scheduledAt && isToday(new Date(p.scheduledAt)))
        .sort((a, b) => new Date(a.scheduledAt!).getTime() - new Date(b.scheduledAt!).getTime()),
    [calendarPosts]
  )

  // Today's reminders (non-completed, due today)
  const todayReminders = useMemo(
    () =>
      reminders
        .filter((r) => !r.isCompleted && isSameDay(new Date(r.remindAt), new Date()))
        .sort((a, b) => new Date(a.remindAt).getTime() - new Date(b.remindAt).getTime()),
    [reminders]
  )

  const platformClasses: Record<string, string> = {
    twitter: 'bg-twitter',
    linkedin: 'bg-linkedin',
    reddit: 'bg-reddit',
  }

  const platformLabels: Record<string, string> = {
    twitter: 'Twitter',
    linkedin: 'LinkedIn',
    reddit: 'Reddit',
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] p-4 md:p-6 max-w-7xl mx-auto">
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-md bg-primary/10 border-[3px] border-border shadow-sticker-sm">
            <Calendar className="w-5 h-5 text-primary" />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight">Calendar</h1>
        </div>
        <div className="flex items-center border-[3px] border-border rounded-md overflow-hidden shadow-sticker-sm">
          <button
            onClick={() => setViewMode('month')}
            className={cn(
              'px-4 py-2 text-sm font-bold transition-colors',
              viewMode === 'month'
                ? 'bg-primary text-primary-foreground'
                : 'bg-card text-muted-foreground hover:text-foreground hover:bg-secondary'
            )}
          >
            Month
          </button>
          <button
            onClick={() => setViewMode('week')}
            className={cn(
              'px-4 py-2 text-sm font-bold transition-colors border-l-[3px] border-border',
              viewMode === 'week'
                ? 'bg-primary text-primary-foreground'
                : 'bg-card text-muted-foreground hover:text-foreground hover:bg-secondary'
            )}
          >
            Week
          </button>
        </div>
      </div>

      {/* Main layout: calendar + sidebar */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Calendar view */}
        <div className="flex-1 min-w-0">
          <CalendarView
            posts={calendarPosts}
            currentDate={currentDate}
            onDateChange={setCurrentDate}
          />
        </div>

        {/* Sidebar agenda */}
        <div className="lg:w-80 shrink-0">
          <div className="bg-card border-[3px] border-border rounded-md shadow-sticker overflow-hidden">
            {/* Sidebar header */}
            <div className="p-4 border-b-[3px] border-border bg-sticker-blue/5">
              <h2 className="text-sm font-extrabold uppercase tracking-widest text-sticker-blue">
                Today&apos;s Agenda
              </h2>
              <p className="text-xs text-muted-foreground mt-1">
                {format(new Date(), 'EEEE, MMMM d')}
              </p>
            </div>

            {/* Agenda items */}
            <div className="p-4 space-y-3">
              {todayPosts.length === 0 && todayReminders.length === 0 ? (
                <div className="text-center py-8 px-4">
                  <div className="w-12 h-12 mx-auto mb-3 rounded-md bg-secondary flex items-center justify-center">
                    <Calendar className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Nothing scheduled for today
                  </p>
                </div>
              ) : (
                <>
                  {/* Posts */}
                  {todayPosts.map((post) => (
                    <div
                      key={post.id}
                      className={cn(
                        'flex items-start gap-3 p-3 rounded-md',
                        'bg-secondary/50 border-2 border-border',
                        'hover:bg-secondary transition-colors'
                      )}
                    >
                      <div
                        className={cn(
                          'w-2.5 h-2.5 rounded-full mt-1.5 shrink-0',
                          platformClasses[post.platform] || 'bg-muted-foreground'
                        )}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                          {platformLabels[post.platform] || post.platform}
                        </p>
                        <p className="text-sm font-medium truncate">
                          {getPostPreviewText(post).slice(0, 60)}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {format(new Date(post.scheduledAt!), 'h:mm a')}
                        </p>
                      </div>
                    </div>
                  ))}

                  {/* Reminders */}
                  {todayReminders.map((reminder) => (
                    <div
                      key={reminder.id}
                      className={cn(
                        'flex items-start gap-3 p-3 rounded-md',
                        'bg-sticker-orange/5 border-2 border-sticker-orange/30',
                        'hover:bg-sticker-orange/10 transition-colors'
                      )}
                    >
                      <Bell className="w-4 h-4 text-sticker-orange mt-0.5 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{reminder.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {format(new Date(reminder.remindAt), 'h:mm a')}
                        </p>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
