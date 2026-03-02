'use client'

import Link from 'next/link'
import { format } from 'date-fns'
import {
  Edit2,
  X,
  FileText,
  Calendar,
  CheckCircle,
  AlertCircle,
  Archive,
  Clock,
  Loader2,
} from 'lucide-react'
import { Post, PostStatus, getPostPreviewText, PLATFORM_INFO } from '@/lib/posts'
import { cn } from '@/lib/utils'

const POST_STATUS_CONFIG: Record<
  PostStatus,
  { label: string; icon: typeof FileText; color: string }
> = {
  draft: { label: 'Draft', icon: FileText, color: 'text-muted-foreground' },
  scheduled: { label: 'Scheduled', icon: Calendar, color: 'text-blue-400' },
  ready: { label: 'Ready', icon: Clock, color: 'text-orange-400' },
  publishing: { label: 'Publishing', icon: Loader2, color: 'text-orange-400' },
  published: { label: 'Published', icon: CheckCircle, color: 'text-green-400' },
  failed: { label: 'Failed', icon: AlertCircle, color: 'text-destructive' },
  archived: { label: 'Archived', icon: Archive, color: 'text-muted-foreground' },
}

export function CampaignPostCard({
  post,
  index,
  onRemove,
}: {
  post: Post
  index: number
  onRemove: () => void
}) {
  const statusConfig = POST_STATUS_CONFIG[post.status]
  const StatusIcon = statusConfig.icon

  return (
    <div
      className={cn(
        'flex items-start gap-3 md:gap-4 p-3 md:p-4 bg-card border border-border rounded-xl',
        'animate-slide-up'
      )}
      style={{ animationDelay: `${index * 30}ms` }}
    >
      {/* Platform indicator */}
      <div className="flex flex-col gap-1.5 pt-1">
        <span
          className={cn(
            'w-2.5 h-2.5 rounded-full',
            post.platform === 'twitter' && 'bg-twitter shadow-[0_0_8px_rgba(29,161,242,0.4)]',
            post.platform === 'linkedin' && 'bg-linkedin shadow-[0_0_8px_rgba(10,102,194,0.4)]',
            post.platform === 'reddit' && 'bg-reddit shadow-[0_0_8px_rgba(255,69,0,0.4)]'
          )}
          title={PLATFORM_INFO[post.platform].name}
        />
      </div>

      {/* Content */}
      <Link
        href={`/edit/${post.id}`}
        className="flex-1 min-w-0 hover:opacity-80 transition-opacity"
      >
        <p className="text-sm leading-relaxed line-clamp-2 mb-2">
          {getPostPreviewText(post) || (
            <span className="text-muted-foreground italic">No content</span>
          )}
        </p>
        <div className="flex flex-wrap items-center gap-2 md:gap-4 text-xs text-muted-foreground">
          <span className={cn('flex items-center gap-1.5', statusConfig.color)}>
            <StatusIcon className="w-3.5 h-3.5" />
            {statusConfig.label}
          </span>
          {post.scheduledAt && post.status === 'scheduled' && (
            <span className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              {format(new Date(post.scheduledAt), 'MMM d, h:mm a')}
            </span>
          )}
        </div>
      </Link>

      {/* Actions */}
      <div className="flex items-center gap-1">
        <Link
          href={`/edit/${post.id}`}
          className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        >
          <Edit2 className="w-4 h-4" />
        </Link>
        <button
          onClick={onRemove}
          className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
          title="Remove from campaign"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
