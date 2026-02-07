'use client'

import { useEffect, useState, useCallback, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams, useRouter } from 'next/navigation'
import { format } from 'date-fns'
import {
  FileText,
  Calendar,
  CheckCircle,
  Archive,
  Plus,
  Search,
  X,
  Clock,
  Edit2,
} from 'lucide-react'
import { useBlogDraftsStore, BlogDraft, BlogDraftStatus } from '@/lib/blogDrafts'
import { cn } from '@/lib/utils'

type FilterStatus = 'all' | BlogDraftStatus

const STATUS_CONFIG: Record<
  BlogDraftStatus,
  { label: string; icon: typeof FileText; color: string }
> = {
  draft: { label: 'Drafts', icon: FileText, color: 'text-muted-foreground' },
  scheduled: { label: 'Scheduled', icon: Calendar, color: 'text-blue-400' },
  published: { label: 'Published', icon: CheckCircle, color: 'text-green-400' },
  archived: { label: 'Archived', icon: Archive, color: 'text-muted-foreground' },
}

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
  const { drafts, loading, initialized, fetchDrafts } = useBlogDraftsStore()
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

  // Filter drafts - 'all' excludes archived
  const statusFilteredDrafts =
    filter === 'all'
      ? drafts.filter((d) => d.status !== 'archived')
      : drafts.filter((d) => d.status === filter)

  // Apply search filter
  const filteredDrafts = searchQuery.trim()
    ? statusFilteredDrafts.filter((d) => {
        const query = searchQuery.toLowerCase()
        const title = d.title.toLowerCase()
        const content = d.content.toLowerCase()
        const notes = (d.notes || '').toLowerCase()
        return title.includes(query) || content.includes(query) || notes.includes(query)
      })
    : statusFilteredDrafts

  // Sort by most recent first
  const sortedDrafts = [...filteredDrafts].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  )

  // Count by status
  const counts = {
    all: drafts.filter((d) => d.status !== 'archived').length,
    draft: drafts.filter((d) => d.status === 'draft').length,
    scheduled: drafts.filter((d) => d.status === 'scheduled').length,
    published: drafts.filter((d) => d.status === 'published').length,
    archived: drafts.filter((d) => d.status === 'archived').length,
  }

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
          <div className="h-1 w-16 bg-gradient-to-r from-[hsl(var(--gold))] to-transparent mt-2 rounded-full" />
        </div>
        <Link
          href="/blog/new"
          className={cn(
            'flex items-center gap-2 px-3 md:px-4 py-2.5 rounded-lg min-h-[44px]',
            'bg-gradient-to-br from-[hsl(var(--gold))] to-[hsl(var(--gold-dark))]',
            'text-primary-foreground font-medium text-sm',
            'hover:shadow-lg hover:shadow-[hsl(var(--gold))]/30 transition-all'
          )}
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">New Draft</span>
          <span className="sm:hidden">New</span>
        </Link>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search by title, content, or notes..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className={cn(
            'w-full pl-10 pr-10 py-3 rounded-lg min-h-[44px]',
            'bg-card border border-border',
            'text-sm placeholder:text-muted-foreground',
            'focus:outline-none focus:ring-2 focus:ring-[hsl(var(--gold))]/50'
          )}
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
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

      {/* Loading state */}
      {loading && !initialized && (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-2 border-[hsl(var(--gold))] border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Empty state */}
      {!loading && sortedDrafts.length === 0 && (
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
      {!loading && sortedDrafts.length > 0 && (
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

function FilterTab({
  label,
  count,
  active,
  onClick,
}: {
  label: string
  count: number
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium min-h-[40px] whitespace-nowrap',
        'transition-all duration-200',
        active
          ? 'bg-[hsl(var(--gold))]/20 text-[hsl(var(--gold-dark))] border-2 border-[hsl(var(--gold))]/50'
          : 'bg-card border border-border text-muted-foreground hover:text-foreground hover:border-foreground/20'
      )}
    >
      {label}
      <span
        className={cn(
          'px-1.5 py-0.5 rounded text-xs',
          active ? 'bg-[hsl(var(--gold))]/30' : 'bg-muted'
        )}
      >
        {count}
      </span>
    </button>
  )
}

function DraftCard({ draft }: { draft: BlogDraft }) {
  const statusConfig = STATUS_CONFIG[draft.status]
  const StatusIcon = statusConfig.icon

  // Get first 100 chars of content as preview
  const contentPreview = draft.content
    .slice(0, 100)
    .replace(/[#*_`]/g, '')
    .trim()

  return (
    <Link
      href={`/blog/${draft.id}`}
      className={cn(
        'block p-4 rounded-xl',
        'bg-card border border-border',
        'hover:border-[hsl(var(--gold))]/50 hover:shadow-lg hover:shadow-[hsl(var(--gold))]/10',
        'transition-all duration-200',
        'group'
      )}
    >
      <div className="flex items-start gap-3">
        {/* Status icon */}
        <div
          className={cn(
            'flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center',
            'bg-muted/50'
          )}
        >
          <StatusIcon className={cn('w-5 h-5', statusConfig.color)} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-medium text-foreground truncate group-hover:text-[hsl(var(--gold-dark))] transition-colors">
              {draft.title}
            </h3>
            <Edit2 className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
          </div>

          {contentPreview && (
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
              {contentPreview}
              {draft.content.length > 100 ? '...' : ''}
            </p>
          )}

          {/* Meta info */}
          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
            {draft.scheduledAt && (
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {format(new Date(draft.scheduledAt), 'MMM d, h:mm a')}
              </span>
            )}
            <span>{draft.wordCount} words</span>
            <span>{format(new Date(draft.updatedAt), 'MMM d')}</span>
          </div>
        </div>
      </div>
    </Link>
  )
}
