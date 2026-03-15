'use client'

import { ChevronDown, FolderOpen, X } from 'lucide-react'
import { Campaign } from '@/lib/posts'
import { cn } from '@/lib/utils'

interface CampaignSelectorProps {
  campaignId: string | undefined
  campaigns: Campaign[]
  showDropdown: boolean
  onToggleDropdown: () => void
  onSelect: (campaignId: string | undefined) => void
  className?: string
}

// eslint-disable-next-line max-lines-per-function -- component JSX rendering, extraction would fragment UI
export const CampaignSelector = ({
  campaignId,
  campaigns,
  showDropdown,
  onToggleDropdown,
  onSelect,
  className,
}: CampaignSelectorProps) => {
  return (
    <div className={cn('relative', className)}>
      <button
        onClick={onToggleDropdown}
        aria-haspopup="listbox"
        aria-expanded={showDropdown}
        className={cn(
          'flex items-center gap-2 px-4 py-2.5 rounded-md transition-all w-full',
          'border-[3px] border-border',
          campaignId
            ? 'bg-primary/5 shadow-[3px_3px_0_hsl(var(--primary)/0.3)]'
            : 'bg-card shadow-sticker-hover hover:shadow-sticker-sm'
        )}
      >
        <FolderOpen className="w-4 h-4 text-primary" />
        <span className="text-sm font-bold flex-1 text-left truncate">
          {campaignId
            ? campaigns.find((c) => c.id === campaignId)?.name || 'Unknown Campaign'
            : 'No Campaign'}
        </span>
        <ChevronDown
          className={cn(
            'w-4 h-4 text-muted-foreground transition-transform',
            showDropdown && 'rotate-180'
          )}
        />
      </button>
      {showDropdown && (
        <>
          <div className="fixed inset-0 z-10" onClick={onToggleDropdown} />
          <div className="absolute top-full left-0 right-0 mt-1 z-20 bg-card border-[3px] border-border rounded-md shadow-sticker py-1 max-h-[200px] overflow-y-auto">
            <button
              onClick={() => {
                onSelect(undefined)
                onToggleDropdown()
              }}
              className={cn(
                'w-full flex items-center gap-2 px-4 py-2.5 text-sm font-medium hover:bg-accent transition-colors text-left',
                !campaignId && 'bg-primary/10 text-primary font-bold'
              )}
            >
              <X className="w-4 h-4" />
              No Campaign
            </button>
            {campaigns
              .filter((c) => c.status !== 'archived')
              .map((campaign) => (
                <button
                  key={campaign.id}
                  onClick={() => {
                    onSelect(campaign.id)
                    onToggleDropdown()
                  }}
                  className={cn(
                    'w-full flex items-center gap-2 px-4 py-2.5 text-sm font-medium hover:bg-accent transition-colors text-left',
                    campaignId === campaign.id && 'bg-primary/10 text-primary font-bold'
                  )}
                >
                  <FolderOpen className="w-4 h-4" />
                  <span className="truncate">{campaign.name}</span>
                </button>
              ))}
          </div>
        </>
      )}
    </div>
  )
}
