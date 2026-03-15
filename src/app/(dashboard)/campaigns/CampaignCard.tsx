'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { format } from 'date-fns'
import {
  FolderOpen,
  PauseCircle,
  Rocket,
  CheckCircle,
  Archive,
  Edit2,
  Trash2,
  MoreVertical,
  FolderKanban,
} from 'lucide-react'
import { Campaign, CampaignStatus, Project } from '@/lib/posts'
import { cn } from '@/lib/utils'
import { getMediaUrl } from '@/lib/media'

const STATUS_CONFIG: Record<
  CampaignStatus,
  { label: string; icon: typeof PauseCircle; color: string }
> = {
  active: { label: 'Active', icon: Rocket, color: 'text-blue-400' },
  paused: { label: 'Paused', icon: PauseCircle, color: 'text-muted-foreground' },
  completed: { label: 'Completed', icon: CheckCircle, color: 'text-green-400' },
  archived: { label: 'Archived', icon: Archive, color: 'text-muted-foreground' },
}

// eslint-disable-next-line max-lines-per-function
export function CampaignCard({
  campaign,
  index,
  project,
  onDelete,
  onMove,
}: {
  campaign: Campaign
  index: number
  project?: Project
  onDelete: (e: React.MouseEvent) => void
  onMove: () => void
}) {
  const statusConfig = STATUS_CONFIG[campaign.status]
  const StatusIcon = statusConfig.icon
  const [showMenu, setShowMenu] = useState(false)

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
        {/* Icon */}
        <div className="w-10 h-10 rounded-lg bg-[hsl(var(--gold))]/10 flex items-center justify-center shrink-0">
          <FolderOpen className="w-5 h-5 text-[hsl(var(--gold-dark))]" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold mb-1 truncate">{campaign.name}</h3>
          {campaign.description && (
            <p className="text-sm text-muted-foreground line-clamp-1 mb-2">
              {campaign.description}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2 md:gap-4 text-xs text-muted-foreground">
            {/* Status */}
            <span className={cn('flex items-center gap-1.5', statusConfig.color)}>
              <StatusIcon className="w-3.5 h-3.5" />
              {statusConfig.label}
            </span>

            {/* Project */}
            {project && (
              <span className="flex items-center gap-1.5">
                {project.logoUrl ? (
                  <Image
                    src={getMediaUrl(project.logoUrl)}
                    alt=""
                    width={14}
                    height={14}
                    className="rounded object-contain"
                  />
                ) : (
                  <FolderKanban className="w-3.5 h-3.5" />
                )}
                {project.name}
              </span>
            )}

            {/* Last updated */}
            <span className="flex items-center gap-1.5">
              Updated {format(new Date(campaign.updatedAt), 'MMM d')}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="relative">
          <button
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setShowMenu(!showMenu)
            }}
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors min-w-[40px] min-h-[40px] flex items-center justify-center"
          >
            <MoreVertical className="w-4 h-4" />
          </button>
          {showMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
              <div className="absolute right-0 top-full mt-1 z-20 bg-card border border-border rounded-lg shadow-lg py-1 min-w-[160px]">
                <Link
                  href={`/campaigns/${campaign.id}`}
                  className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent transition-colors"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Edit2 className="w-4 h-4" />
                  Edit
                </Link>
                <button
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    setShowMenu(false)
                    onMove()
                  }}
                  className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent transition-colors w-full text-left"
                >
                  <FolderKanban className="w-4 h-4" />
                  Move to Project
                </button>
                <button
                  onClick={(e) => {
                    setShowMenu(false)
                    onDelete(e)
                  }}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-accent transition-colors w-full text-left"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </Link>
  )
}
