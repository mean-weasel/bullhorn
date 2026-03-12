'use client'

import { format } from 'date-fns'
import { Plus, X, ChevronDown, ChevronUp } from 'lucide-react'
import { Post, RedditContent, isRedditContent } from '@/lib/posts'
import { cn } from '@/lib/utils'
import { IOSDateTimePicker } from '@/components/ui/IOSDateTimePicker'

interface RedditSettingsProps {
  post: Post
  onPostChange: (updater: (prev: Post) => Post) => void
  redditUrl: string
  onRedditUrlChange: (url: string) => void
  newSubreddit: string
  onNewSubredditChange: (value: string) => void
  subredditsInput: string[]
  onSubredditsInputChange: (updater: (prev: string[]) => string[]) => void
  subredditTitles: Record<string, string>
  onUpdateSubredditTitle: (subreddit: string, title: string) => void
  subredditSchedules: Record<string, string>
  onUpdateSubredditSchedule: (subreddit: string, isoString: string | null) => void
  expandedSubreddits: Record<string, boolean>
  onToggleSubredditExpanded: (subreddit: string) => void
  onRemoveSubreddit: (subreddit: string) => void
}

export const RedditSettings = ({
  post,
  onPostChange,
  redditUrl,
  onRedditUrlChange,
  newSubreddit,
  onNewSubredditChange,
  subredditsInput,
  onSubredditsInputChange,
  subredditTitles,
  onUpdateSubredditTitle,
  subredditSchedules,
  onUpdateSubredditSchedule,
  expandedSubreddits,
  onToggleSubredditExpanded,
  onRemoveSubreddit,
}: RedditSettingsProps) => {
  if (post.platform !== 'reddit') {
    return null
  }

  const addSubreddit = (value: string) => {
    const sub = value.trim().replace(/^r\//, '')
    if (sub && !subredditsInput.includes(sub)) {
      onSubredditsInputChange((prev) => [...prev, sub])
    }
    onNewSubredditChange('')
  }

  return (
    <div className="mb-6 p-4 rounded-xl border border-reddit/30 bg-reddit/5 space-y-4 animate-slide-up">
      <div className="flex items-center gap-2 text-reddit text-xs font-medium mb-1">
        <span className="w-2 h-2 rounded-full bg-reddit" />
        Reddit Settings
      </div>

      {/* Subreddits - multi-select tags */}
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
          Subreddits{' '}
          {subredditsInput.length > 0 && (
            <span className="text-reddit">({subredditsInput.length})</span>
          )}
        </label>
        <div className="flex items-center gap-2 mb-2">
          <span className="px-3 py-2.5 rounded-l-lg bg-muted border border-r-0 border-border text-muted-foreground text-sm">
            r/
          </span>
          <input
            type="text"
            value={newSubreddit}
            onChange={(e) => onNewSubredditChange(e.target.value.replace(/^r\//, ''))}
            onKeyDown={(e) => {
              if ((e.key === 'Enter' || e.key === ',') && newSubreddit.trim()) {
                e.preventDefault()
                addSubreddit(newSubreddit)
              }
            }}
            placeholder="Type subreddit, press Enter"
            className="flex-1 px-4 py-2.5 rounded-r-lg bg-background border border-border focus:outline-hidden focus:border-reddit"
          />
          <button
            type="button"
            onClick={() => addSubreddit(newSubreddit)}
            disabled={!newSubreddit.trim()}
            className="p-2.5 rounded-lg bg-reddit text-white hover:bg-reddit/90 disabled:opacity-50 transition-colors"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs text-muted-foreground mt-1.5">
          Add subreddits to cross-post. Each gets its own title and schedule.
        </p>
      </div>

      {/* Collapsible cards for each subreddit */}
      {subredditsInput.length > 0 && (
        <div className="space-y-3">
          {subredditsInput.map((sub) => {
            const isExpanded = !!expandedSubreddits[sub]
            const title = subredditTitles[sub] || ''
            const schedule = subredditSchedules[sub]
            const schedulePreview = schedule
              ? format(new Date(schedule), 'MMM d, h:mm a')
              : 'No schedule'

            return (
              <div key={sub} data-testid={`subreddit-card-${sub}`}>
                {/* Card Header */}
                <div
                  className={cn(
                    'w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all',
                    isExpanded
                      ? 'border-reddit/30 bg-reddit/5'
                      : 'border-border bg-card hover:border-reddit/30'
                  )}
                >
                  <button
                    type="button"
                    onClick={() => onToggleSubredditExpanded(sub)}
                    className="flex items-center gap-2 text-sm font-medium flex-1 min-w-0 text-left"
                    data-testid={`subreddit-toggle-${sub}`}
                  >
                    <span className="text-reddit font-semibold">r/{sub}</span>
                    {!isExpanded && (
                      <span className="text-xs text-muted-foreground truncate">
                        — {title || 'No title'} • {schedulePreview}
                      </span>
                    )}
                  </button>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onRemoveSubreddit(sub)}
                      className="p-1 rounded-full hover:bg-reddit/20 text-muted-foreground hover:text-reddit transition-colors"
                      aria-label="Remove subreddit"
                    >
                      <X className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onToggleSubredditExpanded(sub)}
                      className="p-1"
                    >
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Card Body */}
                {isExpanded && (
                  <div className="mt-2 p-4 rounded-xl border border-reddit/20 bg-background/50 space-y-4 animate-slide-up">
                    {/* Title Input */}
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                        Post Title
                      </label>
                      <input
                        type="text"
                        value={title}
                        onChange={(e) => onUpdateSubredditTitle(sub, e.target.value)}
                        placeholder={`Title for r/${sub}`}
                        data-testid={`subreddit-title-${sub}`}
                        className="w-full px-4 py-2.5 rounded-lg bg-background border border-border focus:outline-hidden focus:border-reddit"
                      />
                      <p className="text-xs text-muted-foreground mt-1.5">
                        {title.length} / 300 characters
                      </p>
                    </div>

                    {/* Schedule Inputs */}
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                        Schedule (optional)
                      </label>
                      <div className="flex items-center gap-2">
                        <IOSDateTimePicker
                          value={schedule ? new Date(schedule) : null}
                          onChange={(date) =>
                            onUpdateSubredditSchedule(sub, date?.toISOString() || null)
                          }
                          mode="date"
                          placeholder="Date"
                          className="flex-1"
                          data-testid={`subreddit-date-${sub}`}
                        />
                        <IOSDateTimePicker
                          value={schedule ? new Date(schedule) : null}
                          onChange={(date) =>
                            onUpdateSubredditSchedule(sub, date?.toISOString() || null)
                          }
                          mode="time"
                          placeholder="Time"
                          className="w-[120px]"
                          data-testid={`subreddit-time-${sub}`}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground mt-1.5">
                        Leave blank to use the default schedule above.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
          Flair (optional)
        </label>
        <input
          type="text"
          value={(isRedditContent(post.content) && post.content.flairText) || ''}
          onChange={(e) =>
            onPostChange((prev) => ({
              ...prev,
              content: {
                ...(prev.content as RedditContent),
                flairText: e.target.value,
              },
            }))
          }
          placeholder="e.g., Show and Tell"
          className="w-full px-4 py-2.5 rounded-lg bg-background border border-border focus:outline-hidden focus:border-reddit"
        />
      </div>
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
          Link URL (optional)
        </label>
        <input
          type="url"
          value={redditUrl}
          onChange={(e) => onRedditUrlChange(e.target.value)}
          placeholder="https://youtube.com/watch?v=... or any URL"
          className="w-full px-4 py-2.5 rounded-lg bg-background border border-border focus:outline-hidden focus:border-reddit"
        />
        <p className="text-xs text-muted-foreground mt-1.5">
          Add a URL for link posts (YouTube, articles, etc.). Leave empty for text posts.
        </p>
      </div>
    </div>
  )
}
