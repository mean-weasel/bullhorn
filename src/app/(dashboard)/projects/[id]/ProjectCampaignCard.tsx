'use client'

import Link from 'next/link'
import { format } from 'date-fns'
import { FolderOpen, PauseCircle, Rocket, CheckCircle, Archive } from 'lucide-react'
import { Campaign, CampaignStatus } from '@/lib/posts'
import { cn } from '@/lib/utils'

const CAMPAIGN_STATUS_CONFIG: Record<
  CampaignStatus,
  { label: string; icon: typeof PauseCircle; color: string }
> = {
  active: { label: 'Active', icon: Rocket, color: 'text-blue-400' },
  paused: { label: 'Paused', icon: PauseCircle, color: 'text-muted-foreground' },
  completed: { label: 'Completed', icon: CheckCircle, color: 'text-green-400' },
  archived: { label: 'Archived', icon: Archive, color: 'text-muted-foreground' },
}

export function ProjectCampaignCard({ campaign, index }: { campaign: Campaign; index: number }) {
  const statusConfig = CAMPAIGN_STATUS_CONFIG[campaign.status]
  const StatusIcon = statusConfig.icon

  return (
    <Link
      href={`/campaigns/${campaign.id}`}
      className={cn(
        'block p-3 md:p-4 bg-card border border-border rounded-xl',
        'hover:border-[hsl(var(--gold))]/50 hover:shadow-md transition-all',
        'active:scale-[0.99]',
        'animate-slide-up'
      )}
      style={{ animationDelay: `${index * 30}ms` }}
    >
      <div className="flex items-start gap-3 md:gap-4">
        <div className="w-10 h-10 rounded-lg bg-[hsl(var(--gold))]/10 flex items-center justify-center shrink-0">
          <FolderOpen className="w-5 h-5 text-[hsl(var(--gold-dark))]" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold mb-1 truncate">{campaign.name}</h3>
          {campaign.description && (
            <p className="text-sm text-muted-foreground line-clamp-1 mb-2">
              {campaign.description}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2 md:gap-4 text-xs text-muted-foreground">
            <span className={cn('flex items-center gap-1.5', statusConfig.color)}>
              <StatusIcon className="w-3.5 h-3.5" />
              {statusConfig.label}
            </span>
            <span>Updated {format(new Date(campaign.updatedAt), 'MMM d')}</span>
          </div>
        </div>
      </div>
    </Link>
  )
}
