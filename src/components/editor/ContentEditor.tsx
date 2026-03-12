'use client'

import { Image, Check, Copy } from 'lucide-react'
import { Platform, CHAR_LIMITS } from '@/lib/posts'
import { cn } from '@/lib/utils'

interface ContentEditorProps {
  content: string
  onContentChange: (content: string) => void
  platform: Platform
  copied: boolean
  onCopy: () => void
  showMediaInput: boolean
  onToggleMedia: () => void
  mediaCount: number
  className?: string
}

export const ContentEditor = ({
  content,
  onContentChange,
  platform,
  copied,
  onCopy,
  showMediaInput,
  onToggleMedia,
  mediaCount,
  className,
}: ContentEditorProps) => {
  const limit = CHAR_LIMITS[platform]
  const len = content.length
  const pct = (len / limit) * 100

  return (
    <div className={className}>
      <label
        htmlFor="content-editor"
        className="block text-xs font-extrabold uppercase tracking-wider text-muted-foreground mb-2"
      >
        Content
      </label>
      <textarea
        id="content-editor"
        value={content}
        onChange={(e) => onContentChange(e.target.value)}
        placeholder="What's on your mind? Share your thoughts, announce something exciting, or start a conversation..."
        className={cn(
          'w-full min-h-[150px] md:min-h-[200px] p-3 md:p-4 rounded-md',
          'bg-card border-[3px] border-border',
          'shadow-sticker-sm',
          'text-base leading-relaxed',
          'placeholder:text-muted-foreground',
          'focus:outline-hidden focus:ring-2 focus:ring-primary/50',
          'resize-y transition-all'
        )}
      />
      <div className="flex items-center justify-between mt-3">
        <div className="flex gap-4">
          <div className="flex items-center gap-2 text-xs">
            <span
              className={cn(
                'w-1.5 h-1.5 rounded-full',
                platform === 'twitter' && 'bg-twitter',
                platform === 'linkedin' && 'bg-linkedin',
                platform === 'reddit' && 'bg-reddit'
              )}
            />
            <span
              className={cn(
                'font-mono font-medium',
                pct > 100
                  ? 'text-destructive'
                  : pct > 90
                    ? 'text-yellow-500'
                    : 'text-muted-foreground'
              )}
            >
              {len}
            </span>
            <span className="text-muted-foreground">/ {limit}</span>
          </div>
        </div>
        <div className="flex gap-1">
          <button
            onClick={onCopy}
            disabled={!content.trim()}
            className={cn(
              'p-2 rounded-md transition-colors',
              copied
                ? 'bg-green-500/10 text-green-500'
                : 'hover:bg-accent text-muted-foreground hover:text-foreground',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
            title={copied ? 'Copied!' : 'Copy to clipboard'}
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          </button>
          <button
            onClick={onToggleMedia}
            className={cn(
              'flex items-center p-2 rounded-md transition-colors',
              showMediaInput || mediaCount > 0
                ? 'bg-primary/10 text-primary'
                : 'hover:bg-accent text-muted-foreground hover:text-foreground'
            )}
            title="Add media (images/videos)"
          >
            <Image className="w-4 h-4" />
            {mediaCount > 0 && <span className="ml-1 text-xs">{mediaCount}</span>}
          </button>
        </div>
      </div>
    </div>
  )
}
