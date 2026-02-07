'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import {
  Plus,
  FolderOpen,
  FileText,
  Rocket,
  CheckCircle,
  Archive,
  Edit2,
  Trash2,
  MoreVertical,
  FolderKanban,
} from 'lucide-react'
import { useCampaignsStore } from '@/lib/campaigns'
import { useProjectsStore } from '@/lib/projects'
import { Campaign, CampaignStatus, Project } from '@/lib/posts'
import { cn } from '@/lib/utils'
import { getMediaUrl } from '@/lib/media'
import { MoveCampaignModal } from '@/components/campaigns/MoveCampaignModal'
import { IOSSegmentedControl } from '@/components/ui/IOSSegmentedControl'

type FilterStatus = 'all' | CampaignStatus

const STATUS_CONFIG: Record<
  CampaignStatus,
  { label: string; icon: typeof FileText; color: string }
> = {
  draft: { label: 'Draft', icon: FileText, color: 'text-muted-foreground' },
  active: { label: 'Active', icon: Rocket, color: 'text-blue-400' },
  completed: { label: 'Completed', icon: CheckCircle, color: 'text-green-400' },
  archived: { label: 'Archived', icon: Archive, color: 'text-muted-foreground' },
}

export default function CampaignsPage() {
  const { campaigns, fetchCampaigns, initialized, addCampaign, deleteCampaign } =
    useCampaignsStore()
  const { projects, fetchProjects, initialized: projectsInitialized } = useProjectsStore()
  const [filter, setFilter] = useState<FilterStatus>('all')
  const [showNewModal, setShowNewModal] = useState(false)
  const [movingCampaign, setMovingCampaign] = useState<Campaign | null>(null)
  const router = useRouter()

  useEffect(() => {
    if (!initialized) {
      fetchCampaigns()
    }
    if (!projectsInitialized) {
      fetchProjects()
    }
  }, [initialized, fetchCampaigns, projectsInitialized, fetchProjects])

  // Filter campaigns
  const filteredCampaigns =
    filter === 'all'
      ? campaigns.filter((c) => c.status !== 'archived')
      : campaigns.filter((c) => c.status === filter)

  // Sort by most recent first
  const sortedCampaigns = [...filteredCampaigns].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  )

  // Count by status
  const counts = {
    all: campaigns.filter((c) => c.status !== 'archived').length,
    draft: campaigns.filter((c) => c.status === 'draft').length,
    active: campaigns.filter((c) => c.status === 'active').length,
    completed: campaigns.filter((c) => c.status === 'completed').length,
    archived: campaigns.filter((c) => c.status === 'archived').length,
  }

  const handleCreateCampaign = async (name: string, description?: string) => {
    try {
      const campaign = await addCampaign({ name, description })
      setShowNewModal(false)
      router.push(`/campaigns/${campaign.id}`)
    } catch {
      // Error handled in store
    }
  }

  const handleDeleteCampaign = async (id: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (
      confirm(
        'Are you sure you want to delete this campaign? Posts will be unlinked but not deleted.'
      )
    ) {
      await deleteCampaign(id)
    }
  }

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 md:mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold mb-1 tracking-tight">
            Campaigns
          </h1>
          <p className="text-sm md:text-base text-muted-foreground hidden sm:block">
            Group and manage related posts across platforms.
          </p>
          <div className="h-1 w-16 bg-gradient-to-r from-[hsl(var(--gold))] to-transparent mt-2 rounded-full" />
        </div>
        <button
          onClick={() => setShowNewModal(true)}
          className={cn(
            'flex items-center gap-2 px-3 md:px-4 py-2.5 rounded-lg min-h-[44px]',
            'bg-gradient-to-br from-[hsl(var(--gold))] to-[hsl(var(--gold-dark))]',
            'text-primary-foreground font-medium text-sm',
            'hover:shadow-lg hover:shadow-[hsl(var(--gold))]/30 transition-all'
          )}
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">New Campaign</span>
          <span className="sm:hidden">New</span>
        </button>
      </div>

      {/* Filter tabs */}
      <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0 mb-4 md:mb-6">
        <IOSSegmentedControl<FilterStatus>
          value={filter}
          onChange={setFilter}
          fullWidth
          options={[
            { value: 'all', label: 'All', count: counts.all },
            {
              value: 'draft',
              label: STATUS_CONFIG.draft.label,
              icon: <FileText className="w-4 h-4" />,
              count: counts.draft,
            },
            {
              value: 'active',
              label: STATUS_CONFIG.active.label,
              icon: <Rocket className="w-4 h-4" />,
              count: counts.active,
            },
            {
              value: 'completed',
              label: STATUS_CONFIG.completed.label,
              icon: <CheckCircle className="w-4 h-4" />,
              count: counts.completed,
            },
            {
              value: 'archived',
              label: STATUS_CONFIG.archived.label,
              icon: <Archive className="w-4 h-4" />,
              count: counts.archived,
              hidden: counts.archived === 0,
            },
          ]}
        />
      </div>

      {/* Campaigns list */}
      {sortedCampaigns.length === 0 ? (
        <div className="text-center py-12 md:py-16 bg-card border border-border rounded-xl">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[hsl(var(--gold))]/10 flex items-center justify-center">
            <FolderOpen className="w-8 h-8 text-[hsl(var(--gold-dark))]" />
          </div>
          <h3 className="text-lg font-semibold mb-2">
            {filter === 'all' ? 'No campaigns yet' : `No ${filter} campaigns`}
          </h3>
          <p className="text-muted-foreground mb-6 max-w-sm mx-auto px-4">
            {filter === 'all'
              ? 'Create campaigns to organize and group related posts across platforms.'
              : `No campaigns with ${filter} status.`}
          </p>
          <button
            onClick={() => setShowNewModal(true)}
            className={cn(
              'inline-flex items-center gap-2 px-5 py-3 rounded-xl',
              'bg-gradient-to-br from-[hsl(var(--gold))] to-[hsl(var(--gold-dark))]',
              'text-primary-foreground font-medium text-sm',
              'hover:shadow-lg hover:shadow-[hsl(var(--gold))]/30 transition-all'
            )}
          >
            <Plus className="w-4 h-4" />
            Create Your First Campaign
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {sortedCampaigns.map((campaign, i) => (
            <CampaignCard
              key={campaign.id}
              campaign={campaign}
              index={i}
              project={projects.find((p) => p.id === campaign.projectId)}
              onDelete={(e) => handleDeleteCampaign(campaign.id, e)}
              onMove={() => setMovingCampaign(campaign)}
            />
          ))}
        </div>
      )}

      {/* New Campaign Modal */}
      {showNewModal && (
        <NewCampaignModal onClose={() => setShowNewModal(false)} onCreate={handleCreateCampaign} />
      )}

      {/* Move Campaign Modal */}
      {movingCampaign && (
        <MoveCampaignModal
          campaign={movingCampaign}
          onClose={() => setMovingCampaign(null)}
          onMoved={() => fetchCampaigns()}
        />
      )}
    </div>
  )
}

function CampaignCard({
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
        <div className="w-10 h-10 rounded-lg bg-[hsl(var(--gold))]/10 flex items-center justify-center flex-shrink-0">
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

function NewCampaignModal({
  onClose,
  onCreate,
}: {
  onClose: () => void
  onCreate: (name: string, description?: string) => void
}) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (name.trim()) {
      onCreate(name.trim(), description.trim() || undefined)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-xl shadow-xl w-full max-w-md animate-scale-in">
        <div className="p-6">
          <h2 className="text-xl font-display font-bold mb-4">New Campaign</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter campaign name..."
                className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-[hsl(var(--gold))]/50"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Description (optional)</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe this campaign..."
                rows={3}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-[hsl(var(--gold))]/50 resize-none"
              />
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2.5 rounded-lg border border-border text-sm font-medium hover:bg-accent transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!name.trim()}
                className={cn(
                  'flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-all',
                  'bg-gradient-to-br from-[hsl(var(--gold))] to-[hsl(var(--gold-dark))]',
                  'text-white',
                  'hover:shadow-lg hover:shadow-[hsl(var(--gold))]/30',
                  'disabled:opacity-50 disabled:cursor-not-allowed'
                )}
              >
                Create Campaign
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
