'use client'
/* eslint-disable max-lines -- large page component with extracted sub-components */

import { useState, useCallback, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { useSearchParams, useRouter } from 'next/navigation'
import {
  Plus,
  FileText,
  Calendar,
  CheckCircle,
  AlertCircle,
  Archive,
  List,
  LayoutGrid,
  Search,
  X,
  Loader2,
  RefreshCw,
  Bell,
} from 'lucide-react'
import { usePostsStore } from '@/lib/storage'
import { PostStatus, getPostPreviewText } from '@/lib/posts'
import { cn } from '@/lib/utils'
import { PostCard } from './PostCard'
import { CalendarView } from './CalendarView'
import { LimitGate } from '@/components/ui/LimitGate'
import { SkeletonListPage } from '@/components/ui/Skeleton'

type FilterStatus = 'all' | PostStatus
type ViewMode = 'list' | 'calendar'

const STATUS_CONFIG: Record<
  PostStatus,
  { label: string; icon: typeof FileText; color: string; emoji: string }
> = {
  draft: { label: 'Drafts', icon: FileText, color: 'text-muted-foreground', emoji: '📝' },
  scheduled: { label: 'Scheduled', icon: Calendar, color: 'text-sticker-blue', emoji: '📅' },
  ready: { label: 'Ready', icon: Bell, color: 'text-sticker-orange', emoji: '🔔' },
  publishing: { label: 'Publishing', icon: Loader2, color: 'text-sticker-orange', emoji: '🔄' },
  published: { label: 'Published', icon: CheckCircle, color: 'text-sticker-green', emoji: '✅' },
  failed: { label: 'Failed', icon: AlertCircle, color: 'text-destructive', emoji: '❌' },
  archived: { label: 'Archived', icon: Archive, color: 'text-muted-foreground', emoji: '📦' },
}

// eslint-disable-next-line max-lines-per-function
export default function PostsPage() {
  const allPosts = usePostsStore((state) => state.posts)
  const fetchPosts = usePostsStore((state) => state.fetchPosts)
  const initialized = usePostsStore((state) => state.initialized)
  const loading = usePostsStore((state) => state.loading)
  const error = usePostsStore((state) => state.error)
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
    const validStatuses: FilterStatus[] = [
      'all',
      'draft',
      'scheduled',
      'published',
      'failed',
      'archived',
    ]
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

  // Count by status in a single pass - 'all' count excludes archived
  const counts = useMemo(() => {
    const result = {
      all: 0,
      draft: 0,
      scheduled: 0,
      ready: 0,
      publishing: 0,
      published: 0,
      failed: 0,
      archived: 0,
    }
    for (const p of allPosts) {
      const s = p.status as keyof typeof result
      if (s in result) result[s]++
      if (s !== 'archived') result.all++
    }
    return result
  }, [allPosts])

  if (loading && !initialized) {
    return <SkeletonListPage count={5} />
  }

  if (error) {
    return (
      <div className="p-4 md:p-6 max-w-5xl mx-auto animate-fade-in">
        <div className="text-center py-12 bg-card border border-destructive/30 rounded-xl">
          <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-destructive/10 flex items-center justify-center">
            <AlertCircle className="w-6 h-6 text-destructive" />
          </div>
          <h3 className="font-semibold mb-2 text-destructive">Failed to load posts</h3>
          <p className="text-sm text-muted-foreground mb-4">{error}</p>
          <button
            onClick={() => fetchPosts()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-accent transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Try Again
          </button>
        </div>
      </div>
    )
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
          <div className="flex p-1 bg-card border-[3px] border-border rounded-md shadow-sticker-hover">
            <button
              onClick={() => setViewMode('list')}
              className={cn(
                'p-2 rounded transition-all',
                viewMode === 'list'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              )}
              aria-label="List view"
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('calendar')}
              className={cn(
                'p-2 rounded transition-all',
                viewMode === 'calendar'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              )}
              aria-label="Calendar view"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>
          <LimitGate resource="posts">
            <Link
              href="/new"
              className={cn(
                'flex items-center gap-2 px-3 md:px-4 py-2.5 rounded-md min-h-[44px]',
                'bg-primary text-primary-foreground font-bold text-sm',
                'border-[3px] border-border',
                'shadow-sticker-sm',
                'hover:translate-y-[-2px] hover:shadow-[5px_5px_0_hsl(var(--border))]',
                'transition-all'
              )}
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">New Post</span>
              <span className="sm:hidden">New</span>
            </Link>
          </LimitGate>
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
                aria-label="Search posts"
                placeholder="Search posts by content or notes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={cn(
                  'w-full pl-10 pr-10 py-2.5 rounded-md',
                  'bg-card text-foreground placeholder-muted-foreground',
                  'border-[3px] border-border',
                  'shadow-sticker-sm',
                  'focus:outline-hidden focus:ring-2 focus:ring-primary/50',
                  'transition-all'
                )}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear search"
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            {searchQuery && (
              <p className="text-xs text-muted-foreground mt-2 font-medium">
                Found {filteredPosts.length} {filteredPosts.length === 1 ? 'post' : 'posts'}{' '}
                matching &quot;{searchQuery}&quot;
              </p>
            )}
          </div>

          {/* Filter tabs - horizontally scrollable on mobile */}
          <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0 mb-4 md:mb-6">
            <div className="flex gap-1 p-1.5 bg-card border-[3px] border-border rounded-md shadow-sticker-sm min-w-max md:min-w-0">
              <button
                onClick={() => setFilter('all')}
                className={cn(
                  'flex-1 px-3 md:px-4 py-2 rounded text-sm font-bold transition-all whitespace-nowrap min-h-[40px]',
                  filter === 'all'
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                )}
              >
                All <span className="ml-1 text-xs opacity-70">({counts.all})</span>
              </button>
              {(
                [
                  'draft',
                  'scheduled',
                  'ready',
                  'publishing',
                  'published',
                  'failed',
                  'archived',
                ] as PostStatus[]
              ).map((status) => {
                const config = STATUS_CONFIG[status]
                const count = counts[status]
                // Hide publishing, failed, and archived tabs when empty
                if (
                  (status === 'ready' ||
                    status === 'publishing' ||
                    status === 'failed' ||
                    status === 'archived') &&
                  count === 0
                )
                  return null
                return (
                  <button
                    key={status}
                    onClick={() => setFilter(status)}
                    className={cn(
                      'flex-1 flex items-center justify-center gap-1.5 md:gap-2 px-3 md:px-4 py-2 rounded text-sm font-bold transition-all whitespace-nowrap min-h-[40px]',
                      filter === status
                        ? 'bg-primary text-primary-foreground shadow-xs'
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
            <div className="text-center py-12 md:py-16 bg-card border-[3px] border-border rounded-md shadow-sticker">
              <div className="w-16 h-16 mx-auto mb-4 rounded-lg bg-primary/10 flex items-center justify-center border-[3px] border-border shadow-sticker-sm text-3xl">
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
                  'shadow-sticker',
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
