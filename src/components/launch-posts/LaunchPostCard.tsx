'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import {
  ExternalLink,
  Edit2,
  Trash2,
  MoreVertical,
  Copy,
  Clock,
  CheckCircle2,
  FileText,
  Share2,
} from 'lucide-react'
import { LaunchPost, LAUNCH_PLATFORM_INFO, LAUNCH_PLATFORM_URLS } from '@/lib/launchPosts'
import { cn } from '@/lib/utils'
import { openInBrowser } from '@/lib/nativeBrowser'
import { copyToClipboard } from '@/lib/nativeClipboard'
import { shareContent, isShareAvailable } from '@/lib/nativeShare'

interface LaunchPostCardProps {
  post: LaunchPost
  index?: number
  onEdit?: () => void
  onDelete?: () => void
  onCopy?: () => void
}

export function LaunchPostCard({ post, index = 0, onEdit, onDelete, onCopy }: LaunchPostCardProps) {
  const [showMenu, setShowMenu] = useState(false)
  const platformInfo = LAUNCH_PLATFORM_INFO[post.platform]
  const platformUrl = LAUNCH_PLATFORM_URLS[post.platform]

  const statusConfig = {
    draft: { label: 'Draft', icon: FileText, color: 'text-muted-foreground', emoji: '📝' },
    scheduled: { label: 'Scheduled', icon: Clock, color: 'text-sticker-orange', emoji: '📅' },
    posted: { label: 'Posted', icon: CheckCircle2, color: 'text-sticker-green', emoji: '✅' },
  }

  const status = statusConfig[post.status]

  const handleOpenPlatform = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    openInBrowser(platformUrl)
  }

  const handleCopyFields = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    // Build copy text based on platform
    let copyText = `Title: ${post.title}\n`
    if (post.url) copyText += `URL: ${post.url}\n`
    if (post.description) copyText += `Description: ${post.description}\n`

    copyToClipboard(copyText)
    onCopy?.()
    setShowMenu(false)
  }

  const handleShare = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    await shareContent({
      title: post.title,
      text: post.description || post.title,
      url: post.url || platformUrl,
    })
    setShowMenu(false)
  }

  return (
    <div
      data-testid="launch-post-card"
      className={cn(
        'p-3 md:p-4 bg-card rounded-md group',
        'border-[3px] border-border',
        'shadow-sticker-sm',
        'hover:translate-y-[-2px] hover:shadow-[5px_5px_0_hsl(var(--border))]',
        'transition-all',
        'animate-slide-up'
      )}
      style={{ animationDelay: `${index * 30}ms` }}
    >
      <div className="flex items-start gap-3 md:gap-4">
        {/* Platform Icon */}
        <div
          className={cn(
            'w-10 h-10 md:w-12 md:h-12 rounded-md flex items-center justify-center shrink-0',
            'font-bold text-sm md:text-base',
            'border-2',
            platformInfo.bgColor,
            platformInfo.color
          )}
        >
          {platformInfo.icon}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span
              className={cn(
                'text-xs font-bold px-2 py-0.5 rounded-full border',
                platformInfo.bgColor,
                platformInfo.color
              )}
            >
              {platformInfo.label}
            </span>
            <span className={cn('text-xs font-bold flex items-center gap-1', status.color)}>
              <span>{status.emoji}</span>
              {status.label}
            </span>
          </div>

          <h3 className="font-bold mb-1 line-clamp-1">{post.title}</h3>

          {post.description && (
            <p className="text-sm text-muted-foreground line-clamp-2 mb-2">{post.description}</p>
          )}

          <div className="flex flex-wrap items-center gap-2 md:gap-4 text-xs text-muted-foreground font-medium">
            {post.url && (
              <a
                href={post.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-1 hover:text-foreground transition-colors truncate max-w-[200px]"
              >
                <ExternalLink className="w-3 h-3 shrink-0" />
                <span className="truncate">{new URL(post.url).hostname}</span>
              </a>
            )}

            {post.scheduledAt && (
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {format(new Date(post.scheduledAt), 'MMM d, yyyy')}
              </span>
            )}

            {post.postedAt && (
              <span className="flex items-center gap-1 text-sticker-green font-bold">
                <CheckCircle2 className="w-3 h-3" />
                Posted {format(new Date(post.postedAt), 'MMM d')}
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="relative">
          <button
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setShowMenu(!showMenu)
            }}
            className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent border-2 border-transparent hover:border-border transition-all min-w-[40px] min-h-[40px] flex items-center justify-center"
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {showMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
              <div className="absolute right-0 top-full mt-1 z-20 bg-card border-[3px] border-border rounded-md shadow-sticker py-1 min-w-[160px]">
                {onEdit && (
                  <button
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      setShowMenu(false)
                      onEdit()
                    }}
                    className="flex items-center gap-2 px-3 py-2 text-sm font-medium hover:bg-accent transition-colors w-full text-left"
                  >
                    <Edit2 className="w-4 h-4" />
                    Edit
                  </button>
                )}

                <button
                  onClick={handleCopyFields}
                  className="flex items-center gap-2 px-3 py-2 text-sm font-medium hover:bg-accent transition-colors w-full text-left"
                >
                  <Copy className="w-4 h-4" />
                  Copy Fields
                </button>

                {isShareAvailable() && (
                  <button
                    onClick={handleShare}
                    className="flex items-center gap-2 px-3 py-2 text-sm font-medium hover:bg-accent transition-colors w-full text-left"
                  >
                    <Share2 className="w-4 h-4" />
                    Share
                  </button>
                )}

                <button
                  onClick={handleOpenPlatform}
                  className="flex items-center gap-2 px-3 py-2 text-sm font-medium hover:bg-accent transition-colors w-full text-left"
                >
                  <ExternalLink className="w-4 h-4" />
                  Open {platformInfo.name}
                </button>

                {onDelete && (
                  <button
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      setShowMenu(false)
                      onDelete()
                    }}
                    className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-destructive hover:bg-accent transition-colors w-full text-left"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
