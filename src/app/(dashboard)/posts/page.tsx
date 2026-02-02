'use client'

import { useState, useCallback, useEffect } from 'react'
import Link from 'next/link'
import { useSearchParams, useRouter } from 'next/navigation'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, isBefore, startOfDay } from 'date-fns'
import {
  Clock,
  Edit2,
  Plus,
  FileText,
  Calendar,
  CheckCircle,
  AlertCircle,
  Archive,
  List,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  Search,
  X,
} from 'lucide-react'
import { usePostsStore } from '@/lib/storage'
import { Post, PostStatus, getPostPreviewText, PLATFORM_INFO } from '@/lib/posts'
import { cn } from '@/lib/utils'

type FilterStatus = 'all' | PostStatus
type ViewMode = 'list' | 'calendar'

const STATUS_CONFIG: Record<PostStatus, { label: string; icon: typeof FileText; color: string; emoji: string }> = {
  draft: { label: 'Drafts', icon: FileText, color: 'text-muted-foreground', emoji: '📝' },
  scheduled: { label: 'Scheduled', icon: Calendar, color: 'text-sticker-blue', emoji: '📅' },
  published: { label: 'Published', icon: CheckCircle, color: 'text-sticker-green', emoji: '✅' },
  failed: { label: 'Failed', icon: AlertCircle, color: 'text-destructive', emoji: '❌' },
  archived: { label: 'Archived', icon: Archive, color: 'text-muted-foreground', emoji: '📦' },
}

