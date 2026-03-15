'use client'

import { useState } from 'react'
import { Copy, CheckCircle, Share2, Bell, ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'
import { copyToClipboard } from '@/lib/nativeClipboard'
import { Post, PLATFORM_INFO, getPostPreviewText, isRedditContent } from '@/lib/posts'
import toast from 'react-hot-toast'

interface PostActionsProps {
  post: Post
  onMarkAsPublished: () => void
  className?: string
}

function getPlatformUrl(post: Post): string | null {
  const p = post.platform
  if (p === 'twitter') return 'https://x.com/compose/post'
  if (p === 'linkedin') return 'https://www.linkedin.com/feed/'
  if (p === 'reddit' && isRedditContent(post.content)) {
    const sub = post.content.subreddit
    return sub ? `https://www.reddit.com/r/${sub}/submit` : 'https://www.reddit.com/submit'
  }
  return null
}

// eslint-disable-next-line max-lines-per-function
export function PostActions({ post, onMarkAsPublished, className }: PostActionsProps) {
  const [copied, setCopied] = useState(false)

  const text = getPostPreviewText(post)
  const platformInfo = PLATFORM_INFO[post.platform]
  const platformUrl = getPlatformUrl(post)

  const handleCopy = async () => {
    const success = await copyToClipboard(text)
    if (success) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      toast.success('Copied to clipboard')
    } else {
      toast.error('Failed to copy')
    }
  }

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ text })
        toast.success('Shared successfully')
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          toast.error('Share failed')
        }
      }
    } else {
      handleCopy()
    }
  }

  return (
    <div
      className={cn(
        'p-4 rounded-md',
        'bg-sticker-orange/10 border-[3px] border-sticker-orange/30',
        'shadow-sticker-sm',
        className
      )}
    >
      <div className="flex items-center gap-2 mb-3">
        <Bell className="w-5 h-5 text-sticker-orange" />
        <h3 className="font-extrabold text-sm">Ready to Publish</h3>
      </div>

      <p className="text-sm text-muted-foreground mb-4">
        Copy your content and post it on {platformInfo.name}, then mark it as published.
      </p>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={handleCopy}
          className={cn(
            'flex items-center gap-2 px-4 py-2.5',
            'rounded-md min-h-[44px]',
            'bg-primary text-primary-foreground font-bold text-sm',
            'border-[3px] border-border',
            'shadow-sticker-sm',
            'hover:-translate-y-px hover:shadow-sticker',
            'active:translate-y-px active:shadow-sticker-hover',
            'transition-all'
          )}
        >
          {copied ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          {copied ? 'Copied!' : 'Copy Content'}
        </button>

        {typeof navigator !== 'undefined' && 'share' in navigator && (
          <button
            onClick={handleShare}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5',
              'rounded-md min-h-[44px]',
              'bg-secondary text-secondary-foreground font-bold text-sm',
              'border-[3px] border-border',
              'shadow-sticker-sm',
              'hover:-translate-y-px hover:shadow-sticker',
              'active:translate-y-px active:shadow-sticker-hover',
              'transition-all'
            )}
          >
            <Share2 className="w-4 h-4" />
            Share
          </button>
        )}

        {platformUrl && (
          <a
            href={platformUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              'flex items-center gap-2 px-4 py-2.5',
              'rounded-md min-h-[44px]',
              'bg-secondary text-secondary-foreground font-bold text-sm',
              'border-[3px] border-border',
              'shadow-sticker-sm',
              'hover:-translate-y-px hover:shadow-sticker',
              'active:translate-y-px active:shadow-sticker-hover',
              'transition-all'
            )}
          >
            <ExternalLink className="w-4 h-4" />
            Open {platformInfo.label}
          </a>
        )}

        <button
          onClick={onMarkAsPublished}
          className={cn(
            'flex items-center gap-2 px-4 py-2.5',
            'rounded-md min-h-[44px]',
            'bg-sticker-green/20 text-sticker-green font-bold text-sm',
            'border-[3px] border-sticker-green/30',
            'shadow-sticker-sm',
            'hover:-translate-y-px hover:shadow-sticker',
            'active:translate-y-px active:shadow-sticker-hover',
            'transition-all'
          )}
        >
          <CheckCircle className="w-4 h-4" />
          Mark as Published
        </button>
      </div>
    </div>
  )
}
