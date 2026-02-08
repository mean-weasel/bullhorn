'use client'

import { Post, LinkedInContent, isLinkedInContent } from '@/lib/posts'
import { cn } from '@/lib/utils'

interface LinkedInSettingsProps {
  post: Post
  onPostChange: (updater: (prev: Post) => Post) => void
}

export const LinkedInSettings = ({ post, onPostChange }: LinkedInSettingsProps) => {
  if (post.platform !== 'linkedin') {
    return null
  }

  return (
    <div className="mb-6 p-4 rounded-xl border border-linkedin/30 bg-linkedin/5 animate-slide-up">
      <div className="flex items-center gap-2 text-linkedin text-xs font-medium mb-3">
        <span className="w-2 h-2 rounded-full bg-linkedin" />
        LinkedIn Settings
      </div>
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
          Visibility
        </label>
        <div className="flex gap-2">
          {(['public', 'connections'] as const).map((vis) => (
            <button
              key={vis}
              type="button"
              onClick={() =>
                onPostChange((prev) => ({
                  ...prev,
                  content: {
                    ...(prev.content as LinkedInContent),
                    visibility: vis,
                  },
                }))
              }
              className={cn(
                'flex-1 px-4 py-2.5 rounded-lg border text-sm font-medium transition-all',
                isLinkedInContent(post.content) && post.content.visibility === vis
                  ? 'border-linkedin bg-linkedin/10 text-linkedin'
                  : 'border-border bg-background text-muted-foreground hover:border-linkedin/50'
              )}
            >
              {vis === 'public' ? 'Public' : 'Connections Only'}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
