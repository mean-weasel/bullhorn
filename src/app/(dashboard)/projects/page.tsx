'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, FolderKanban, AlertCircle, RefreshCw } from 'lucide-react'
import { useProjectsStore, useProjectsLoading, useProjectsError } from '@/lib/projects'
import { useCampaignsStore } from '@/lib/campaigns'
import { cn } from '@/lib/utils'
import { ProjectCard } from '@/components/projects/ProjectCard'
import { CreateProjectModal } from '@/components/projects/CreateProjectModal'
import { LimitGate } from '@/components/ui/LimitGate'
import { SkeletonListPage } from '@/components/ui/Skeleton'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'

// eslint-disable-next-line max-lines-per-function
export default function ProjectsPage() {
  const router = useRouter()
  const { projects, fetchProjects, initialized, deleteProject } = useProjectsStore()
  const { campaigns, fetchCampaigns, initialized: campaignsInitialized } = useCampaignsStore()
  const loading = useProjectsLoading()
  const error = useProjectsError()
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  useEffect(() => {
    if (!initialized) {
      fetchProjects()
    }
  }, [initialized, fetchProjects])

  useEffect(() => {
    if (!campaignsInitialized) {
      fetchCampaigns()
    }
  }, [campaignsInitialized, fetchCampaigns])

  // Pre-compute campaign counts per project (O(n) instead of O(n*p))
  const campaignCountsByProject = useMemo(
    () =>
      campaigns.reduce(
        (acc, c) => {
          if (c.status !== 'archived' && c.projectId) {
            acc[c.projectId] = (acc[c.projectId] || 0) + 1
          }
          return acc
        },
        {} as Record<string, number>
      ),
    [campaigns]
  )

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDeleteId(id)
  }

  const confirmDelete = useCallback(async () => {
    if (deleteId) {
      await deleteProject(deleteId)
      setDeleteId(null)
    }
  }, [deleteId, deleteProject])

  // Sort by most recent first
  const sortedProjects = [...projects].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  )

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 md:mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold mb-1 tracking-tight">
            Projects
          </h1>
          <p className="text-sm md:text-base text-muted-foreground hidden sm:block">
            Organize campaigns and brand assets for different products or initiatives.
          </p>
          <div className="h-1 w-16 bg-linear-to-r from-[hsl(var(--gold))] to-transparent mt-2 rounded-full" />
        </div>
        <LimitGate resource="projects">
          <button
            onClick={() => setShowCreateModal(true)}
            className={cn(
              'flex items-center gap-2 px-3 md:px-4 py-2.5 rounded-lg min-h-[44px]',
              'bg-linear-to-br from-[hsl(var(--gold))] to-[hsl(var(--gold-dark))]',
              'border-2 border-[hsl(var(--gold-dark))]',
              'text-primary-foreground font-medium text-sm',
              'hover:shadow-lg hover:shadow-[hsl(var(--gold))]/30 transition-all'
            )}
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">New Project</span>
            <span className="sm:hidden">New</span>
          </button>
        </LimitGate>
      </div>

      {/* Loading state */}
      {loading && !initialized && <SkeletonListPage count={3} />}

      {/* Error state */}
      {error && (
        <div className="text-center py-12 bg-card border border-destructive/30 rounded-xl">
          <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-destructive/10 flex items-center justify-center">
            <AlertCircle className="w-6 h-6 text-destructive" />
          </div>
          <h3 className="font-semibold mb-2 text-destructive">Failed to load projects</h3>
          <p className="text-sm text-muted-foreground mb-4">{error}</p>
          <button
            onClick={() => fetchProjects()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-accent transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Try Again
          </button>
        </div>
      )}

      {/* Projects list */}
      {!loading && !error && sortedProjects.length === 0 ? (
        <div className="text-center py-12 md:py-16 bg-card border border-border rounded-xl">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[hsl(var(--gold))]/10 flex items-center justify-center">
            <FolderKanban className="w-8 h-8 text-[hsl(var(--gold-dark))]" />
          </div>
          <h3 className="text-lg font-semibold mb-2">No projects yet</h3>
          <p className="text-muted-foreground mb-6 max-w-sm mx-auto px-4">
            Create projects to organize campaigns and maintain brand consistency across different
            products or initiatives.
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className={cn(
              'inline-flex items-center gap-2 px-5 py-3 rounded-xl',
              'bg-linear-to-br from-[hsl(var(--gold))] to-[hsl(var(--gold-dark))]',
              'border-2 border-[hsl(var(--gold-dark))]',
              'text-primary-foreground font-medium text-sm',
              'hover:shadow-lg hover:shadow-[hsl(var(--gold))]/30 transition-all'
            )}
          >
            <Plus className="w-4 h-4" />
            Create Your First Project
          </button>
        </div>
      ) : !loading && !error && sortedProjects.length > 0 ? (
        <div className="space-y-3">
          {sortedProjects.map((project, i) => (
            <ProjectCard
              key={project.id}
              project={project}
              campaignCount={campaignCountsByProject[project.id] || 0}
              index={i}
              variant="list"
              onDelete={(e) => handleDelete(project.id, e)}
            />
          ))}
        </div>
      ) : null}

      {/* Create Project Modal */}
      <CreateProjectModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={(projectId) => {
          router.push(`/projects/${projectId}`)
        }}
      />

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deleteId}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteId(null)}
        title="Delete Project"
        description="Are you sure you want to delete this project? Campaigns will be unassigned but not deleted."
        confirmText="Delete"
        variant="danger"
      />
    </div>
  )
}
