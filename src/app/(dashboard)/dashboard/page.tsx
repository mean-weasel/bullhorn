'use client'
/* eslint-disable max-lines -- large page component with extracted sub-components */

import Link from 'next/link'
import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  Calendar,
  FileText,
  Plus,
  FolderOpen,
  CheckCircle,
  FolderKanban,
  Bell,
  ChevronRight,
} from 'lucide-react'
import { usePostsStore } from '@/lib/storage'
import { useCampaignsStore } from '@/lib/campaigns'
import { useProjectsStore } from '@/lib/projects'
import { cn } from '@/lib/utils'
import { ProjectSelector } from '@/components/projects/ProjectSelector'
import { CreateProjectModal } from '@/components/projects/CreateProjectModal'
import { RemindersList } from '@/components/reminders/RemindersList'
import { useRemindersStore } from '@/lib/reminders'
import { CalendarWidget } from './CalendarWidget'
import {
  DashboardPostCard as PostCard,
  ProjectMiniCard,
  DashboardCampaignCard as CampaignCard,
  DashboardSection as Section,
} from './DashboardComponents'
import { SkeletonCard, SkeletonStatBar } from '@/components/ui/Skeleton'
import { WelcomeModal } from '@/components/ui/WelcomeModal'
import { NudgeBanner } from '@/components/calendar/NudgeBanner'