export default function PostsPage() {
  const allPosts = usePostsStore((state) => state.posts)
  const fetchPosts = usePostsStore((state) => state.fetchPosts)
  const initialized = usePostsStore((state) => state.initialized)
  const searchParams = useSearchParams()
  const router = useRouter()

  // Fetch posts on mount if not already initialized
  useEffect(() => {
    if (!initialized) {
      fetchPosts()
    }
  }, [initialized, fetchPosts])

  // Initialize filter from URL query param, default to 'all'
  const getFilterFromParams = useCallback((): FilterStatus => {
    const statusParam = searchParams.get('status')
    const validStatuses: FilterStatus[] = ['all', 'draft', 'scheduled', 'published', 'failed', 'archived']
    if (statusParam && validStatuses.includes(statusParam as FilterStatus)) {
      return statusParam as FilterStatus
    }
    return 'all'
  }, [searchParams])

  const filter = getFilterFromParams()

  // Update filter via URL params
  const setFilter = useCallback(
    (newFilter: FilterStatus) => {
      const params = new URLSearchParams(searchParams.toString())
      if (newFilter === 'all') {
        params.delete('status')
      } else {
        params.set('status', newFilter)
      }
      router.replace(`/posts?${params.toString()}`)
    },
    [searchParams, router]
  )

  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [searchQuery, setSearchQuery] = useState('')

  // Filter posts - 'all' excludes archived posts
  const statusFilteredPosts =
    filter === 'all'
      ? allPosts.filter((p) => p.status !== 'archived')
      : allPosts.filter((p) => p.status === filter)

  // Apply search filter
  const filteredPosts = searchQuery.trim()
    ? statusFilteredPosts.filter((p) => {
        const query = searchQuery.toLowerCase()
        const content = getPostPreviewText(p).toLowerCase()
        const notes = (p.notes || '').toLowerCase()
        return content.includes(query) || notes.includes(query)
      })
    : statusFilteredPosts

  // Sort by most recent first
  const sortedPosts = [...filteredPosts].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  )

  // Count by status - 'all' count excludes archived
  const counts = {
    all: allPosts.filter((p) => p.status !== 'archived').length,
    draft: allPosts.filter((p) => p.status === 'draft').length,
    scheduled: allPosts.filter((p) => p.status === 'scheduled').length,
    published: allPosts.filter((p) => p.status === 'published').length,
    failed: allPosts.filter((p) => p.status === 'failed').length,
    archived: allPosts.filter((p) => p.status === 'archived').length,
  }

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 md:mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold mb-1 tracking-tight">📋 All Posts</h1>
          <p className="text-sm md:text-base text-muted-foreground hidden sm:block">
            Manage your drafts, scheduled, and published posts.
          </p>
          <div className="h-1 w-16 gradient-bar mt-2 rounded-full" />
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex p-1 bg-card border-[3px] border-border rounded-md shadow-[2px_2px_0_hsl(var(--border))]">
            <button
              onClick={() => setViewMode('list')}
              className={cn(
                'p-2 rounded transition-all',
                viewMode === 'list'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
              title="List view"
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('calendar')}
              className={cn(
                'p-2 rounded transition-all',
                viewMode === 'calendar'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
              title="Calendar view"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>
          <Link
            href="/new"
            className={cn(
              'flex items-center gap-2 px-3 md:px-4 py-2.5 rounded-md min-h-[44px]',
              'bg-primary text-primary-foreground font-bold text-sm',
              'border-[3px] border-border',
              'shadow-[3px_3px_0_hsl(var(--border))]',
              'hover:translate-y-[-2px] hover:shadow-[5px_5px_0_hsl(var(--border))]',
              'transition-all'
            )}
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">New Post</span>
            <span className="sm:hidden">New</span>
          </Link>
        </div>
      </div>

      {viewMode === 'list' ? (
        <>
          {/* Search bar */}
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search posts by content or notes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={cn(
                  'w-full pl-10 pr-10 py-2.5 rounded-md',
                  'bg-card text-foreground placeholder-muted-foreground',
                  'border-[3px] border-border',
                  'shadow-[3px_3px_0_hsl(var(--border))]',
                  'focus:outline-none focus:ring-2 focus:ring-primary/50',
                  'transition-all'
                )}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            {searchQuery && (
              <p className="text-xs text-muted-foreground mt-2 font-medium">
                Found {filteredPosts.length} {filteredPosts.length === 1 ? 'post' : 'posts'} matching &quot;{searchQuery}&quot;
              </p>
            )}
          </div>

          {/* Filter tabs - horizontally scrollable on mobile */}
          <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0 mb-4 md:mb-6">
            <div className="flex gap-1 p-1.5 bg-card border-[3px] border-border rounded-md shadow-[3px_3px_0_hsl(var(--border))] min-w-max md:min-w-0">
              <button
                onClick={() => setFilter('all')}
                className={cn(
                  'flex-1 px-3 md:px-4 py-2 rounded text-sm font-bold transition-all whitespace-nowrap min-h-[40px]',
                  filter === 'all'
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                )}
              >
                All <span className="ml-1 text-xs opacity-70">({counts.all})</span>
              </button>
              {(['draft', 'scheduled', 'published', 'failed', 'archived'] as PostStatus[]).map((status) => {
                const config = STATUS_CONFIG[status]
                const count = counts[status]
                // Hide failed and archived tabs when empty
                if ((status === 'failed' || status === 'archived') && count === 0) return null
                return (
                  <button
                    key={status}
                    onClick={() => setFilter(status)}
                    className={cn(
                      'flex-1 flex items-center justify-center gap-1.5 md:gap-2 px-3 md:px-4 py-2 rounded text-sm font-bold transition-all whitespace-nowrap min-h-[40px]',
                      filter === status
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                    )}
                  >
                    <span>{config.emoji}</span>
                    <span className="hidden sm:inline">{config.label}</span>
                    <span className="text-xs opacity-70">({count})</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Posts list */}
          {sortedPosts.length === 0 ? (
            <div className="text-center py-12 md:py-16 bg-card border-[3px] border-border rounded-md shadow-[4px_4px_0_hsl(var(--border))]">
              <div className="w-16 h-16 mx-auto mb-4 rounded-lg bg-primary/10 flex items-center justify-center border-[3px] border-border shadow-[3px_3px_0_hsl(var(--border))] text-3xl">
                📝
              </div>
              <h3 className="text-lg font-extrabold mb-2">
                {filter === 'all' ? 'No posts yet' : `No ${filter} posts`}
              </h3>
              <p className="text-muted-foreground mb-6 max-w-sm mx-auto px-4">
                {filter === 'all'
                  ? 'Start creating content for Twitter, LinkedIn, and Reddit.'
                  : filter === 'draft'
                    ? 'All your drafts have been published or scheduled.'
                    : filter === 'scheduled'
                      ? 'No posts scheduled right now.'
                      : filter === 'published'
                        ? "You haven't published any posts yet."
                        : filter === 'archived'
                          ? 'No archived posts.'
                          : 'No failed posts.'}
              </p>
              <Link
                href="/new"
                className={cn(
                  'inline-flex items-center gap-2 px-5 py-3 rounded-md',
                  'bg-primary text-primary-foreground font-bold text-sm',
                  'border-[3px] border-border',
                  'shadow-[4px_4px_0_hsl(var(--border))]',
                  'hover:translate-y-[-2px] hover:shadow-[6px_6px_0_hsl(var(--border))]',
                  'transition-all'
                )}
              >
                <Plus className="w-4 h-4" />
                Create Your First Post
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {sortedPosts.map((post, i) => (
                <PostCard key={post.id} post={post} index={i} />
              ))}
            </div>
          )}
        </>
      ) : (
        <CalendarView
          posts={allPosts.filter((p) => p.status !== 'archived')}
          currentDate={currentDate}
          onDateChange={setCurrentDate}
        />
      )}
    </div>
  )
}

function PostCard({ post, index }: { post: Post; index: number }) {
  const statusConfig = STATUS_CONFIG[post.status]

  return (
    <Link
      href={`/edit/${post.id}`}
      className={cn(
        'block p-3 md:p-4 bg-card border-[3px] border-border rounded-md',
        'shadow-[3px_3px_0_hsl(var(--border))]',
        'hover:translate-y-[-2px] hover:shadow-[5px_5px_0_hsl(var(--border))]',
        'active:translate-y-[1px] active:shadow-[2px_2px_0_hsl(var(--border))]',
        'transition-all',
        'animate-slide-up'
      )}
      style={{ animationDelay: `${index * 30}ms` }}
    >
      <div className="flex items-start gap-3 md:gap-4">
        {/* Platform indicator */}
        <div className="flex flex-col gap-1.5 pt-1">
          <span
            className={cn(
              'w-8 h-8 rounded-md flex items-center justify-center border-2 font-bold text-xs',
              post.platform === 'twitter' && 'bg-twitter/10 border-twitter/30 text-twitter',
              post.platform === 'linkedin' && 'bg-linkedin/10 border-linkedin/30 text-linkedin',
              post.platform === 'reddit' && 'bg-reddit/10 border-reddit/30 text-reddit'
            )}
            title={PLATFORM_INFO[post.platform].name}
          >
            {post.platform === 'twitter' && '𝕏'}
            {post.platform === 'linkedin' && 'in'}
            {post.platform === 'reddit' && 'r/'}
          </span>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="text-sm leading-relaxed line-clamp-2 mb-2 font-medium">
            {getPostPreviewText(post) || <span className="text-muted-foreground italic">No content</span>}
          </p>
          <div className="flex flex-wrap items-center gap-2 md:gap-4 text-xs text-muted-foreground">
            {/* Status */}
            <span className={cn('flex items-center gap-1.5 font-bold', statusConfig.color)}>
              <span>{statusConfig.emoji}</span>
              {statusConfig.label}
            </span>

            {/* Scheduled time */}
            {post.scheduledAt && post.status === 'scheduled' && (
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                {format(new Date(post.scheduledAt), 'MMM d, h:mm a')}
              </span>
            )}

            {/* Published time */}
            {post.status === 'published' && post.publishResult && (
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                {post.publishResult.publishedAt
                  ? format(new Date(post.publishResult.publishedAt), 'MMM d, h:mm a')
                  : 'Published'}
              </span>
            )}

            {/* Last updated for drafts */}
            {post.status === 'draft' && (
              <span className="flex items-center gap-1.5">
                Updated {format(new Date(post.updatedAt), 'MMM d')}
              </span>
            )}

            {/* Platform */}
            <span className="hidden sm:flex items-center gap-1.5">
              {PLATFORM_INFO[post.platform].name.split(' ')[0]}
            </span>
          </div>
        </div>

        {/* Edit button */}
        <button className={cn(
          'p-2 rounded-md text-muted-foreground hover:text-foreground',
          'hover:bg-accent border-2 border-transparent hover:border-border',
          'transition-all min-w-[40px] min-h-[40px] flex items-center justify-center'
        )}>
          <Edit2 className="w-4 h-4" />
        </button>
      </div>
    </Link>
  )
}

function CalendarView({
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
  const postsByDate = posts.reduce((acc, post) => {
    if (post.scheduledAt) {
      const date = format(new Date(post.scheduledAt), 'yyyy-MM-dd')
      if (!acc[date]) acc[date] = []
      acc[date].push(post)
    }
    return acc
  }, {} as Record<string, Post[]>)

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
            📆 {format(currentDate, 'MMMM yyyy')}
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
                return <div key={`pad-${i}`} className="aspect-square border-r border-b border-border opacity-30" />
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
                          post.platform === 'twitter' && 'bg-twitter/10 text-twitter border-twitter/30',
                          post.platform === 'linkedin' && 'bg-linkedin/10 text-linkedin border-linkedin/30',
                          post.platform === 'reddit' && 'bg-reddit/10 text-reddit border-reddit/30'
                        )}
                        onClick={(e) => handlePostClick(e, post.id)}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-current" />
                        {getPostPreviewText(post).slice(0, 20)}
                      </div>
                    ))}
                    {dayPosts.length > 3 && (
                      <span className="text-[10px] text-muted-foreground font-medium">+{dayPosts.length - 3} more</span>
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
