'use client'

import { useEffect, useState, useCallback, useMemo, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams, useRouter } from 'next/navigation'
import { FileText, Plus, Search, X, Tag, AlertCircle, RefreshCw } from 'lucide-react'
import { useBlogDraftsStore, BlogDraftStatus, BLOG_DRAFT_TAGS } from '@/lib/blogDrafts'
import { cn } from '@/lib/utils'
import { DraftCard, FilterTab } from './DraftCard'
import { LimitGate } from '@/components/ui/LimitGate'
import { SkeletonListPage } from '@/components/ui/Skeleton'

type FilterStatus = 'all' | BlogDraftStatus

// Loading skeleton component
function BlogDraftsLoading() {
  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-2 border-[hsl(var(--gold))] border-t-transparent rounded-full animate-spin" />
      </div>
    </div>
  )
}

// Wrap the page in Suspense for useSearchParams
export default function BlogDraftsPage() {
  return (
    <Suspense fallback={<BlogDraftsLoading />}>
      <BlogDraftsContent />
    </Suspense>
  )
}

function BlogDraftsContent() {
  const { drafts, loading, error, initialized, fetchDrafts } = useBlogDraftsStore()
  const searchParams = useSearchParams()
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState('')

  // Fetch drafts on mount
  useEffect(() => {
    if (!initialized) {
      fetchDrafts()
    }
  }, [initialized, fetchDrafts])

  // Initialize filter from URL query param, default to 'all'
  const getFilterFromParams = useCallback((): FilterStatus => {
    const statusParam = searchParams.get('status')
    const validStatuses: FilterStatus[] = ['all', 'draft', 'scheduled', 'published', 'archived']
    if (statusParam && validStatuses.includes(statusParam as FilterStatus)) {
      return statusParam as FilterStatus
    }
    return 'all'
  }, [searchParams])

  const filter = getFilterFromParams()

  // Initialize tag filter from URL query param
  const tagFilter = searchParams.get('tag') || null

  // Update filter via URL params
  const setFilter = useCallback(
    (newFilter: FilterStatus) => {
      const params = new URLSearchParams(searchParams.toString())
      if (newFilter === 'all') {
        params.delete('status')
      } else {
        params.set('status', newFilter)
      }
      router.replace(`/blog?${params.toString()}`)
    },
    [searchParams, router]
  )

  // Update tag filter via URL params
  const setTagFilter = useCallback(
    (tag: string | null) => {
      const params = new URLSearchParams(searchParams.toString())
      if (tag === null || tag === tagFilter) {
        params.delete('tag')
      } else {
        params.set('tag', tag)
      }
      router.replace(`/blog?${params.toString()}`)
    },
    [searchParams, router, tagFilter]
  )

  // Filter drafts - 'all' excludes archived
  const statusFilteredDrafts =
    filter === 'all'
      ? drafts.filter((d) => d.status !== 'archived')
      : drafts.filter((d) => d.status === filter)

  // Apply tag filter
  const tagFilteredDrafts = tagFilter
    ? statusFilteredDrafts.filter((d) => d.tags && d.tags.includes(tagFilter))
    : statusFilteredDrafts

  // Apply search filter
  const filteredDrafts = searchQuery.trim()
    ? tagFilteredDrafts.filter((d) => {
        const query = searchQuery.toLowerCase()
        const title = (d.title || '').toLowerCase()
        const content = (d.content || '').toLowerCase()
        const notes = (d.notes || '').toLowerCase()
        return title.includes(query) || content.includes(query) || notes.includes(query)
      })
    : tagFilteredDrafts

  // Sort by most recent first
  const sortedDrafts = [...filteredDrafts].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  )

  // Count by status
  const counts = useMemo(
    () => ({
      all: drafts.filter((d) => d.status !== 'archived').length,
      draft: drafts.filter((d) => d.status === 'draft').length,
      scheduled: drafts.filter((d) => d.status === 'scheduled').length,
      published: drafts.filter((d) => d.status === 'published').length,
      archived: drafts.filter((d) => d.status === 'archived').length,
    }),
    [drafts]
  )

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 md:mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold mb-1 tracking-tight">
            Blog Drafts
          </h1>
          <p className="text-sm md:text-base text-muted-foreground hidden sm:block">
            Manage your markdown blog posts.
          </p>
          <div className="h-1 w-16 bg-linear-to-r from-[hsl(var(--gold))] to-transparent mt-2 rounded-full" />
        </div>
        <LimitGate resource="blogDrafts">
          <Link
            href="/blog/new"
            className={cn(
              'flex items-center gap-2 px-3 md:px-4 py-2.5 rounded-lg min-h-[44px]',
              'bg-linear-to-br from-[hsl(var(--gold))] to-[hsl(var(--gold-dark))]',
              'border-2 border-[hsl(var(--gold-dark))]',
              'text-primary-foreground font-medium text-sm',
              'hover:shadow-lg hover:shadow-[hsl(var(--gold))]/30 transition-all'
            )}
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">New Draft</span>
            <span className="sm:hidden">New</span>
          </Link>
        </LimitGate>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          aria-label="Search blog drafts"
          placeholder="Search by title, content, or notes..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className={cn(
            'w-full pl-10 pr-10 py-3 rounded-lg min-h-[44px]',
            'bg-card border border-border',
            'text-sm placeholder:text-muted-foreground',
            'focus:outline-hidden focus:ring-2 focus:ring-[hsl(var(--gold))]/50'
          )}
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            aria-label="Clear search"
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2 -mx-4 px-4 md:mx-0 md:px-0">
        <FilterTab
          label="All"
          count={counts.all}
          active={filter === 'all'}
          onClick={() => setFilter('all')}
        />
        <FilterTab
          label="Drafts"
          count={counts.draft}
          active={filter === 'draft'}
          onClick={() => setFilter('draft')}
        />
        <FilterTab
          label="Scheduled"
          count={counts.scheduled}
          active={filter === 'scheduled'}
          onClick={() => setFilter('scheduled')}
        />
        <FilterTab
          label="Published"
          count={counts.published}
          active={filter === 'published'}
          onClick={() => setFilter('published')}
        />
        {counts.archived > 0 && (
          <FilterTab
            label="Archived"
            count={counts.archived}
            active={filter === 'archived'}
            onClick={() => setFilter('archived')}
          />
        )}
      </div>

      {/* Tag filter */}
      <div className="flex items-center gap-2 mb-6">
        <Tag className="w-4 h-4 text-muted-foreground shrink-0" />
        {BLOG_DRAFT_TAGS.map((tag) => (
          <button
            key={tag}
            onClick={() => setTagFilter(tag)}
            className={cn(
              'sticker-badge px-3 py-1 text-xs font-medium rounded-full',
              'transition-all duration-200 cursor-pointer',
              tagFilter === tag
                ? 'bg-[hsl(var(--gold))]/20 text-[hsl(var(--gold-dark))] border-[hsl(var(--gold))]/50'
                : 'bg-muted text-muted-foreground border-border hover:border-foreground/20'
            )}
          >
            {tag}
          </button>
        ))}
        {tagFilter && (
          <button
            onClick={() => setTagFilter(null)}
            aria-label="Clear tag filter"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Loading state */}
      {loading && !initialized && <SkeletonListPage count={4} />}

      {/* Error state */}
      {error && (
        <div className="text-center py-12 bg-card border border-destructive/30 rounded-xl">
          <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-destructive/10 flex items-center justify-center">
            <AlertCircle className="w-6 h-6 text-destructive" />
          </div>
          <h3 className="font-semibold mb-2 text-destructive">Failed to load blog drafts</h3>
          <p className="text-sm text-muted-foreground mb-4">{error}</p>
          <button
            onClick={() => fetchDrafts()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-accent transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Try Again
          </button>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && sortedDrafts.length === 0 && (
        <div className="text-center py-12">
          <FileText className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
          <h3 className="text-lg font-medium mb-2">
            {searchQuery
              ? 'No matching drafts'
              : filter === 'all'
                ? 'No blog drafts yet'
                : `No ${filter} drafts`}
          </h3>
          <p className="text-muted-foreground mb-4">
            {searchQuery
              ? 'Try a different search term.'
              : 'Create your first blog draft to get started.'}
          </p>
          {!searchQuery && filter === 'all' && (
            <Link
              href="/blog/new"
              className={cn(
                'inline-flex items-center gap-2 px-4 py-2 rounded-lg',
                'bg-[hsl(var(--gold))] text-primary-foreground font-medium',
                'hover:bg-[hsl(var(--gold-dark))] transition-colors'
              )}
            >
              <Plus className="w-4 h-4" />
              Create Draft
            </Link>
          )}
        </div>
      )}

      {/* Draft list */}
      {!loading && !error && sortedDrafts.length > 0 && (
        <div className="space-y-3">
          {sortedDrafts.map((draft) => (
            <DraftCard key={draft.id} draft={draft} />
          ))}
        </div>
      )}

      {/* Search results count */}
      {searchQuery && sortedDrafts.length > 0 && (
        <p className="text-sm text-muted-foreground mt-4 text-center">
          Found {sortedDrafts.length} draft{sortedDrafts.length !== 1 ? 's' : ''} matching &quot;
          {searchQuery}&quot;
        </p>
      )}
    </div>
  )
}