// eslint-disable-next-line max-lines-per-function
export default function DashboardPage() {
  const router = useRouter()
  const allPosts = usePostsStore((state) => state.posts)
  const fetchPosts = usePostsStore((state) => state.fetchPosts)
  const postsInitialized = usePostsStore((state) => state.initialized)
  const campaigns = useCampaignsStore((s) => s.campaigns)
  const fetchCampaigns = useCampaignsStore((s) => s.fetchCampaigns)
  const campaignsInitialized = useCampaignsStore((s) => s.initialized)
  const getCampaignsByProject = useCampaignsStore((s) => s.getCampaignsByProject)
  const projects = useProjectsStore((s) => s.projects)
  const fetchProjects = useProjectsStore((s) => s.fetchProjects)
  const projectsInitialized = useProjectsStore((s) => s.initialized)
  const allReminders = useRemindersStore((s) => s.reminders)
  const fetchReminders = useRemindersStore((s) => s.fetchReminders)
  const remindersInitialized = useRemindersStore((s) => s.initialized)

  // Project filter state
  const [selectedProject, setSelectedProject] = useState<'all' | 'unassigned' | string>('all')
  const [showCreateProjectModal, setShowCreateProjectModal] = useState(false)

  // Fetch all stores in parallel on mount
  useEffect(() => {
    const fetches: Promise<void>[] = []
    if (!postsInitialized) fetches.push(fetchPosts())
    if (!campaignsInitialized) fetches.push(fetchCampaigns())
    if (!projectsInitialized) fetches.push(fetchProjects())
    if (!remindersInitialized) fetches.push(fetchReminders())
    if (fetches.length > 0) void Promise.all(fetches).catch(() => {})
  }, [
    postsInitialized,
    fetchPosts,
    campaignsInitialized,
    fetchCampaigns,
    projectsInitialized,
    fetchProjects,
    remindersInitialized,
    fetchReminders,
  ])

  // Memoized: Scheduled posts for calendar widget
  const scheduledPostsForCalendar = useMemo(
    () => allPosts.filter((p) => p.status === 'scheduled' && p.scheduledAt),
    [allPosts]
  )

  // Memoized: Exclude archived posts
  const activePosts = useMemo(() => allPosts.filter((p) => p.status !== 'archived'), [allPosts])

  // Memoized: Upcoming scheduled posts (sorted by schedule date)
  const upcomingPosts = useMemo(
    () =>
      activePosts
        .filter((p) => p.status === 'scheduled' && p.scheduledAt)
        .sort((a, b) => new Date(a.scheduledAt!).getTime() - new Date(b.scheduledAt!).getTime())
        .slice(0, 5),
    [activePosts]
  )

  // Memoized: Recent drafts (sorted by last updated)
  const recentDrafts = useMemo(
    () =>
      activePosts
        .filter((p) => p.status === 'draft')
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        .slice(0, 5),
    [activePosts]
  )

  // Memoized: Recently published (sorted by last updated)
  const recentlyPublished = useMemo(
    () =>
      allPosts
        .filter((p) => p.status === 'published')
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        .slice(0, 5),
    [allPosts]
  )

  // Memoized: Filter campaigns by project if selected
  const filteredCampaigns = useMemo(() => {
    const baseCampaigns =
      selectedProject === 'all'
        ? campaigns
        : selectedProject === 'unassigned'
          ? getCampaignsByProject(null)
          : getCampaignsByProject(selectedProject)
    return baseCampaigns.filter((c) => c.status !== 'archived')
  }, [campaigns, selectedProject, getCampaignsByProject])

  // Memoized: Recent campaigns (sorted by updated)
  const recentCampaigns = useMemo(
    () =>
      [...filteredCampaigns]
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        .slice(0, 4),
    [filteredCampaigns]
  )

  // Memoized: Recent projects (sorted by updated)
  const recentProjects = useMemo(
    () =>
      [...projects]
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        .slice(0, 4),
    [projects]
  )

  // Memoized: Pre-compute campaign counts per project (O(n) instead of O(n²))
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

  // Memoized: Stats
  const stats = useMemo(
    () => ({
      scheduled: activePosts.filter((p) => p.status === 'scheduled').length,
      drafts: activePosts.filter((p) => p.status === 'draft').length,
      published: activePosts.filter((p) => p.status === 'published').length,
      campaigns: campaigns.filter((c) => c.status !== 'archived').length,
      projects: projects.length,
    }),
    [activePosts, campaigns, projects]
  )

  const totalPosts = stats.scheduled + stats.drafts + stats.published
  const hasNoPosts = totalPosts === 0

  // Show skeleton during initial load
  if (!postsInitialized && !campaignsInitialized && !projectsInitialized) {
    return (
      <div className="min-h-[calc(100vh-4rem)] p-4 md:p-6 max-w-5xl mx-auto">
        <SkeletonStatBar />
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-3">
              <div className="h-5 w-24 bg-muted rounded animate-pulse mb-4" />
              {[1, 2, 3].map((j) => (
                <SkeletonCard key={j} />
              ))}
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <>
      <WelcomeModal />
      <div className="min-h-[calc(100vh-4rem)] p-4 md:p-6 max-w-5xl mx-auto">
        {/* Smart nudge banner for upcoming events — deferred until core data loads */}
        {postsInitialized && campaignsInitialized && projectsInitialized && (
          <NudgeBanner className="mb-4" />
        )}

        {/* Stats bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 mb-6 p-4 rounded-md bg-card border-[3px] border-border shadow-sticker">
          <div className="flex-1 flex items-center gap-4 sm:gap-6 overflow-x-auto">
            <div className="text-center shrink-0">
              <div
                data-testid="stat-scheduled"
                className="text-2xl font-extrabold text-sticker-blue"
              >
                {stats.scheduled}
              </div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
                📅 Scheduled
              </div>
            </div>
            <div className="w-px h-8 bg-border shrink-0" />
            <div className="text-center shrink-0">
              <div
                data-testid="stat-drafts"
                className="text-2xl font-extrabold text-sticker-orange"
              >
                {stats.drafts}
              </div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
                📝 Drafts
              </div>
            </div>
            <div className="w-px h-8 bg-border shrink-0" />
            <div className="text-center shrink-0">
              <div
                data-testid="stat-published"
                className="text-2xl font-extrabold text-sticker-green"
              >
                {stats.published}
              </div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
                ✅ Published
              </div>
            </div>
            <div className="w-px h-8 bg-border hidden sm:block shrink-0" />
            <div className="text-center hidden sm:block shrink-0">
              <div className="text-2xl font-extrabold text-sticker-purple">{stats.projects}</div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
                📁 Projects
              </div>
            </div>
          </div>
          {/* Project filter */}
          <div className="flex items-center gap-2">
            <ProjectSelector
              value={selectedProject}
              onChange={(value) => setSelectedProject(value)}
              showAllOption={true}
              showUnassignedOption={true}
              className="w-full sm:w-48"
            />
            <Link
              href="/new"
              className={cn(
                'hidden md:flex items-center gap-2 px-4 py-2.5 rounded-md',
                'bg-primary text-primary-foreground font-bold text-sm',
                'border-[3px] border-border',
                'shadow-sticker-sm',
                'hover:translate-y-[-2px] hover:shadow-[5px_5px_0_hsl(var(--border))]',
                'transition-all duration-200'
              )}
            >
              <Plus className="w-4 h-4" />
              New Post
            </Link>
          </div>
        </div>

        {/* Empty state when no posts at all */}
        {hasNoPosts ? (
          <div className="text-center py-16 px-4 animate-fade-in">
            <div className="w-20 h-20 mx-auto mb-6 rounded-lg bg-primary/10 flex items-center justify-center border-[3px] border-border shadow-sticker text-4xl">
              🎉
            </div>
            <h2 className="text-2xl font-extrabold mb-2">Welcome to Bullhorn</h2>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Create your first post to get started. Schedule content for Twitter, LinkedIn, and
              Reddit all in one place.
            </p>
            <Link
              href="/new"
              className={cn(
                'inline-flex items-center gap-2 px-6 py-3.5 rounded-md',
                'bg-primary text-primary-foreground font-bold',
                'border-[3px] border-border',
                'shadow-sticker',
                'hover:translate-y-[-2px] hover:shadow-[6px_6px_0_hsl(var(--border))]',
                'transition-all duration-200'
              )}
            >
              <Plus className="w-5 h-5" />
              Create Your First Post
            </Link>
          </div>
        ) : (
          /* Three-column layout on xl screens, two on lg, stacked on mobile */
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {/* Upcoming section */}
            <Section
              title="Upcoming"
              icon={Calendar}
              viewAllLink="/posts?status=scheduled"
              viewAllLabel="View all scheduled"
              isEmpty={upcomingPosts.length === 0}
              emptyIcon={Calendar}
              emptyTitle="No posts scheduled"
              emptyDescription="Schedule a post to see it here"
            >
              {upcomingPosts.map((post) => (
                <PostCard key={post.id} post={post} showSchedule />
              ))}
            </Section>

            {/* Drafts section */}
            <Section
              title="Drafts"
              icon={FileText}
              viewAllLink="/posts?status=draft"
              viewAllLabel="View all drafts"
              isEmpty={recentDrafts.length === 0}
              emptyIcon={FileText}
              emptyTitle="No drafts"
              emptyDescription="Start writing to create a draft"
            >
              {recentDrafts.map((post) => (
                <PostCard key={post.id} post={post} />
              ))}
            </Section>

            {/* Published section */}
            <Section
              title="Published"
              icon={CheckCircle}
              viewAllLink="/posts?status=published"
              viewAllLabel="View all published"
              isEmpty={recentlyPublished.length === 0}
              emptyIcon={CheckCircle}
              emptyTitle="No published posts"
              emptyDescription="Mark posts as published to see them here"
            >
              {recentlyPublished.map((post) => (
                <PostCard key={post.id} post={post} />
              ))}
            </Section>

            {/* Week Ahead + Reminders - full width, side-by-side on lg+ */}
            <div className="lg:col-span-2 xl:col-span-3 grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-1">
                <CalendarWidget posts={scheduledPostsForCalendar} reminders={allReminders} />
              </div>
              <div className="lg:col-span-2">
                <Section
                  title="Upcoming Reminders"
                  icon={Bell}
                  viewAllLink="/dashboard"
                  viewAllLabel="Manage reminders"
                  isEmpty={false}
                >
                  <RemindersList limit={5} showAddButton={true} />
                </Section>
              </div>
            </div>

            {/* Projects section - full width */}
            <div className="lg:col-span-2 xl:col-span-3">
              <section className="animate-fade-in">
                {/* Section header */}
                <div className="flex items-center justify-between gap-2 mb-4">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="p-2 rounded-lg bg-[hsl(var(--gold))]/10 shrink-0">
                      <FolderKanban className="w-4 h-4 text-[hsl(var(--gold-dark))]" />
                    </div>
                    <h2 className="text-sm font-bold uppercase tracking-widest text-[hsl(var(--gold-dark))] truncate">
                      Projects
                    </h2>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowCreateProjectModal(true)}
                      className="text-xs font-medium text-[hsl(var(--gold-dark))] hover:text-[hsl(var(--gold))] transition-colors flex items-center gap-1 whitespace-nowrap shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      New
                    </button>
                    {recentProjects.length > 0 && (
                      <Link
                        href="/projects"
                        className="text-xs font-medium text-muted-foreground hover:text-[hsl(var(--gold-dark))] transition-colors flex items-center gap-1 whitespace-nowrap shrink-0"
                      >
                        View all
                        <ChevronRight className="w-3.5 h-3.5" />
                      </Link>
                    )}
                  </div>
                </div>

                {/* Content or empty state */}
                {recentProjects.length === 0 ? (
                  <div className="text-center py-8 px-4 rounded-xl border border-dashed border-border bg-card/50">
                    <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-[hsl(var(--gold))]/10 flex items-center justify-center">
                      <FolderKanban className="w-6 h-6 text-[hsl(var(--gold-dark))]" />
                    </div>
                    <p className="text-sm font-medium mb-1">No projects yet</p>
                    <p className="text-xs text-muted-foreground mb-4">
                      Create a project to organize campaigns and brand assets
                    </p>
                    <button
                      onClick={() => setShowCreateProjectModal(true)}
                      className={cn(
                        'inline-flex items-center gap-2 px-4 py-2 rounded-lg',
                        'bg-[hsl(var(--gold))]/10 text-[hsl(var(--gold-dark))]',
                        'text-sm font-medium',
                        'hover:bg-[hsl(var(--gold))]/20 transition-colors'
                      )}
                    >
                      <Plus className="w-4 h-4" />
                      Create Project
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {recentProjects.map((project) => (
                      <ProjectMiniCard
                        key={project.id}
                        project={project}
                        campaignCount={campaignCountsByProject[project.id] || 0}
                      />
                    ))}
                  </div>
                )}
              </section>
            </div>

            {/* Campaigns section - full width */}
            <div className="lg:col-span-2 xl:col-span-3">
              <Section
                title={
                  selectedProject === 'all'
                    ? 'Campaigns'
                    : selectedProject === 'unassigned'
                      ? 'Unassigned Campaigns'
                      : 'Project Campaigns'
                }
                icon={FolderOpen}
                viewAllLink="/campaigns"
                viewAllLabel="View all campaigns"
                isEmpty={recentCampaigns.length === 0}
                emptyIcon={FolderOpen}
                emptyTitle={
                  selectedProject === 'all' ? 'No campaigns yet' : 'No campaigns in this project'
                }
                emptyDescription={
                  selectedProject === 'all'
                    ? 'Create a campaign to group related posts'
                    : 'Add campaigns to this project'
                }
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {recentCampaigns.map((campaign) => (
                    <CampaignCard key={campaign.id} campaign={campaign} />
                  ))}
                </div>
              </Section>
            </div>
          </div>
        )}

        {/* Create Project Modal */}
        <CreateProjectModal
          open={showCreateProjectModal}
          onClose={() => setShowCreateProjectModal(false)}
          onSuccess={(projectId) => {
            router.push(`/projects/${projectId}`)
          }}
        />
      </div>
    </>
  )
}
