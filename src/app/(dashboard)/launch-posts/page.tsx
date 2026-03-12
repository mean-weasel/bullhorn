'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { Plus, Rocket, AlertCircle, RefreshCw, Filter } from 'lucide-react'
import {
  useLaunchPostsStore,
  useLaunchPostsLoading,
  useLaunchPostsError,
  LaunchPlatform,
  LaunchPostStatus,
} from '@/lib/launchPosts'
import { cn } from '@/lib/utils'
import { LaunchPostCard } from '@/components/launch-posts/LaunchPostCard'
import { LimitGate } from '@/components/ui/LimitGate'
import { SkeletonListPage } from '@/components/ui/Skeleton'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'

export default function LaunchPostsPage() {
  const router = useRouter()
  const { launchPosts, fetchLaunchPosts, initialized, deleteLaunchPost } = useLaunchPostsStore()
  const loading = useLaunchPostsLoading()
  const error = useLaunchPostsError()

  const [platformFilter, setPlatformFilter] = useState<LaunchPlatform | 'all'>('all')
  const [statusFilter, setStatusFilter] = useState<LaunchPostStatus | 'all'>('all')
  const [showFilters, setShowFilters] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  useEffect(() => {
    if (!initialized) {
      fetchLaunchPosts()
    }
  }, [initialized, fetchLaunchPosts])

  const handleDelete = (id: string) => {
    setDeleteId(id)
  }

  const confirmDelete = async () => {
    if (deleteId) {
      await deleteLaunchPost(deleteId)
      setDeleteId(null)
    }
  }

  const handleCopy = useCallback(() => {
    toast.success('Copied to clipboard')
  }, [])

  // Filter posts
  const filteredPosts = launchPosts.filter((post) => {
    if (platformFilter !== 'all' && post.platform !== platformFilter) return false
    if (statusFilter !== 'all' && post.status !== statusFilter) return false
    return true
  })

  // Sort by most recent first
  const sortedPosts = [...filteredPosts].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  )

  const platforms: Array<{ value: LaunchPlatform | 'all'; label: string }> = [
    { value: 'all', label: 'All Platforms' },
    { value: 'hacker_news_show', label: 'Show HN' },
    { value: 'hacker_news_ask', label: 'Ask HN' },
    { value: 'product_hunt', label: 'Product Hunt' },
    { value: 'dev_hunt', label: 'Dev Hunt' },
    { value: 'beta_list', label: 'BetaList' },
    { value: 'indie_hackers', label: 'Indie Hackers' },
  ]

  const statuses: Array<{ value: LaunchPostStatus | 'all'; label: string }> = [
    { value: 'all', label: 'All Status' },
    { value: 'draft', label: 'Drafts' },
    { value: 'scheduled', label: 'Scheduled' },
    { value: 'posted', label: 'Posted' },
  ]

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 md:mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold mb-1 tracking-tight">
            Launch Posts
          </h1>
          <p className="text-sm md:text-base text-muted-foreground hidden sm:block">
            Draft and track posts for Hacker News, Product Hunt, and other launch platforms.
          </p>
          <div className="h-1 w-16 bg-linear-to-r from-[hsl(var(--gold))] to-transparent mt-2 rounded-full" />
        </div>
        <LimitGate resource="launchPosts">
          <button
            onClick={() => router.push('/launch-posts/new')}
            className={cn(
              'flex items-center gap-2 px-3 md:px-4 py-2.5 rounded-lg min-h-[44px]',
              'bg-linear-to-br from-[hsl(var(--gold))] to-[hsl(var(--gold-dark))]',
              'border-2 border-[hsl(var(--gold-dark))]',
              'text-primary-foreground font-medium text-sm',
              'hover:shadow-lg hover:shadow-[hsl(var(--gold))]/30 transition-all'
            )}
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">New Launch Post</span>
            <span className="sm:hidden">New</span>
          </button>
        </LimitGate>
      </div>

      {/* Filters */}
      <div className="mb-4">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={cn(
            'flex items-center gap-2 px-3 py-2 rounded-lg text-sm',
            'border border-border hover:bg-accent transition-colors',
            showFilters && 'bg-accent'
          )}
        >
          <Filter className="w-4 h-4" />
          Filters
          {(platformFilter !== 'all' || statusFilter !== 'all') && (
            <span className="w-2 h-2 rounded-full bg-[hsl(var(--gold))]" />
          )}
        </button>

        {showFilters && (
          <div className="flex flex-wrap gap-3 mt-3 p-4 bg-card border border-border rounded-xl">
            <div>
              <label
                htmlFor="platform-filter"
                className="text-xs font-medium text-muted-foreground mb-1.5 block"
              >
                Platform
              </label>
              <select
                id="platform-filter"
                value={platformFilter}
                onChange={(e) => setPlatformFilter(e.target.value as LaunchPlatform | 'all')}
                className="px-3 py-2 rounded-lg border border-border bg-background text-sm min-w-[150px]"
              >
                {platforms.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="status-filter"
                className="text-xs font-medium text-muted-foreground mb-1.5 block"
              >
                Status
              </label>
              <select
                id="status-filter"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as LaunchPostStatus | 'all')}
                className="px-3 py-2 rounded-lg border border-border bg-background text-sm min-w-[120px]"
              >
                {statuses.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>

            {(platformFilter !== 'all' || statusFilter !== 'all') && (
              <div className="flex items-end">
                <button
                  onClick={() => {
                    setPlatformFilter('all')
                    setStatusFilter('all')
                  }}
                  className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Clear Filters
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Loading state */}
      {loading && !initialized && <SkeletonListPage count={3} />}

      {/* Error state */}
      {error && (
        <div className="text-center py-12 bg-card border border-destructive/30 rounded-xl">
          <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-destructive/10 flex items-center justify-center">
            <AlertCircle className="w-6 h-6 text-destructive" />
          </div>
          <h3 className="font-semibold mb-2 text-destructive">Failed to load launch posts</h3>
          <p className="text-sm text-muted-foreground mb-4">{error}</p>
          <button
            onClick={() => fetchLaunchPosts()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-accent transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Try Again
          </button>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && sortedPosts.length === 0 ? (
        <div className="text-center py-12 md:py-16 bg-card border border-border rounded-xl">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[hsl(var(--gold))]/10 flex items-center justify-center">
            <Rocket className="w-8 h-8 text-[hsl(var(--gold-dark))]" />
          </div>
          <h3 className="text-lg font-semibold mb-2">
            {platformFilter !== 'all' || statusFilter !== 'all'
              ? 'No matching launch posts'
              : 'No launch posts yet'}
          </h3>
          <p className="text-muted-foreground mb-6 max-w-sm mx-auto px-4">
            {platformFilter !== 'all' || statusFilter !== 'all'
              ? 'Try adjusting your filters to see more posts.'
              : 'Create launch posts for Hacker News, Product Hunt, and other platforms to coordinate your product launches.'}
          </p>
          {platformFilter === 'all' && statusFilter === 'all' && (
            <button
              onClick={() => router.push('/launch-posts/new')}
              className={cn(
                'inline-flex items-center gap-2 px-5 py-3 rounded-xl',
                'bg-linear-to-br from-[hsl(var(--gold))] to-[hsl(var(--gold-dark))]',
                'border-2 border-[hsl(var(--gold-dark))]',
                'text-primary-foreground font-medium text-sm',
                'hover:shadow-lg hover:shadow-[hsl(var(--gold))]/30 transition-all'
              )}
            >
              <Plus className="w-4 h-4" />
              Create Your First Launch Post
            </button>
          )}
        </div>
      ) : !loading && !error && sortedPosts.length > 0 ? (
        <div className="space-y-3">
          {sortedPosts.map((post, i) => (
            <LaunchPostCard
              key={post.id}
              post={post}
              index={i}
              onEdit={() => router.push(`/launch-posts/${post.id}`)}
              onDelete={() => handleDelete(post.id)}
              onCopy={handleCopy}
            />
          ))}
        </div>
      ) : null}

      <ConfirmDialog
        open={!!deleteId}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteId(null)}
        title="Delete Launch Post"
        description="Are you sure you want to delete this launch post? This action cannot be undone."
        confirmText="Delete"
        variant="danger"
      />
    </div>
  )
}
