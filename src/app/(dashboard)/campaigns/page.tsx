'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Plus,
  FolderOpen,
  PauseCircle,
  Rocket,
  CheckCircle,
  Archive,
  AlertCircle,
  RefreshCw,
} from 'lucide-react'
import { useCampaignsStore } from '@/lib/campaigns'
import { useProjectsStore } from '@/lib/projects'
import { Campaign, CampaignStatus } from '@/lib/posts'
import { cn } from '@/lib/utils'
import { MoveCampaignModal } from '@/components/campaigns/MoveCampaignModal'
import { IOSSegmentedControl } from '@/components/ui/IOSSegmentedControl'
import { CampaignCard } from './CampaignCard'
import { NewCampaignModal } from './NewCampaignModal'
import { LimitGate } from '@/components/ui/LimitGate'
import { SkeletonListPage } from '@/components/ui/Skeleton'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'

type FilterStatus = 'all' | CampaignStatus

const STATUS_CONFIG: Record<
  CampaignStatus,
  { label: string; icon: typeof PauseCircle; color: string }
> = {
  active: { label: 'Active', icon: Rocket, color: 'text-blue-400' },
  paused: { label: 'Paused', icon: PauseCircle, color: 'text-muted-foreground' },
  completed: { label: 'Completed', icon: CheckCircle, color: 'text-green-400' },
  archived: { label: 'Archived', icon: Archive, color: 'text-muted-foreground' },
}

export default function CampaignsPage() {
  const campaigns = useCampaignsStore((s) => s.campaigns)
  const fetchCampaigns = useCampaignsStore((s) => s.fetchCampaigns)
  const initialized = useCampaignsStore((s) => s.initialized)
  const loading = useCampaignsStore((s) => s.loading)
  const error = useCampaignsStore((s) => s.error)
  const addCampaign = useCampaignsStore((s) => s.addCampaign)
  const deleteCampaign = useCampaignsStore((s) => s.deleteCampaign)
  const { projects, fetchProjects, initialized: projectsInitialized } = useProjectsStore()
  const [filter, setFilter] = useState<FilterStatus>('all')
  const [showNewModal, setShowNewModal] = useState(false)
  const [movingCampaign, setMovingCampaign] = useState<Campaign | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
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

  // Pre-compute project lookup map to avoid O(n²) find in render
  const projectMap = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects])

  // Count by status
  const counts = useMemo(
    () => ({
      all: campaigns.filter((c) => c.status !== 'archived').length,
      paused: campaigns.filter((c) => c.status === 'paused').length,
      active: campaigns.filter((c) => c.status === 'active').length,
      completed: campaigns.filter((c) => c.status === 'completed').length,
      archived: campaigns.filter((c) => c.status === 'archived').length,
    }),
    [campaigns]
  )

  const handleCreateCampaign = async (name: string, description?: string) => {
    try {
      const campaign = await addCampaign({ name, description })
      setShowNewModal(false)
      router.push(`/campaigns/${campaign.id}`)
    } catch {
      // Error handled in store
    }
  }

  const handleDeleteCampaign = (id: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDeleteId(id)
  }

  const confirmDelete = useCallback(async () => {
    if (deleteId) {
      await deleteCampaign(deleteId)
      setDeleteId(null)
    }
  }, [deleteId, deleteCampaign])

  if (loading && !initialized) {
    return <SkeletonListPage count={4} />
  }

  if (error) {
    return (
      <div className="p-4 md:p-6 max-w-5xl mx-auto animate-fade-in">
        <div className="text-center py-12 bg-card border border-destructive/30 rounded-xl">
          <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-destructive/10 flex items-center justify-center">
            <AlertCircle className="w-6 h-6 text-destructive" />
          </div>
          <h3 className="font-semibold mb-2 text-destructive">Failed to load campaigns</h3>
          <p className="text-sm text-muted-foreground mb-4">{error}</p>
          <button
            onClick={() => fetchCampaigns()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-accent transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Try Again
          </button>
        </div>
      </div>
    )
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
          <div className="h-1 w-16 bg-linear-to-r from-[hsl(var(--gold))] to-transparent mt-2 rounded-full" />
        </div>
        <LimitGate resource="campaigns">
          <button
            onClick={() => setShowNewModal(true)}
            className={cn(
              'flex items-center gap-2 px-3 md:px-4 py-2.5 rounded-lg min-h-[44px]',
              'bg-linear-to-br from-[hsl(var(--gold))] to-[hsl(var(--gold-dark))]',
              'border-2 border-[hsl(var(--gold-dark))]',
              'text-primary-foreground font-medium text-sm',
              'hover:shadow-lg hover:shadow-[hsl(var(--gold))]/30 transition-all'
            )}
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">New Campaign</span>
            <span className="sm:hidden">New</span>
          </button>
        </LimitGate>
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
              value: 'paused',
              label: STATUS_CONFIG.paused.label,
              icon: <PauseCircle className="w-4 h-4" />,
              count: counts.paused,
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
              'bg-linear-to-br from-[hsl(var(--gold))] to-[hsl(var(--gold-dark))]',
              'border-2 border-[hsl(var(--gold-dark))]',
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
              project={campaign.projectId ? projectMap.get(campaign.projectId) : undefined}
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

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deleteId}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteId(null)}
        title="Delete Campaign"
        description="Are you sure you want to delete this campaign? Posts will be unlinked but not deleted."
        confirmText="Delete"
        variant="danger"
      />
    </div>
  )
}
