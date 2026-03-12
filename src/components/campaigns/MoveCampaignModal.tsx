'use client'

import { useState, useEffect } from 'react'
import { Loader2, FolderKanban, Check, ArrowRight } from 'lucide-react'
import { useProjectsStore } from '@/lib/projects'
import { useCampaignsStore } from '@/lib/campaigns'
import { Campaign } from '@/lib/posts'
import { cn } from '@/lib/utils'
import { getMediaUrl } from '@/lib/media'
import {
  ResponsiveDialog,
  ResponsiveDialogDescription,
  ResponsiveDialogActions,
  ResponsiveDialogButton,
} from '@/components/ui/ResponsiveDialog'

interface MoveCampaignModalProps {
  campaign: Campaign
  onClose: () => void
  onMoved?: () => void
}

export function MoveCampaignModal({ campaign, onClose, onMoved }: MoveCampaignModalProps) {
  const { projects, fetchProjects, initialized } = useProjectsStore()
  const { moveCampaignToProject } = useCampaignsStore()
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    campaign.projectId || null
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!initialized) {
      fetchProjects()
    }
  }, [initialized, fetchProjects])

  const handleMove = async () => {
    // No change if same project
    if (selectedProjectId === (campaign.projectId || null)) {
      onClose()
      return
    }

    setSaving(true)
    setError(null)

    try {
      await moveCampaignToProject(campaign.id, selectedProjectId)
      onMoved?.()
      onClose()
    } catch (err) {
      setError((err as Error).message || 'Failed to move campaign')
    } finally {
      setSaving(false)
    }
  }

  const currentProject = campaign.projectId
    ? projects.find((p) => p.id === campaign.projectId)
    : null

  const selectedProject = selectedProjectId
    ? projects.find((p) => p.id === selectedProjectId)
    : null

  const iconWrapper = (
    <div className="w-12 h-12 rounded-full bg-[hsl(var(--gold))]/10 flex items-center justify-center">
      <FolderKanban className="w-6 h-6 text-[hsl(var(--gold-dark))]" />
    </div>
  )

  return (
    <ResponsiveDialog
      open={true}
      onClose={onClose}
      title="Move Campaign"
      titleId="move-campaign-title"
      icon={iconWrapper}
    >
      <ResponsiveDialogDescription>
        Move "{campaign.name}" to a different project.
      </ResponsiveDialogDescription>

      {/* Current location */}
      <div className="mb-4 p-3 bg-accent/30 rounded-lg">
        <p className="text-xs text-muted-foreground mb-1">Currently in:</p>
        <div className="flex items-center gap-2">
          {currentProject?.logoUrl ? (
            <img
              src={getMediaUrl(currentProject.logoUrl)}
              alt=""
              className="w-5 h-5 rounded object-contain"
            />
          ) : (
            <FolderKanban className="w-4 h-4 text-muted-foreground" />
          )}
          <span className="font-medium">{currentProject?.name || 'Unassigned'}</span>
        </div>
      </div>

      {/* Project options */}
      <div className="space-y-2 max-h-[300px] overflow-y-auto">
        {/* Unassigned option */}
        <button
          onClick={() => setSelectedProjectId(null)}
          className={cn(
            'w-full flex items-center gap-3 p-3 rounded-lg border transition-all text-left',
            selectedProjectId === null
              ? 'border-[hsl(var(--gold))] bg-[hsl(var(--gold))]/5'
              : 'border-border hover:border-[hsl(var(--gold))]/50'
          )}
        >
          <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
            <FolderKanban className="w-4 h-4 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium">Unassigned</p>
            <p className="text-xs text-muted-foreground">Not part of any project</p>
          </div>
          {selectedProjectId === null && <Check className="w-5 h-5 text-[hsl(var(--gold-dark))]" />}
        </button>

        {/* Project options */}
        {projects.map((project) => (
          <button
            key={project.id}
            onClick={() => setSelectedProjectId(project.id)}
            className={cn(
              'w-full flex items-center gap-3 p-3 rounded-lg border transition-all text-left',
              selectedProjectId === project.id
                ? 'border-[hsl(var(--gold))] bg-[hsl(var(--gold))]/5'
                : 'border-border hover:border-[hsl(var(--gold))]/50'
            )}
          >
            <div className="w-8 h-8 rounded-lg bg-[hsl(var(--gold))]/10 flex items-center justify-center shrink-0 overflow-hidden">
              {project.logoUrl ? (
                <img
                  src={getMediaUrl(project.logoUrl)}
                  alt=""
                  className="w-full h-full object-contain"
                />
              ) : (
                <FolderKanban className="w-4 h-4 text-[hsl(var(--gold-dark))]" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{project.name}</p>
              {project.description && (
                <p className="text-xs text-muted-foreground truncate">{project.description}</p>
              )}
            </div>
            {selectedProjectId === project.id && (
              <Check className="w-5 h-5 text-[hsl(var(--gold-dark))]" />
            )}
          </button>
        ))}
      </div>

      {/* Move preview */}
      {selectedProjectId !== (campaign.projectId || null) && (
        <div className="mt-4 p-3 bg-[hsl(var(--gold))]/5 border border-[hsl(var(--gold))]/20 rounded-lg">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">{currentProject?.name || 'Unassigned'}</span>
            <ArrowRight className="w-4 h-4 text-[hsl(var(--gold-dark))]" />
            <span className="font-medium text-[hsl(var(--gold-dark))]">
              {selectedProject?.name || 'Unassigned'}
            </span>
          </div>
        </div>
      )}

      {/* Error message */}
      {error && <p className="mt-4 text-sm text-destructive">{error}</p>}

      {/* Actions */}
      <ResponsiveDialogActions className="mt-6">
        <ResponsiveDialogButton onClick={onClose} variant="secondary" disabled={saving}>
          Cancel
        </ResponsiveDialogButton>
        <button
          onClick={handleMove}
          disabled={saving || selectedProjectId === (campaign.projectId || null)}
          className={cn(
            'flex-1 flex items-center justify-center gap-2 px-4 rounded-lg text-sm font-medium transition-all',
            'md:py-2.5 py-3.5 min-h-[48px] md:min-h-0',
            'bg-linear-to-br from-[hsl(var(--gold))] to-[hsl(var(--gold-dark))]',
            'border-2 border-[hsl(var(--gold-dark))]',
            'text-white',
            'hover:shadow-lg hover:shadow-[hsl(var(--gold))]/30',
            'disabled:opacity-50 disabled:cursor-not-allowed'
          )}
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          Move Campaign
        </button>
      </ResponsiveDialogActions>
    </ResponsiveDialog>
  )
}
