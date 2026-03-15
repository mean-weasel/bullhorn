'use client'

import { Link, ChevronDown, ChevronUp } from 'lucide-react'
import {
  Post,
  LinkedInContent,
  RedditContent,
  isTwitterContent,
  isLinkedInContent,
  isRedditContent,
} from '@/lib/posts'
import { cn } from '@/lib/utils'

interface PublishedLinksProps {
  post: Post
  onPostChange: (updater: (prev: Post) => Post) => void
  showPublishedLinks: boolean
  onToggle: () => void
  subredditsInput: string[]
  className?: string
}

// eslint-disable-next-line max-lines-per-function
export const PublishedLinks = ({
  post,
  onPostChange,
  showPublishedLinks,
  onToggle,
  subredditsInput,
  className,
}: PublishedLinksProps) => {
  const hasLaunchedUrl =
    (isTwitterContent(post.content) && post.content.launchedUrl) ||
    (isLinkedInContent(post.content) && post.content.launchedUrl) ||
    (isRedditContent(post.content) && post.content.launchedUrl)

  return (
    <div className={className}>
      <button
        onClick={onToggle}
        className={cn(
          'w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all',
          showPublishedLinks || hasLaunchedUrl
            ? 'border-primary/30 bg-primary/5'
            : 'border-border bg-card hover:border-primary/30'
        )}
      >
        <div className="flex items-center gap-2 text-sm font-medium">
          <Link className="w-4 h-4 text-primary" />
          <span>Published Links</span>
          {hasLaunchedUrl ? <span className="text-xs text-primary">(1)</span> : null}
        </div>
        {showPublishedLinks ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        )}
      </button>
      {showPublishedLinks && (
        <div className="mt-2 space-y-3 animate-slide-up">
          {/* Twitter launched URL */}
          {post.platform === 'twitter' && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-card border border-border">
              <div className="flex items-center gap-2 min-w-[100px]">
                <span className="w-2 h-2 rounded-full bg-twitter" />
                <span className="text-sm font-medium text-twitter">Twitter</span>
              </div>
              <input
                type="url"
                value={(isTwitterContent(post.content) && post.content.launchedUrl) || ''}
                onChange={(e) =>
                  onPostChange((prev) => ({
                    ...prev,
                    content: {
                      ...(prev.content as { text: string }),
                      launchedUrl: e.target.value,
                    },
                  }))
                }
                placeholder="https://twitter.com/user/status/..."
                className="flex-1 px-3 py-2 rounded-lg bg-background border border-border text-sm focus:outline-hidden focus:border-twitter"
              />
            </div>
          )}

          {/* LinkedIn launched URL */}
          {post.platform === 'linkedin' && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-card border border-border">
              <div className="flex items-center gap-2 min-w-[100px]">
                <span className="w-2 h-2 rounded-full bg-linkedin" />
                <span className="text-sm font-medium text-linkedin">LinkedIn</span>
              </div>
              <input
                type="url"
                value={(isLinkedInContent(post.content) && post.content.launchedUrl) || ''}
                onChange={(e) =>
                  onPostChange((prev) => ({
                    ...prev,
                    content: {
                      ...(prev.content as LinkedInContent),
                      launchedUrl: e.target.value,
                    },
                  }))
                }
                placeholder="https://linkedin.com/posts/..."
                className="flex-1 px-3 py-2 rounded-lg bg-background border border-border text-sm focus:outline-hidden focus:border-linkedin"
              />
            </div>
          )}

          {/* Reddit launched URL */}
          {post.platform === 'reddit' &&
            (!subredditsInput.length ? (
              <p className="text-sm text-muted-foreground italic p-3 rounded-lg bg-card border border-border">
                Add subreddits above to track published links.
              </p>
            ) : (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-card border border-border">
                <div className="flex items-center gap-2 min-w-[100px]">
                  <span className="w-2 h-2 rounded-full bg-reddit" />
                  <span className="text-sm font-medium text-reddit">
                    {subredditsInput.length === 1
                      ? `r/${subredditsInput[0]}`
                      : `Reddit (${subredditsInput.length})`}
                  </span>
                </div>
                <input
                  type="url"
                  value={(isRedditContent(post.content) && post.content.launchedUrl) || ''}
                  onChange={(e) =>
                    onPostChange((prev) => ({
                      ...prev,
                      content: {
                        ...(prev.content as RedditContent),
                        launchedUrl: e.target.value,
                      },
                    }))
                  }
                  placeholder="https://reddit.com/r/..."
                  className="flex-1 px-3 py-2 rounded-lg bg-background border border-border text-sm focus:outline-hidden focus:border-reddit"
                />
              </div>
            ))}

          <p className="text-xs text-muted-foreground px-1">
            Add URLs after publishing to track where your content was posted.
          </p>
        </div>
      )}
    </div>
  )
}
