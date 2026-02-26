'use client'

import Link from 'next/link'
import { format } from 'date-fns'
import {
  Clock,
  Edit2,
  FileText,
  Calendar,
  CheckCircle,
  AlertCircle,
  Archive,
  Loader2,
} from 'lucide-react'
import { Post, PostStatus, getPostPreviewText, PLATFORM_INFO } from '@/lib/posts'
import { cn } from '@/lib/utils'

export const STATUS_CONFIG: Record<
  PostStatus,
  { label: string; icon: typeof FileText; color: string; emoji: string }
> = {
  draft: { label: 'Drafts', icon: FileText, color: 'text-muted-foreground', emoji: '📝' },
  scheduled: { label: 'Scheduled', icon: Calendar, color: 'text-sticker-blue', emoji: '📅' },
  publishing: { label: 'Publishing', icon: Loader2, color: 'text-sticker-orange', emoji: '🔄' },
  published: { label: 'Published', icon: CheckCircle, color: 'text-sticker-green', emoji: '✅' },
  failed: { label: 'Failed', icon: AlertCircle, color: 'text-destructive', emoji: '❌' },
  archived: { label: 'Archived', icon: Archive, color: 'text-muted-foreground', emoji: '📦' },
}

export function PostCard({ post, index }: { post: Post; index: number }) {
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
            {post.platform === 'twitter' && '\u{1D54F}'}
            {post.platform === 'linkedin' && 'in'}
            {post.platform === 'reddit' && 'r/'}
          </span>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="text-sm leading-relaxed line-clamp-2 mb-2 font-medium">
            {getPostPreviewText(post) || (
              <span className="text-muted-foreground italic">No content</span>
            )}
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
        <button
          className={cn(
            'p-2 rounded-md text-muted-foreground hover:text-foreground',
            'hover:bg-accent border-2 border-transparent hover:border-border',
            'transition-all min-w-[40px] min-h-[40px] flex items-center justify-center'
          )}
        >
          <Edit2 className="w-4 h-4" />
        </button>
      </div>
    </Link>
  )
}
