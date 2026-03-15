'use client'

import { LaunchPost, LAUNCH_PLATFORM_INFO } from '@/lib/launchPosts'
import { cn } from '@/lib/utils'

// eslint-disable-next-line max-lines-per-function -- near-borderline, extraction would hurt readability
export function AddLaunchPostModal({
  launchPosts,
  onClose,
  onAdd,
}: {
  launchPosts: LaunchPost[]
  onClose: () => void
  onAdd: (launchPostId: string) => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-xs" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-xl shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col animate-scale-in">
        <div className="p-4 border-b border-border">
          <h2 className="text-lg font-display font-bold">Add Launch Post</h2>
          <p className="text-sm text-muted-foreground">
            Select a launch post to add to this campaign
          </p>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {launchPosts.map((launchPost) => {
            const platformInfo = LAUNCH_PLATFORM_INFO[launchPost.platform]
            return (
              <button
                key={launchPost.id}
                onClick={() => onAdd(launchPost.id)}
                className="w-full text-left p-3 bg-background border border-border rounded-lg hover:border-[hsl(var(--gold))]/50 transition-colors"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={cn(
                      'w-6 h-6 rounded flex items-center justify-center text-xs font-bold',
                      platformInfo.bgColor,
                      platformInfo.color
                    )}
                  >
                    {platformInfo.icon}
                  </span>
                  <span className="text-xs text-muted-foreground">{platformInfo.label}</span>
                  <span className="text-xs text-muted-foreground capitalize">
                    • {launchPost.status}
                  </span>
                </div>
                <p className="text-sm line-clamp-2 font-medium">{launchPost.title}</p>
              </button>
            )
          })}
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
