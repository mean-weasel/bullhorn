'use client'

import Link from 'next/link'
import { formatDistanceToNow, format } from 'date-fns'
import { Calendar, Clock, ChevronRight, FolderOpen, FolderKanban } from 'lucide-react'
import { Post, getPostPreviewText, PLATFORM_INFO, Campaign, Project } from '@/lib/posts'
import { cn } from '@/lib/utils'

// Platform icon component
export function PlatformIcon({ platform }: { platform: string }) {
  if (platform === 'twitter') {
    return (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    )
  }
  if (platform === 'linkedin') {
    return (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
      <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249z" />
    </svg>
  )
}

// Post card component
// eslint-disable-next-line max-lines-per-function -- borderline, extraction would hurt readability
export function DashboardPostCard({
  post,
  showSchedule = false,
}: {
  post: Post
  showSchedule?: boolean
}) {
  const previewText = getPostPreviewText(post)

  return (
    <Link
      href={`/edit/${post.id}`}
      className={cn(
        'block p-4 rounded-md bg-card',
        'border-[3px] border-border',
        'shadow-sticker',
        'hover:translate-y-[-2px] hover:shadow-[6px_6px_0_hsl(var(--border))]',
        'transition-all duration-200',
        'group'
      )}
    >
      {/* Platform indicator */}
      <div className="flex items-center gap-2 mb-3">
        <div
          className={cn(
            'flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold border-2',
            post.platform === 'twitter' && 'bg-twitter/10 text-twitter border-twitter/30',
            post.platform === 'linkedin' && 'bg-linkedin/10 text-linkedin border-linkedin/30',
            post.platform === 'reddit' && 'bg-reddit/10 text-reddit border-reddit/30'
          )}
        >
          <PlatformIcon platform={post.platform} />
          <span className="hidden sm:inline">{PLATFORM_INFO[post.platform].label}</span>
        </div>
      </div>

      {/* Content preview */}
      <p className="text-sm leading-relaxed line-clamp-2 mb-3 group-hover:text-foreground transition-colors font-medium">
        {previewText || <span className="text-muted-foreground italic">No content yet...</span>}
      </p>

      {/* Meta info */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium">
        <Clock className="w-3.5 h-3.5" />
        {showSchedule && post.scheduledAt ? (
          <span>{format(new Date(post.scheduledAt), 'MMM d, h:mm a')}</span>
        ) : (
          <span>Edited {formatDistanceToNow(new Date(post.updatedAt), { addSuffix: true })}</span>
        )}
        <ChevronRight className="w-3.5 h-3.5 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </Link>
  )
}

// Campaign status badge colors
const CAMPAIGN_STATUS_STYLES: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground border-border',
  active: 'bg-sticker-green/10 text-sticker-green border-sticker-green/30',
  completed: 'bg-sticker-blue/10 text-sticker-blue border-sticker-blue/30',
  archived: 'bg-muted text-muted-foreground border-border',
}

// Mini project card for dashboard
export function ProjectMiniCard({
  project,
  campaignCount,
}: {
  project: Project
  campaignCount: number
}) {
  return (
    <Link
      href={`/projects/${project.id}`}
      className={cn(
        'block p-4 rounded-md bg-card',
        'border-[3px] border-border',
        'shadow-sticker',
        'hover:translate-y-[-2px] hover:shadow-[6px_6px_0_hsl(var(--border))]',
        'transition-all duration-200',
        'group'
      )}
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-md bg-sticker-purple/10 flex items-center justify-center shrink-0 border-2 border-sticker-purple/30">
          <FolderKanban className="w-5 h-5 text-sticker-purple" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-sm truncate group-hover:text-primary transition-colors">
            {project.name}
          </h3>
          <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium">
            <span>
              {campaignCount} campaign{campaignCount !== 1 ? 's' : ''}
            </span>
            {project.hashtags.length > 0 && (
              <span className="text-sticker-pink">#{project.hashtags.length} tags</span>
            )}
          </div>
        </div>
        <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </Link>
  )
}

// Campaign card component
export function DashboardCampaignCard({ campaign }: { campaign: Campaign }) {
  return (
    <Link
      href={`/campaigns/${campaign.id}`}
      className={cn(
        'block p-4 rounded-md bg-card',
        'border-[3px] border-border',
        'shadow-sticker',
        'hover:translate-y-[-2px] hover:shadow-[6px_6px_0_hsl(var(--border))]',
        'transition-all duration-200',
        'group'
      )}
    >
      {/* Campaign header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <FolderOpen className="w-4 h-4 text-sticker-orange" />
          <h3 className="font-bold text-sm truncate group-hover:text-primary transition-colors">
            {campaign.name || 'Untitled Campaign'}
          </h3>
        </div>
        <span
          className={cn(
            'text-[10px] uppercase tracking-wider font-bold px-2.5 py-1 rounded-md border-2',
            CAMPAIGN_STATUS_STYLES[campaign.status]
          )}
        >
          {campaign.status}
        </span>
      </div>

      {/* Description */}
      {campaign.description && (
        <p className="text-xs text-muted-foreground line-clamp-2 mb-3 font-medium">
          {campaign.description}
        </p>
      )}

      {/* Meta info */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium">
        <Clock className="w-3.5 h-3.5" />
        <span>
          Updated {formatDistanceToNow(new Date(campaign.updatedAt), { addSuffix: true })}
        </span>
        <ChevronRight className="w-3.5 h-3.5 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </Link>
  )
}

// Section component
// eslint-disable-next-line max-lines-per-function -- near-borderline, extraction would hurt readability
export function DashboardSection({
  title,
  icon: Icon,
  children,
  viewAllLink,
  viewAllLabel = 'View all',
  isEmpty = false,
  emptyIcon: EmptyIcon,
  emptyTitle,
  emptyDescription,
}: {
  title: string
  icon: typeof Calendar
  children: React.ReactNode
  viewAllLink: string
  viewAllLabel?: string
  isEmpty?: boolean
  emptyIcon?: typeof Calendar
  emptyTitle?: string
  emptyDescription?: string
}) {
  return (
    <section className="animate-fade-in">
      {/* Section header */}
      <div className="flex items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-2 rounded-md bg-primary/10 shrink-0 border-2 border-primary/30">
            <Icon className="w-4 h-4 text-primary" />
          </div>
          <h2 className="text-sm font-extrabold uppercase tracking-widest text-foreground truncate">
            {title}
          </h2>
        </div>
        {!isEmpty && (
          <Link
            href={viewAllLink}
            className="text-xs font-bold text-muted-foreground hover:text-primary transition-colors flex items-center gap-1 whitespace-nowrap shrink-0"
          >
            {viewAllLabel}
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        )}
      </div>

      {/* Content or empty state */}
      {isEmpty ? (
        <div className="text-center py-8 px-4 rounded-md border-[3px] border-dashed border-border bg-card">
          {EmptyIcon && (
            <div className="w-14 h-14 mx-auto mb-3 rounded-md bg-primary/10 flex items-center justify-center border-2 border-primary/30">
              <EmptyIcon className="w-6 h-6 text-primary" />
            </div>
          )}
          <p className="text-sm font-bold mb-1">{emptyTitle}</p>
          <p className="text-xs text-muted-foreground">{emptyDescription}</p>
        </div>
      ) : (
        <div className="space-y-3">{children}</div>
      )}
    </section>
  )
}
