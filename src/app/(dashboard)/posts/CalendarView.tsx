'use client'

import { useRouter } from 'next/navigation'
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isToday,
  isBefore,
  startOfDay,
} from 'date-fns'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Post, getPostPreviewText } from '@/lib/posts'
import { cn } from '@/lib/utils'

export function CalendarView({
  posts,
  currentDate,
  onDateChange,
}: {
  posts: Post[]
  currentDate: Date
  onDateChange: (date: Date) => void
}) {
  const router = useRouter()
  const monthStart = startOfMonth(currentDate)
  const monthEnd = endOfMonth(currentDate)
  const calendarDays = eachDayOfInterval({ start: monthStart, end: monthEnd })

  const startPadding = monthStart.getDay()
  const paddedDays = Array(startPadding).fill(null).concat(calendarDays)

  // Group posts by date
  const postsByDate = posts.reduce(
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

  const navigateMonth = (delta: number) => {
    const next = new Date(currentDate)
    next.setMonth(next.getMonth() + delta)
    onDateChange(next)
  }

  return (
    <div className="bg-card border-[3px] border-border rounded-md shadow-[4px_4px_0_hsl(var(--border))] overflow-hidden">
      {/* Calendar header */}
      <div className="flex items-center justify-between p-4 border-b-[3px] border-border bg-primary/5">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-extrabold tracking-tight">
            {format(currentDate, 'MMMM yyyy')}
          </h2>
          <div className="flex items-center gap-1">
            <button
              onClick={() => navigateMonth(-1)}
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
              onClick={() => navigateMonth(1)}
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
      </div>

      {/* Scrollable calendar container */}
      <div className="overflow-x-auto">
        <div className="min-w-[560px]">
          {/* Weekday headers */}
          <div className="grid grid-cols-7 border-b-2 border-border bg-secondary/50">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
              <div
                key={day}
                className="py-3 text-center text-xs font-extrabold uppercase tracking-wider text-muted-foreground"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
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
              const dayPosts = postsByDate[dateKey] || []
              const isCurrentMonth = isSameMonth(day, currentDate)
              const isCurrentDay = isToday(day)
              const isPastDate = isBefore(startOfDay(day), startOfDay(new Date())) && !isCurrentDay

              const handleCellClick = () => {
                if (!isPastDate) {
                  router.push(`/new?date=${dateKey}`)
                }
              }

              const handlePostClick = (e: React.MouseEvent, postId: string) => {
                e.preventDefault()
                e.stopPropagation()
                router.push(`/edit/${postId}`)
              }

              return (
                <div
                  key={dateKey}
                  onClick={handleCellClick}
                  className={cn(
                    'min-h-[80px] md:min-h-[100px] p-1.5 md:p-2 border-r border-b border-border',
                    'flex flex-col gap-1 transition-colors',
                    !isPastDate && 'cursor-pointer hover:bg-primary/5',
                    isPastDate && 'cursor-default',
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
                    {dayPosts.slice(0, 3).map((post) => (
                      <div
                        key={post.id}
                        className={cn(
                          'flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold truncate border',
                          post.platform === 'twitter' &&
                            'bg-twitter/10 text-twitter border-twitter/30',
                          post.platform === 'linkedin' &&
                            'bg-linkedin/10 text-linkedin border-linkedin/30',
                          post.platform === 'reddit' && 'bg-reddit/10 text-reddit border-reddit/30'
                        )}
                        onClick={(e) => handlePostClick(e, post.id)}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-current" />
                        {getPostPreviewText(post).slice(0, 20)}
                      </div>
                    ))}
                    {dayPosts.length > 3 && (
                      <span className="text-[10px] text-muted-foreground font-medium">
                        +{dayPosts.length - 3} more
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
