'use client'

import { Post, getPostPreviewText } from '@/lib/posts'
import { cn } from '@/lib/utils'

export function AddPostModal({
  posts,
  onClose,
  onAdd,
}: {
  posts: Post[]
  onClose: () => void
  onAdd: (postId: string) => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-xs" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-xl shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col animate-scale-in">
        <div className="p-4 border-b border-border">
          <h2 className="text-lg font-display font-bold">Add Existing Post</h2>
          <p className="text-sm text-muted-foreground">Select a post to add to this campaign</p>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {posts.map((post) => (
            <button
              key={post.id}
              onClick={() => onAdd(post.id)}
              className="w-full text-left p-3 bg-background border border-border rounded-lg hover:border-[hsl(var(--gold))]/50 transition-colors"
            >
              <div className="flex items-center gap-2 mb-1">
                <span
                  className={cn(
                    'w-2 h-2 rounded-full',
                    post.platform === 'twitter' && 'bg-twitter',
                    post.platform === 'linkedin' && 'bg-linkedin',
                    post.platform === 'reddit' && 'bg-reddit'
                  )}
                />
                <span className="text-xs text-muted-foreground capitalize">{post.status}</span>
              </div>
              <p className="text-sm line-clamp-2">
                {getPostPreviewText(post) || (
                  <span className="text-muted-foreground italic">No content</span>
                )}
              </p>
            </button>
          ))}
        </div>
        <div className="p-4 border-t border-border">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-accent transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
