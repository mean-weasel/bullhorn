'use client'

import { Image } from 'lucide-react'
import { Post, isRedditContent } from '@/lib/posts'
import { cn } from '@/lib/utils'
import { getMediaUrl } from '@/lib/media'

interface PreviewPanelProps {
  post: Post
  content: string
  mediaUrls: string[]
  linkedInMediaUrl: string
  redditUrl: string
  subredditsInput: string[]
}

export const PreviewPanel = ({
  post,
  content,
  mediaUrls,
  linkedInMediaUrl,
  redditUrl,
  subredditsInput,
}: PreviewPanelProps) => {
  return (
    <div
      data-testid="preview-panel"
      className="hidden lg:block border-l-[3px] border-border bg-card p-6 overflow-y-auto"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
          Live Preview
        </h3>
      </div>

      <div className="space-y-4">
        {post.platform === 'twitter' && <TwitterPreview content={content} mediaUrls={mediaUrls} />}
        {post.platform === 'linkedin' && (
          <LinkedInPreview content={content} linkedInMediaUrl={linkedInMediaUrl} />
        )}
        {post.platform === 'reddit' && (
          <RedditPreview
            post={post}
            content={content}
            redditUrl={redditUrl}
            subredditsInput={subredditsInput}
          />
        )}
      </div>
    </div>
  )
}

// --- Sub-components for each platform preview ---

const TwitterPreview = ({ content, mediaUrls }: { content: string; mediaUrls: string[] }) => {
  return (
    <div className="animate-slide-up" style={{ animationDelay: '100ms' }}>
      <div className="flex items-center gap-2 text-twitter text-xs font-medium mb-2">
        <span className="w-2 h-2 rounded-full bg-twitter" />
        Twitter / X
      </div>
      <div className="bg-[#15202B] rounded-2xl p-4">
        <div className="flex gap-3 mb-3">
          <div className="w-10 h-10 rounded-full bg-linear-to-br from-purple-500 to-pink-500" />
          <div>
            <div className="font-bold text-[15px] text-[#E7E9EA]">Your Name</div>
            <div className="text-[15px] text-[#71767B]">@yourhandle</div>
          </div>
        </div>
        <div className="text-[15px] leading-[1.4] text-[#E7E9EA] whitespace-pre-wrap">
          {content || 'Your tweet will appear here...'}
        </div>
        {mediaUrls.length > 0 && (
          <div
            className={cn(
              'mt-3 grid gap-1 rounded-xl overflow-hidden',
              mediaUrls.length === 1 && 'grid-cols-1',
              mediaUrls.length === 2 && 'grid-cols-2',
              mediaUrls.length >= 3 && 'grid-cols-2'
            )}
          >
            {mediaUrls.slice(0, 4).map((url, idx) => (
              <div
                key={idx}
                className={cn(
                  'relative bg-[#1D2A35] flex items-center justify-center',
                  mediaUrls.length === 1 ? 'h-48' : 'h-24',
                  mediaUrls.length === 3 && idx === 0 && 'row-span-2 h-48'
                )}
              >
                <img
                  src={getMediaUrl(url)}
                  alt={`Media ${idx + 1}`}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement
                    target.style.display = 'none'
                  }}
                />
                <div className="absolute inset-0 flex items-center justify-center text-[#71767B] text-xs">
                  <Image className="w-6 h-6 opacity-50" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

const LinkedInPreview = ({
  content,
  linkedInMediaUrl,
}: {
  content: string
  linkedInMediaUrl: string
}) => {
  return (
    <div className="animate-slide-up" style={{ animationDelay: '200ms' }}>
      <div className="flex items-center gap-2 text-linkedin text-xs font-medium mb-2">
        <span className="w-2 h-2 rounded-full bg-linkedin" />
        LinkedIn
      </div>
      <div className="bg-card rounded-lg p-4 border border-border">
        <div className="flex gap-3 mb-3">
          <div className="w-12 h-12 rounded-full bg-linear-to-br from-purple-500 to-pink-500" />
          <div>
            <div className="font-semibold text-sm text-foreground">Your Name</div>
            <div className="text-xs text-muted-foreground">Software Engineer at Company</div>
            <div className="text-xs text-muted-foreground">Just now</div>
          </div>
        </div>
        <div className="text-sm leading-normal text-foreground whitespace-pre-wrap">
          {content || 'Your LinkedIn post will appear here...'}
        </div>
        {linkedInMediaUrl && (
          <div className="mt-3 rounded-lg overflow-hidden bg-secondary">
            <img
              src={getMediaUrl(linkedInMediaUrl)}
              alt="LinkedIn media"
              className="w-full h-40 object-cover"
              onError={(e) => {
                const target = e.target as HTMLImageElement
                target.style.display = 'none'
              }}
            />
          </div>
        )}
      </div>
    </div>
  )
}

const RedditPreview = ({
  post,
  content,
  redditUrl,
  subredditsInput,
}: {
  post: Post
  content: string
  redditUrl: string
  subredditsInput: string[]
}) => {
  return (
    <div className="animate-slide-up" style={{ animationDelay: '300ms' }}>
      <div className="flex items-center gap-2 text-reddit text-xs font-medium mb-2">
        <span className="w-2 h-2 rounded-full bg-reddit" />
        Reddit {redditUrl ? '(Link Post)' : '(Text Post)'}
      </div>
      <div className="bg-[#1A1A1B] border border-[#343536] rounded">
        <div className="flex items-center gap-2 px-3 py-2 text-xs text-[#818384]">
          <span className="font-bold text-[#D7DADC]">
            {subredditsInput.length
              ? subredditsInput.map((s: string) => `r/${s}`).join(', ')
              : 'r/subreddit'}
          </span>
          • Posted by u/yourname
        </div>
        <div className="px-3 text-lg font-medium text-[#D7DADC]">
          {(isRedditContent(post.content) && post.content.title) || 'Your post title'}
        </div>
        {redditUrl && <div className="px-3 py-2 text-xs text-[#4FBCFF] truncate">{redditUrl}</div>}
        <div className="p-3 text-sm text-[#D7DADC] whitespace-pre-wrap">
          {content || 'Your Reddit post will appear here...'}
        </div>
      </div>
    </div>
  )
}
