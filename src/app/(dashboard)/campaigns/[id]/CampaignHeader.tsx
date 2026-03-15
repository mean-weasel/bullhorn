'use client'

import Link from 'next/link'
import { format } from 'date-fns'
import {
  ArrowLeft,
  Edit2,
  Trash2,
  FolderOpen,
  PauseCircle,
  Rocket,
  CheckCircle,
  Archive,
  FolderKanban,
} from 'lucide-react'
import { Campaign, CampaignStatus } from '@/lib/posts'
import { cn } from '@/lib/utils'
import { getMediaUrl } from '@/lib/media'
import { Project } from '@/lib/posts'

const CAMPAIGN_STATUS_CONFIG: Record<
  CampaignStatus,
  { label: string; icon: typeof PauseCircle; color: string }
> = {
  active: { label: 'Active', icon: Rocket, color: 'text-blue-400' },
  paused: { label: 'Paused', icon: PauseCircle, color: 'text-muted-foreground' },
  completed: { label: 'Completed', icon: CheckCircle, color: 'text-green-400' },
  archived: { label: 'Archived', icon: Archive, color: 'text-muted-foreground' },
}

interface CampaignEditFormProps {
  editName: string
  setEditName: (v: string) => void
  editDescription: string
  setEditDescription: (v: string) => void
  onSave: () => void
  onCancel: () => void
}

function CampaignEditForm(props: CampaignEditFormProps) {
  return (
    <div className="space-y-3">
      <input
        type="text"
        value={props.editName}
        onChange={(e) => props.setEditName(e.target.value)}
        maxLength={200}
        className="w-full text-2xl md:text-3xl font-display font-bold bg-transparent border-b-2 border-[hsl(var(--gold))] focus:outline-hidden"
        autoFocus
      />
      <textarea
        value={props.editDescription}
        onChange={(e) => props.setEditDescription(e.target.value)}
        placeholder="Add a description..."
        rows={2}
        maxLength={2000}
        className="w-full text-sm text-muted-foreground bg-transparent border border-border rounded-lg p-2 focus:outline-hidden focus:ring-2 focus:ring-[hsl(var(--gold))]/50 resize-none"
      />
      <div className="flex gap-2">
        <button
          onClick={props.onSave}
          className="px-4 py-2 rounded-lg bg-[hsl(var(--gold))] text-primary-foreground text-sm font-medium hover:bg-[hsl(var(--gold-dark))] transition-colors"
        >
          Save
        </button>
        <button
          onClick={props.onCancel}
          className="px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-accent transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

interface CampaignInfoProps {
  campaign: Campaign
  projects: Project[]
  postCount: number
  onEdit: () => void
  onMove: () => void
}

function CampaignInfo({ campaign, projects, postCount, onEdit, onMove }: CampaignInfoProps) {
  const statusConfig = CAMPAIGN_STATUS_CONFIG[campaign.status]
  const project = projects.find((p) => p.id === campaign.projectId)
  return (
    <>
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-lg bg-[hsl(var(--gold))]/10 flex items-center justify-center">
          <FolderOpen className="w-5 h-5 text-[hsl(var(--gold-dark))]" />
        </div>
        <h1 className="text-2xl md:text-3xl font-display font-bold tracking-tight">
          {campaign.name}
        </h1>
        <button
          onClick={onEdit}
          className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        >
          <Edit2 className="w-4 h-4" />
        </button>
      </div>
      {campaign.description && <p className="text-muted-foreground mb-3">{campaign.description}</p>}
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className={cn('flex items-center gap-1.5', statusConfig.color)}>
          <statusConfig.icon className="w-4 h-4" />
          {statusConfig.label}
        </span>
        <span className="text-muted-foreground">
          {postCount} {postCount === 1 ? 'post' : 'posts'}
        </span>
        <span className="text-muted-foreground">
          Updated {format(new Date(campaign.updatedAt), 'MMM d, yyyy')}
        </span>
      </div>
      <ProjectBadge project={project} projectId={campaign.projectId} onMove={onMove} />
    </>
  )
}

function ProjectBadge({
  project,
  projectId,
  onMove,
}: {
  project?: Project
  projectId?: string
  onMove: () => void
}) {
  return (
    <div className="flex items-center gap-2 mt-3">
      {projectId ? (
        <Link
          href={`/projects/${projectId}`}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[hsl(var(--gold))]/10 text-sm hover:bg-[hsl(var(--gold))]/20 transition-colors"
        >
          {project?.logoUrl ? (
            <img
              src={getMediaUrl(project.logoUrl)}
              alt=""
              className="w-4 h-4 rounded object-contain"
            />
          ) : (
            <FolderKanban className="w-4 h-4 text-[hsl(var(--gold-dark))]" />
          )}
          <span className="text-[hsl(var(--gold-dark))] font-medium">
            {project?.name || 'Project'}
          </span>
        </Link>
      ) : (
        <span className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted text-sm text-muted-foreground">
          <FolderKanban className="w-4 h-4" />
          Unassigned
        </span>
      )}
      <button
        onClick={onMove}
        className="text-sm text-muted-foreground hover:text-[hsl(var(--gold-dark))] transition-colors"
      >
        Move
      </button>
    </div>
  )
}

interface CampaignHeaderProps {
  campaign: Campaign
  projects: Project[]
  postCount: number
  editing: boolean
  editName: string
  setEditName: (v: string) => void
  editDescription: string
  setEditDescription: (v: string) => void
  onSave: () => void
  onCancelEdit: () => void
  onEdit: () => void
  onDelete: () => void
  onMove: () => void
  onStatusChange: (status: CampaignStatus) => void
}

export function CampaignHeader(props: CampaignHeaderProps) {
  return (
    <div className="mb-6">
      <Link
        href="/campaigns"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Campaigns
      </Link>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          {props.editing ? (
            <CampaignEditForm
              editName={props.editName}
              setEditName={props.setEditName}
              editDescription={props.editDescription}
              setEditDescription={props.setEditDescription}
              onSave={props.onSave}
              onCancel={props.onCancelEdit}
            />
          ) : (
            <CampaignInfo
              campaign={props.campaign}
              projects={props.projects}
              postCount={props.postCount}
              onEdit={props.onEdit}
              onMove={props.onMove}
            />
          )}
        </div>
        {!props.editing && (
          <button
            onClick={props.onDelete}
            className="p-2 rounded-lg text-destructive hover:bg-destructive/10 transition-colors"
            title="Delete campaign"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        )}
      </div>
      {!props.editing && (
        <CampaignStatusSelector
          currentStatus={props.campaign.status}
          onStatusChange={props.onStatusChange}
        />
      )}
    </div>
  )
}

function CampaignStatusSelector({
  currentStatus,
  onStatusChange,
}: {
  currentStatus: CampaignStatus
  onStatusChange: (status: CampaignStatus) => void
}) {
  return (
    <div className="flex gap-2 mt-4">
      {(['active', 'paused', 'completed', 'archived'] as CampaignStatus[]).map((status) => {
        const config = CAMPAIGN_STATUS_CONFIG[status]
        return (
          <button
            key={status}
            onClick={() => onStatusChange(status)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
              currentStatus === status
                ? 'bg-[hsl(var(--gold))]/20 text-[hsl(var(--gold-dark))]'
                : 'text-muted-foreground hover:bg-accent'
            )}
          >
            <config.icon className="w-3.5 h-3.5" />
            {config.label}
          </button>
        )
      })}
    </div>
  )
}
