'use client'

import { Image, X } from 'lucide-react'
import { Platform } from '@/lib/posts'
import { MediaUpload } from '@/components/ui/MediaUpload'

interface MediaSectionProps {
  platform: Platform
  showMediaInput: boolean
  onClose: () => void
  mediaUrls: string[]
  onMediaUrlsChange: (urls: string[]) => void
  linkedInMediaUrl: string
  onLinkedInMediaUrlChange: (url: string) => void
}

// eslint-disable-next-line max-lines-per-function -- borderline, extraction would hurt readability
export const MediaSection = ({
  platform,
  showMediaInput,
  onClose,
  mediaUrls,
  onMediaUrlsChange,
  linkedInMediaUrl,
  onLinkedInMediaUrlChange,
}: MediaSectionProps) => {
  if (!showMediaInput || (platform !== 'twitter' && platform !== 'linkedin')) {
    return null
  }

  return (
    <div className="mb-6 p-4 rounded-xl border border-border bg-accent/30 animate-slide-up">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-foreground text-xs font-medium">
          <Image className="w-4 h-4" />
          Media Attachments
        </div>
        <button onClick={onClose} className="p-1 rounded hover:bg-accent text-muted-foreground">
          <X className="w-4 h-4" />
        </button>
      </div>

      {platform === 'twitter' && (
        <div className="mb-4">
          <div className="flex items-center gap-2 text-twitter text-xs font-medium mb-2">
            <span className="w-2 h-2 rounded-full bg-twitter" />
            Twitter (up to 4 images or 1 video)
          </div>
          <MediaUpload
            platform="twitter"
            maxFiles={4}
            existingMedia={mediaUrls}
            onMediaChange={onMediaUrlsChange}
          />
        </div>
      )}

      {platform === 'linkedin' && (
        <div>
          <div className="flex items-center gap-2 text-linkedin text-xs font-medium mb-2">
            <span className="w-2 h-2 rounded-full bg-linkedin" />
            LinkedIn (1 image or video)
          </div>
          <MediaUpload
            platform="linkedin"
            maxFiles={1}
            existingMedia={linkedInMediaUrl ? [linkedInMediaUrl] : []}
            onMediaChange={(media) => onLinkedInMediaUrlChange(media[0] || '')}
          />
        </div>
      )}
    </div>
  )
}
