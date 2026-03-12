'use client'

import { Check } from 'lucide-react'
import { Platform, PLATFORM_INFO } from '@/lib/posts'
import { cn } from '@/lib/utils'
import { PlatformIcon } from './PlatformIcon'

interface PlatformSelectorProps {
  activePlatform: Platform
  onSelect: (platform: Platform) => void
  className?: string
}

export const PlatformSelector = ({
  activePlatform,
  onSelect,
  className,
}: PlatformSelectorProps) => {
  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {(['twitter', 'linkedin', 'reddit'] as Platform[]).map((platform) => {
        const isActive = activePlatform === platform
        const info = PLATFORM_INFO[platform]
        return (
          <button
            key={platform}
            onClick={() => onSelect(platform)}
            className={cn(
              'flex items-center gap-2 px-3 md:px-4 py-2.5 md:py-3 rounded-md transition-all',
              'font-bold text-sm min-h-[44px]',
              'border-[3px] border-border',
              isActive
                ? platform === 'twitter'
                  ? 'bg-twitter/10 text-twitter shadow-[3px_3px_0_hsl(var(--twitter))]'
                  : platform === 'linkedin'
                    ? 'bg-linkedin/10 text-linkedin shadow-[3px_3px_0_hsl(var(--linkedin))]'
                    : 'bg-reddit/10 text-reddit shadow-[3px_3px_0_hsl(var(--reddit))]'
                : 'bg-card text-muted-foreground shadow-sticker-hover hover:-translate-y-px hover:shadow-sticker-sm'
            )}
          >
            <PlatformIcon platform={platform} />
            <span className="hidden sm:inline">{info.name.split(' ')[0]}</span>
            {isActive && <Check className="w-4 h-4 sm:ml-1" />}
          </button>
        )
      })}
    </div>
  )
}
