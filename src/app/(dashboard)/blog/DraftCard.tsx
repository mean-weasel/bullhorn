'use client'

import Link from 'next/link'
import { format } from 'date-fns'
import { FileText, Calendar, CheckCircle, Archive, Clock, Edit2 } from 'lucide-react'
import { BlogDraft, BlogDraftStatus } from '@/lib/blogDrafts'
import { cn } from '@/lib/utils'

const STATUS_CONFIG: Record<
  BlogDraftStatus,
  { label: string; icon: typeof FileText; color: string }
> = {
  draft: { label: 'Drafts', icon: FileText, color: 'text-muted-foreground' },
  scheduled: { label: 'Scheduled', icon: Calendar, color: 'text-blue-400' },
  published: { label: 'Published', icon: CheckCircle, color: 'text-green-400' },
  archived: { label: 'Archived', icon: Archive, color: 'text-muted-foreground' },
}

export function DraftCard({ draft }: { draft: BlogDraft }) {
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
            'shrink-0 w-10 h-10 rounded-lg flex items-center justify-center',
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
            <Edit2 className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
          </div>

          {contentPreview && (
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
              {contentPreview}
              {draft.content.length > 100 ? '...' : ''}
            </p>
          )}

          {/* Tags */}
          {draft.tags && draft.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {draft.tags.map((tag) => (
                <span
                  key={tag}
                  className={cn(
                    'sticker-badge px-2 py-0.5 text-[10px] font-medium rounded-full',
                    'bg-[hsl(var(--gold))]/15 text-[hsl(var(--gold-dark))] border-[hsl(var(--gold))]/30'
                  )}
                >
                  {tag}
                </span>
              ))}
            </div>
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

export function FilterTab({
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
