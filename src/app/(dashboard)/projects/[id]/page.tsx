'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { format } from 'date-fns'
import {
  ArrowLeft,
  Edit2,
  Plus,
  Trash2,
  FolderKanban,
  FolderOpen,
  Hash,
  Palette,
  Settings,
} from 'lucide-react'
import { useProjectsStore } from '@/lib/projects'
import { useAnalyticsStore } from '@/lib/analyticsStore'
import { AnalyticsConnection } from '@/lib/analytics.types'
import { useCampaignsStore } from '@/lib/campaigns'
import { Project, Campaign, ProjectAnalytics } from '@/lib/posts'
import { cn } from '@/lib/utils'
import { getMediaUrl } from '@/lib/media'
import { ResourceNotFound } from '@/components/ui/ResourceNotFound'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { ProjectCampaignCard } from './ProjectCampaignCard'
import { ProjectSettingsTab } from './ProjectSettingsTab'

type TabType = 'campaigns' | 'settings'

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: paramId } = use(params)
  const router = useRouter()
  const { fetchProjectWithCampaigns, fetchProjectAnalytics, updateProject, deleteProject } =
    useProjectsStore()
  const { addCampaign } = useCampaignsStore()
  const { fetchConnections, getConnectionsByProject } = useAnalyticsStore()

  const [projectId, setProjectId] = useState<string | null>(null)
  const [project, setProject] = useState<Project | null>(null)
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [analytics, setAnalytics] = useState<ProjectAnalytics | null>(null)
  const [analyticsConnections, setAnalyticsConnections] = useState<AnalyticsConnection[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabType>('campaigns')

  // Edit states
  const [editName, setEditName] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editHashtags, setEditHashtags] = useState('')
  const [editPrimaryColor, setEditPrimaryColor] = useState('')
  const [editSecondaryColor, setEditSecondaryColor] = useState('')
  const [editAccentColor, setEditAccentColor] = useState('')

  // Delete confirmation
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  // New campaign modal
  const [showNewCampaignModal, setShowNewCampaignModal] = useState(false)
  const [newCampaignName, setNewCampaignName] = useState('')
  const [newCampaignDescription, setNewCampaignDescription] = useState('')

  // Set project ID from params
  useEffect(() => {
    setProjectId(paramId)
  }, [paramId])

  // Load project data
  useEffect(() => {
    async function loadProject() {
      if (!projectId) return
      setLoading(true)

      try {
        const [projectData, analyticsData] = await Promise.all([
          fetchProjectWithCampaigns(projectId),
          fetchProjectAnalytics(projectId),
          fetchConnections(),
        ])

        if (projectData) {
          setProject(projectData.project)
          setCampaigns(projectData.campaigns)
          // Set edit fields
          setEditName(projectData.project.name)
          setEditDescription(projectData.project.description || '')
          setEditHashtags(projectData.project.hashtags.join(', '))
          setEditPrimaryColor(projectData.project.brandColors.primary || '')
          setEditSecondaryColor(projectData.project.brandColors.secondary || '')
          setEditAccentColor(projectData.project.brandColors.accent || '')
        }
        if (analyticsData) {
          setAnalytics(analyticsData)
        }
        // Get analytics connections for this project
        const connections = getConnectionsByProject(projectId)
        setAnalyticsConnections(connections)
      } catch {
        // Individual store fetches handle their own errors
      }

      setLoading(false)
    }
    loadProject()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, fetchProjectWithCampaigns, fetchProjectAnalytics, fetchConnections])

  const handleSave = async () => {
    if (!project || !editName.trim()) return

    const hashtags = editHashtags
      .split(',')
      .map((h) => h.trim().replace(/^#/, ''))
      .filter(Boolean)

    await updateProject(project.id, {
      name: editName.trim(),
      description: editDescription.trim() || undefined,
      hashtags,
      brandColors: {
        primary: editPrimaryColor || undefined,
        secondary: editSecondaryColor || undefined,
        accent: editAccentColor || undefined,
      },
    })

    setProject({
      ...project,
      name: editName.trim(),
      description: editDescription.trim() || undefined,
      hashtags,
      brandColors: {
        primary: editPrimaryColor || undefined,
        secondary: editSecondaryColor || undefined,
        accent: editAccentColor || undefined,
      },
    })
  }

  const handleDelete = async () => {
    if (!project) return
    await deleteProject(project.id)
    setShowDeleteConfirm(false)
    router.push('/projects')
  }

  const handleCreateCampaign = async () => {
    if (!project || !newCampaignName.trim()) return

    try {
      const campaign = await addCampaign({
        name: newCampaignName.trim(),
        description: newCampaignDescription.trim() || undefined,
        projectId: project.id,
      })
      setCampaigns([campaign, ...campaigns])
      setNewCampaignName('')
      setNewCampaignDescription('')
      setShowNewCampaignModal(false)

      // Refresh analytics so the stats bar reflects the new campaign count
      const updated = await fetchProjectAnalytics(project.id)
      if (updated) setAnalytics(updated)
    } catch {
      // Error handled in store
    }
  }

  // Filter campaigns by status
  const activeCampaigns = campaigns.filter((c) => c.status !== 'archived')
  const archivedCampaigns = campaigns.filter((c) => c.status === 'archived')

  if (loading) {
    return (
      <div className="p-4 md:p-6 max-w-5xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-48" />
          <div className="h-32 bg-muted rounded" />
          <div className="h-64 bg-muted rounded" />
        </div>
      </div>
    )
  }

  if (!project) {
    return <ResourceNotFound type="Project" listUrl="/projects" listLabel="Projects" />
  }

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/projects"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Projects
        </Link>

        {/* Project header card */}
        <div className="bg-card border border-border rounded-xl p-4 md:p-6">
          <div className="flex items-start gap-4">
            {/* Logo */}
            <div className="w-16 h-16 md:w-20 md:h-20 rounded-xl bg-[hsl(var(--gold))]/10 flex items-center justify-center shrink-0 overflow-hidden">
              {project.logoUrl ? (
                <img
                  src={getMediaUrl(project.logoUrl)}
                  alt={`${project.name} logo`}
                  className="w-full h-full object-contain"
                />
              ) : (
                <FolderKanban className="w-8 h-8 md:w-10 md:h-10 text-[hsl(var(--gold-dark))]" />
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-2xl md:text-3xl font-display font-bold tracking-tight truncate">
                  {project.name}
                </h1>
                <button
                  onClick={() => setActiveTab('settings')}
                  className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
              </div>

              {project.description && (
                <p className="text-muted-foreground mb-3 line-clamp-2">{project.description}</p>
              )}

              {/* Brand kit preview */}
              <div className="flex flex-wrap items-center gap-3">
                {/* Hashtags */}
                {project.hashtags.length > 0 && (
                  <div className="flex items-center gap-1.5">
                    <Hash className="w-4 h-4 text-[hsl(var(--gold-dark))]" />
                    <span className="text-sm text-muted-foreground">
                      {project.hashtags.length} hashtag{project.hashtags.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                )}

                {/* Brand colors */}
                {(project.brandColors.primary ||
                  project.brandColors.secondary ||
                  project.brandColors.accent) && (
                  <div className="flex items-center gap-1.5">
                    <Palette className="w-4 h-4 text-muted-foreground" />
                    <div className="flex gap-1">
                      {project.brandColors.primary && (
                        <span
                          className="w-5 h-5 rounded-full border border-border"
                          style={{ backgroundColor: project.brandColors.primary }}
                          title={`Primary: ${project.brandColors.primary}`}
                        />
                      )}
                      {project.brandColors.secondary && (
                        <span
                          className="w-5 h-5 rounded-full border border-border"
                          style={{ backgroundColor: project.brandColors.secondary }}
                          title={`Secondary: ${project.brandColors.secondary}`}
                        />
                      )}
                      {project.brandColors.accent && (
                        <span
                          className="w-5 h-5 rounded-full border border-border"
                          style={{ backgroundColor: project.brandColors.accent }}
                          title={`Accent: ${project.brandColors.accent}`}
                        />
                      )}
                    </div>
                  </div>
                )}

                {/* Updated date */}
                <span className="text-sm text-muted-foreground">
                  Updated {format(new Date(project.updatedAt), 'MMM d, yyyy')}
                </span>
              </div>
            </div>

            {/* Delete button */}
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="p-2 rounded-lg text-destructive hover:bg-destructive/10 transition-colors"
              title="Delete project"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          </div>

          {/* Analytics stats */}
          {analytics && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-border">
              <div className="text-center">
                <div className="text-2xl font-display font-bold text-[hsl(var(--gold-dark))]">
                  {analytics.totalCampaigns}
                </div>
                <div className="text-xs uppercase tracking-widest text-muted-foreground">
                  Campaigns
                </div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-display font-bold text-[hsl(var(--gold-dark))]">
                  {analytics.totalPosts}
                </div>
                <div className="text-xs uppercase tracking-widest text-muted-foreground">
                  Total Posts
                </div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-display font-bold text-blue-400">
                  {analytics.scheduledPosts}
                </div>
                <div className="text-xs uppercase tracking-widest text-muted-foreground">
                  Scheduled
                </div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-display font-bold text-green-400">
                  {analytics.publishedPosts}
                </div>
                <div className="text-xs uppercase tracking-widest text-muted-foreground">
                  Published
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-card border border-border rounded-xl mb-6">
        <button
          onClick={() => setActiveTab('campaigns')}
          className={cn(
            'flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors',
            activeTab === 'campaigns'
              ? 'bg-[hsl(var(--gold))]/20 text-[hsl(var(--gold-dark))]'
              : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
          )}
        >
          <FolderOpen className="w-4 h-4" />
          Campaigns
        </button>
        <button
          onClick={() => setActiveTab('settings')}
          className={cn(
            'flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors',
            activeTab === 'settings'
              ? 'bg-[hsl(var(--gold))]/20 text-[hsl(var(--gold-dark))]'
              : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
          )}
        >
          <Settings className="w-4 h-4" />
          Settings
        </button>
      </div>

      {/* Tab content */}
      {activeTab === 'campaigns' && (
        <div className="space-y-4">
          {/* Header with new campaign button */}
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Campaigns</h2>
            <button
              onClick={() => setShowNewCampaignModal(true)}
              className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium',
                'bg-linear-to-br from-[hsl(var(--gold))] to-[hsl(var(--gold-dark))]',
                'border-2 border-[hsl(var(--gold-dark))]',
                'text-primary-foreground hover:shadow-lg hover:shadow-[hsl(var(--gold))]/30 transition-all'
              )}
            >
              <Plus className="w-4 h-4" />
              New Campaign
            </button>
          </div>

          {/* Campaign list */}
          {activeCampaigns.length === 0 ? (
            <div className="text-center py-12 bg-card border border-border rounded-xl">
              <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-[hsl(var(--gold))]/10 flex items-center justify-center">
                <FolderOpen className="w-6 h-6 text-[hsl(var(--gold-dark))]" />
              </div>
              <h3 className="font-semibold mb-1">No campaigns yet</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Create a campaign to start organizing posts in this project.
              </p>
              <button
                onClick={() => setShowNewCampaignModal(true)}
                className={cn(
                  'inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium',
                  'bg-linear-to-br from-[hsl(var(--gold))] to-[hsl(var(--gold-dark))]',
                  'border-2 border-[hsl(var(--gold-dark))]',
                  'text-primary-foreground hover:shadow-lg hover:shadow-[hsl(var(--gold))]/30 transition-all'
                )}
              >
                <Plus className="w-4 h-4" />
                Create First Campaign
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {activeCampaigns.map((campaign, i) => (
                <ProjectCampaignCard key={campaign.id} campaign={campaign} index={i} />
              ))}
            </div>
          )}

          {/* Archived campaigns */}
          {archivedCampaigns.length > 0 && (
            <div className="mt-8">
              <h3 className="text-sm font-medium text-muted-foreground mb-3">
                Archived ({archivedCampaigns.length})
              </h3>
              <div className="space-y-3 opacity-60">
                {archivedCampaigns.map((campaign, i) => (
                  <ProjectCampaignCard key={campaign.id} campaign={campaign} index={i} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'settings' && (
        <ProjectSettingsTab
          project={project}
          editName={editName}
          setEditName={setEditName}
          editDescription={editDescription}
          setEditDescription={setEditDescription}
          editHashtags={editHashtags}
          setEditHashtags={setEditHashtags}
          editPrimaryColor={editPrimaryColor}
          setEditPrimaryColor={setEditPrimaryColor}
          editSecondaryColor={editSecondaryColor}
          setEditSecondaryColor={setEditSecondaryColor}
          editAccentColor={editAccentColor}
          setEditAccentColor={setEditAccentColor}
          analyticsConnections={analyticsConnections}
          onSave={handleSave}
          onDelete={() => setShowDeleteConfirm(true)}
        />
      )}

      {/* New Campaign Modal */}
      {showNewCampaignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-xs"
            onClick={() => setShowNewCampaignModal(false)}
          />
          <div className="relative bg-card border border-border rounded-xl shadow-xl w-full max-w-md animate-in zoom-in-95 fade-in duration-200">
            <div className="p-6">
              <h2 className="text-xl font-display font-bold mb-4">New Campaign</h2>
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  handleCreateCampaign()
                }}
                className="space-y-4"
              >
                <div>
                  <label className="block text-sm font-medium mb-2">Name</label>
                  <input
                    type="text"
                    value={newCampaignName}
                    onChange={(e) => setNewCampaignName(e.target.value)}
                    placeholder="Enter campaign name..."
                    className={cn(
                      'w-full px-3 py-2.5 rounded-lg',
                      'bg-background border border-border',
                      'focus:outline-hidden focus:ring-2 focus:ring-[hsl(var(--gold))]/50 focus:border-[hsl(var(--gold))]'
                    )}
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Description (optional)</label>
                  <textarea
                    value={newCampaignDescription}
                    onChange={(e) => setNewCampaignDescription(e.target.value)}
                    placeholder="Describe this campaign..."
                    rows={3}
                    className={cn(
                      'w-full px-3 py-2.5 rounded-lg resize-none',
                      'bg-background border border-border',
                      'focus:outline-hidden focus:ring-2 focus:ring-[hsl(var(--gold))]/50 focus:border-[hsl(var(--gold))]'
                    )}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  This campaign will be created in the <strong>{project.name}</strong> project.
                </p>
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowNewCampaignModal(false)}
                    className="flex-1 px-4 py-2.5 rounded-lg border border-border text-sm font-medium hover:bg-accent transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!newCampaignName.trim()}
                    className={cn(
                      'flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-all',
                      'bg-linear-to-br from-[hsl(var(--gold))] to-[hsl(var(--gold-dark))]',
                      'border-2 border-[hsl(var(--gold-dark))]',
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
      )}

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={showDeleteConfirm}
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteConfirm(false)}
        title="Delete Project?"
        description={`Are you sure you want to delete "${project.name}"?`}
        confirmText="Delete Project"
        variant="danger"
      >
        {campaigns.length > 0 ? (
          <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-sm">
            <p className="font-medium text-amber-600 dark:text-amber-400 mb-2">
              {campaigns.length} campaign{campaigns.length !== 1 ? 's' : ''} will be affected:
            </p>
            <ul className="space-y-1 text-muted-foreground">
              {campaigns.slice(0, 5).map((c) => (
                <li key={c.id} className="flex items-center gap-2">
                  <FolderOpen className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{c.name}</span>
                </li>
              ))}
              {campaigns.length > 5 && (
                <li className="text-xs text-muted-foreground/70">
                  ...and {campaigns.length - 5} more
                </li>
              )}
            </ul>
            <p className="mt-2 text-xs text-muted-foreground">
              These campaigns will be unassigned but not deleted.
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            This project has no campaigns to unassign.
          </p>
        )}
      </ConfirmDialog>
    </div>
  )
}
