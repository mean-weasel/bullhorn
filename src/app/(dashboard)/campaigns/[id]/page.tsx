'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { format } from 'date-fns'
import {
  ArrowLeft,
  Edit2,
  Plus,
  Trash2,
  X,
  FolderOpen,
  FileText,
  Rocket,
  CheckCircle,
  Archive,
  Clock,
  Calendar,
  AlertCircle,
  FolderKanban,
} from 'lucide-react'
import { useCampaignsStore } from '@/lib/campaigns'
import { usePostsStore } from '@/lib/storage'
import { useProjectsStore } from '@/lib/projects'
import { useLaunchPostsStore, LaunchPost, LAUNCH_PLATFORM_INFO } from '@/lib/launchPosts'
import {
  Campaign,
  CampaignStatus,
  Post,
  PostStatus,
  getPostPreviewText,
  PLATFORM_INFO,
} from '@/lib/posts'
import { cn } from '@/lib/utils'
import { getMediaUrl } from '@/lib/media'
import { MoveCampaignModal } from '@/components/campaigns/MoveCampaignModal'
import { LaunchPostCard } from '@/components/launch-posts/LaunchPostCard'

const CAMPAIGN_STATUS_CONFIG: Record<
  CampaignStatus,
  { label: string; icon: typeof FileText; color: string }
> = {
  draft: { label: 'Draft', icon: FileText, color: 'text-muted-foreground' },
  active: { label: 'Active', icon: Rocket, color: 'text-blue-400' },
  completed: { label: 'Completed', icon: CheckCircle, color: 'text-green-400' },
  archived: { label: 'Archived', icon: Archive, color: 'text-muted-foreground' },
}

const POST_STATUS_CONFIG: Record<
  PostStatus,
  { label: string; icon: typeof FileText; color: string }
> = {
  draft: { label: 'Draft', icon: FileText, color: 'text-muted-foreground' },
  scheduled: { label: 'Scheduled', icon: Calendar, color: 'text-blue-400' },
  published: { label: 'Published', icon: CheckCircle, color: 'text-green-400' },
  failed: { label: 'Failed', icon: AlertCircle, color: 'text-destructive' },
  archived: { label: 'Archived', icon: Archive, color: 'text-muted-foreground' },
}

export default function CampaignDetailPage({ params }: { params: { id: string } }) {
  const { id } = params
  const router = useRouter()
  const { getCampaignWithPosts, updateCampaign, deleteCampaign, removePostFromCampaign } =
    useCampaignsStore()
  const { posts: allPosts, fetchPosts, initialized: postsInitialized, updatePost } = usePostsStore()
  const { projects, fetchProjects, initialized: projectsInitialized } = useProjectsStore()
  const {
    launchPosts: allLaunchPosts,
    fetchLaunchPosts,
    initialized: launchPostsInitialized,
    updateLaunchPost,
    deleteLaunchPost,
  } = useLaunchPostsStore()

  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [campaignPosts, setCampaignPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [showAddPostModal, setShowAddPostModal] = useState(false)
  const [showAddLaunchPostModal, setShowAddLaunchPostModal] = useState(false)
  const [showMoveModal, setShowMoveModal] = useState(false)

  useEffect(() => {
    if (!postsInitialized) {
      fetchPosts()
    }
    if (!projectsInitialized) {
      fetchProjects()
    }
    if (!launchPostsInitialized) {
      fetchLaunchPosts()
    }
  }, [
    postsInitialized,
    fetchPosts,
    projectsInitialized,
    fetchProjects,
    launchPostsInitialized,
    fetchLaunchPosts,
  ])

  useEffect(() => {
    async function loadCampaign() {
      if (!id) return
      setLoading(true)
      const data = await getCampaignWithPosts(id)
      if (data) {
        setCampaign(data.campaign)
        setCampaignPosts(data.posts)
        setEditName(data.campaign.name)
        setEditDescription(data.campaign.description || '')
      }
      setLoading(false)
    }
    loadCampaign()
  }, [id, getCampaignWithPosts])

  const handleSave = async () => {
    if (!campaign || !editName.trim()) return
    await updateCampaign(campaign.id, {
      name: editName.trim(),
      description: editDescription.trim() || undefined,
    })
    setCampaign({
      ...campaign,
      name: editName.trim(),
      description: editDescription.trim() || undefined,
    })
    setEditing(false)
  }

  const handleStatusChange = async (status: CampaignStatus) => {
    if (!campaign) return
    await updateCampaign(campaign.id, { status })
    setCampaign({ ...campaign, status })
  }

  const handleDelete = async () => {
    if (!campaign) return
    if (
      confirm(
        'Are you sure you want to delete this campaign? Posts will be unlinked but not deleted.'
      )
    ) {
      await deleteCampaign(campaign.id)
      router.push('/campaigns')
    }
  }

  const handleRemovePost = async (postId: string) => {
    if (!campaign) return
    await removePostFromCampaign(campaign.id, postId)
    setCampaignPosts(campaignPosts.filter((p) => p.id !== postId))
  }

  const handleAddPost = async (postId: string) => {
    if (!campaign) return
    await updatePost(postId, { campaignId: campaign.id })
    // Refresh campaign posts
    const data = await getCampaignWithPosts(campaign.id)
    if (data) {
      setCampaignPosts(data.posts)
    }
    setShowAddPostModal(false)
  }

  // Get posts not in this campaign
  const availablePosts = allPosts.filter(
    (p) => !p.campaignId && p.status !== 'archived' && !campaignPosts.some((cp) => cp.id === p.id)
  )

  // Get launch posts for this campaign
  const campaignLaunchPosts = allLaunchPosts.filter((lp) => lp.campaignId === id)

  // Get launch posts not in any campaign (available to add)
  const availableLaunchPosts = allLaunchPosts.filter((lp) => !lp.campaignId)

  const handleAddLaunchPost = async (launchPostId: string) => {
    if (!campaign) return
    await updateLaunchPost(launchPostId, { campaignId: campaign.id })
    setShowAddLaunchPostModal(false)
  }

  const handleRemoveLaunchPost = async (launchPostId: string) => {
    if (!campaign) return
    await updateLaunchPost(launchPostId, { campaignId: null })
  }

  const handleDeleteLaunchPost = async (launchPostId: string) => {
    if (confirm('Are you sure you want to delete this launch post?')) {
      await deleteLaunchPost(launchPostId)
    }
  }

  if (loading) {
    return (
      <div className="p-4 md:p-6 max-w-5xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-48" />
          <div className="h-32 bg-muted rounded" />
        </div>
      </div>
    )
  }

  if (!campaign) {
    return (
      <div className="p-4 md:p-6 max-w-5xl mx-auto text-center py-16">
        <h2 className="text-xl font-semibold mb-2">Campaign not found</h2>
        <Link href="/campaigns" className="text-[hsl(var(--gold))] hover:underline">
          Back to Campaigns
        </Link>
      </div>
    )
  }

  const statusConfig = CAMPAIGN_STATUS_CONFIG[campaign.status]

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto animate-fade-in">
      {/* Header */}
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
            {editing ? (
              <div className="space-y-3">
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full text-2xl md:text-3xl font-display font-bold bg-transparent border-b-2 border-[hsl(var(--gold))] focus:outline-none"
                  autoFocus
                />
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="Add a description..."
                  rows={2}
                  className="w-full text-sm text-muted-foreground bg-transparent border border-border rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-[hsl(var(--gold))]/50 resize-none"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleSave}
                    className="px-4 py-2 rounded-lg bg-[hsl(var(--gold))] text-primary-foreground text-sm font-medium hover:bg-[hsl(var(--gold-dark))] transition-colors"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => {
                      setEditing(false)
                      setEditName(campaign.name)
                      setEditDescription(campaign.description || '')
                    }}
                    className="px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-accent transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-lg bg-[hsl(var(--gold))]/10 flex items-center justify-center">
                    <FolderOpen className="w-5 h-5 text-[hsl(var(--gold-dark))]" />
                  </div>
                  <h1 className="text-2xl md:text-3xl font-display font-bold tracking-tight">
                    {campaign.name}
                  </h1>
                  <button
                    onClick={() => setEditing(true)}
                    className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                </div>
                {campaign.description && (
                  <p className="text-muted-foreground mb-3">{campaign.description}</p>
                )}
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <span className={cn('flex items-center gap-1.5', statusConfig.color)}>
                    <statusConfig.icon className="w-4 h-4" />
                    {statusConfig.label}
                  </span>
                  <span className="text-muted-foreground">
                    {campaignPosts.length} {campaignPosts.length === 1 ? 'post' : 'posts'}
                  </span>
                  <span className="text-muted-foreground">
                    Updated {format(new Date(campaign.updatedAt), 'MMM d, yyyy')}
                  </span>
                </div>
                {/* Project info */}
                <div className="flex items-center gap-2 mt-3">
                  {campaign.projectId ? (
                    <>
                      {(() => {
                        const project = projects.find((p) => p.id === campaign.projectId)
                        return (
                          <Link
                            href={`/projects/${campaign.projectId}`}
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
                        )
                      })()}
                    </>
                  ) : (
                    <span className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted text-sm text-muted-foreground">
                      <FolderKanban className="w-4 h-4" />
                      Unassigned
                    </span>
                  )}
                  <button
                    onClick={() => setShowMoveModal(true)}
                    className="text-sm text-muted-foreground hover:text-[hsl(var(--gold-dark))] transition-colors"
                  >
                    Move
                  </button>
                </div>
              </>
            )}
          </div>
          {!editing && (
            <button
              onClick={handleDelete}
              className="p-2 rounded-lg text-destructive hover:bg-destructive/10 transition-colors"
              title="Delete campaign"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Status selector */}
        {!editing && (
          <div className="flex gap-2 mt-4">
            {(['draft', 'active', 'completed', 'archived'] as CampaignStatus[]).map((status) => {
              const config = CAMPAIGN_STATUS_CONFIG[status]
              return (
                <button
                  key={status}
                  onClick={() => handleStatusChange(status)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                    campaign.status === status
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
        )}
      </div>

      {/* Posts section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Posts in Campaign</h2>
          <div className="flex gap-2">
            {availablePosts.length > 0 && (
              <button
                onClick={() => setShowAddPostModal(true)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-sm font-medium hover:bg-accent transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Existing Post
              </button>
            )}
            <Link
              href={`/new?campaign=${campaign.id}`}
              className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium',
                'bg-gradient-to-br from-[hsl(var(--gold))] to-[hsl(var(--gold-dark))]',
                'text-primary-foreground hover:shadow-lg hover:shadow-[hsl(var(--gold))]/30 transition-all'
              )}
            >
              <Plus className="w-4 h-4" />
              New Post
            </Link>
          </div>
        </div>

        {campaignPosts.length === 0 ? (
          <div className="text-center py-12 bg-card border border-border rounded-xl">
            <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-[hsl(var(--gold))]/10 flex items-center justify-center">
              <FileText className="w-6 h-6 text-[hsl(var(--gold-dark))]" />
            </div>
            <h3 className="font-semibold mb-1">No posts yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Add posts to this campaign to track them together.
            </p>
            <Link
              href={`/new?campaign=${campaign.id}`}
              className={cn(
                'inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium',
                'bg-gradient-to-br from-[hsl(var(--gold))] to-[hsl(var(--gold-dark))]',
                'text-primary-foreground hover:shadow-lg hover:shadow-[hsl(var(--gold))]/30 transition-all'
              )}
            >
              <Plus className="w-4 h-4" />
              Create First Post
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {campaignPosts.map((post, i) => (
              <CampaignPostCard
                key={post.id}
                post={post}
                index={i}
                onRemove={() => handleRemovePost(post.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Launch Posts section */}
      <div className="space-y-4 mt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Rocket className="w-5 h-5 text-[hsl(var(--gold-dark))]" />
            Launch Posts
          </h2>
          <div className="flex gap-2">
            {availableLaunchPosts.length > 0 && (
              <button
                onClick={() => setShowAddLaunchPostModal(true)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-sm font-medium hover:bg-accent transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Existing
              </button>
            )}
            <Link
              href={`/launch-posts/new?campaignId=${campaign.id}`}
              className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium',
                'bg-gradient-to-br from-[hsl(var(--gold))] to-[hsl(var(--gold-dark))]',
                'text-primary-foreground hover:shadow-lg hover:shadow-[hsl(var(--gold))]/30 transition-all'
              )}
            >
              <Plus className="w-4 h-4" />
              New Launch Post
            </Link>
          </div>
        </div>

        {campaignLaunchPosts.length === 0 ? (
          <div className="text-center py-8 bg-card border border-border rounded-xl">
            <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-[hsl(var(--gold))]/10 flex items-center justify-center">
              <Rocket className="w-6 h-6 text-[hsl(var(--gold-dark))]" />
            </div>
            <h3 className="font-semibold mb-1">No launch posts yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Add launch posts to coordinate your product launch across platforms.
            </p>
            <Link
              href={`/launch-posts/new?campaignId=${campaign.id}`}
              className={cn(
                'inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium',
                'bg-gradient-to-br from-[hsl(var(--gold))] to-[hsl(var(--gold-dark))]',
                'text-primary-foreground hover:shadow-lg hover:shadow-[hsl(var(--gold))]/30 transition-all'
              )}
            >
              <Plus className="w-4 h-4" />
              Create Launch Post
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {campaignLaunchPosts.map((launchPost, i) => (
              <div key={launchPost.id} className="relative group">
                <LaunchPostCard
                  post={launchPost}
                  index={i}
                  onEdit={() => router.push(`/launch-posts/${launchPost.id}`)}
                  onDelete={() => handleDeleteLaunchPost(launchPost.id)}
                />
                {/* Remove from campaign button */}
                <button
                  onClick={() => handleRemoveLaunchPost(launchPost.id)}
                  className="absolute top-3 right-14 p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors opacity-0 group-hover:opacity-100"
                  title="Remove from campaign"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Post Modal */}
      {showAddPostModal && (
        <AddPostModal
          posts={availablePosts}
          onClose={() => setShowAddPostModal(false)}
          onAdd={handleAddPost}
        />
      )}

      {/* Add Launch Post Modal */}
      {showAddLaunchPostModal && (
        <AddLaunchPostModal
          launchPosts={availableLaunchPosts}
          onClose={() => setShowAddLaunchPostModal(false)}
          onAdd={handleAddLaunchPost}
        />
      )}

      {/* Move Campaign Modal */}
      {showMoveModal && campaign && (
        <MoveCampaignModal
          campaign={campaign}
          onClose={() => setShowMoveModal(false)}
          onMoved={async () => {
            // Refresh campaign data
            const data = await getCampaignWithPosts(campaign.id)
            if (data) {
              setCampaign(data.campaign)
            }
          }}
        />
      )}
    </div>
  )
}

function CampaignPostCard({
  post,
  index,
  onRemove,
}: {
  post: Post
  index: number
  onRemove: () => void
}) {
  const statusConfig = POST_STATUS_CONFIG[post.status]
  const StatusIcon = statusConfig.icon

  return (
    <div
      className={cn(
        'flex items-start gap-3 md:gap-4 p-3 md:p-4 bg-card border border-border rounded-xl',
        'animate-slide-up'
      )}
      style={{ animationDelay: `${index * 30}ms` }}
    >
      {/* Platform indicator */}
      <div className="flex flex-col gap-1.5 pt-1">
        <span
          className={cn(
            'w-2.5 h-2.5 rounded-full',
            post.platform === 'twitter' && 'bg-twitter shadow-[0_0_8px_rgba(29,161,242,0.4)]',
            post.platform === 'linkedin' && 'bg-linkedin shadow-[0_0_8px_rgba(10,102,194,0.4)]',
            post.platform === 'reddit' && 'bg-reddit shadow-[0_0_8px_rgba(255,69,0,0.4)]'
          )}
          title={PLATFORM_INFO[post.platform].name}
        />
      </div>

      {/* Content */}
      <Link
        href={`/edit/${post.id}`}
        className="flex-1 min-w-0 hover:opacity-80 transition-opacity"
      >
        <p className="text-sm leading-relaxed line-clamp-2 mb-2">
          {getPostPreviewText(post) || (
            <span className="text-muted-foreground italic">No content</span>
          )}
        </p>
        <div className="flex flex-wrap items-center gap-2 md:gap-4 text-xs text-muted-foreground">
          <span className={cn('flex items-center gap-1.5', statusConfig.color)}>
            <StatusIcon className="w-3.5 h-3.5" />
            {statusConfig.label}
          </span>
          {post.scheduledAt && post.status === 'scheduled' && (
            <span className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              {format(new Date(post.scheduledAt), 'MMM d, h:mm a')}
            </span>
          )}
        </div>
      </Link>

      {/* Actions */}
      <div className="flex items-center gap-1">
        <Link
          href={`/edit/${post.id}`}
          className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        >
          <Edit2 className="w-4 h-4" />
        </Link>
        <button
          onClick={onRemove}
          className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
          title="Remove from campaign"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

function AddPostModal({
  posts,
  onClose,
  onAdd,
}: {
  posts: Post[]
  onClose: () => void
  onAdd: (postId: string) => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-xl shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col animate-scale-in">
        <div className="p-4 border-b border-border">
          <h2 className="text-lg font-display font-bold">Add Existing Post</h2>
          <p className="text-sm text-muted-foreground">Select a post to add to this campaign</p>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {posts.map((post) => (
            <button
              key={post.id}
              onClick={() => onAdd(post.id)}
              className="w-full text-left p-3 bg-background border border-border rounded-lg hover:border-[hsl(var(--gold))]/50 transition-colors"
            >
              <div className="flex items-center gap-2 mb-1">
                <span
                  className={cn(
                    'w-2 h-2 rounded-full',
                    post.platform === 'twitter' && 'bg-twitter',
                    post.platform === 'linkedin' && 'bg-linkedin',
                    post.platform === 'reddit' && 'bg-reddit'
                  )}
                />
                <span className="text-xs text-muted-foreground capitalize">{post.status}</span>
              </div>
              <p className="text-sm line-clamp-2">
                {getPostPreviewText(post) || (
                  <span className="text-muted-foreground italic">No content</span>
                )}
              </p>
            </button>
          ))}
        </div>
        <div className="p-4 border-t border-border">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-accent transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

function AddLaunchPostModal({
  launchPosts,
  onClose,
  onAdd,
}: {
  launchPosts: LaunchPost[]
  onClose: () => void
  onAdd: (launchPostId: string) => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-xl shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col animate-scale-in">
        <div className="p-4 border-b border-border">
          <h2 className="text-lg font-display font-bold">Add Launch Post</h2>
          <p className="text-sm text-muted-foreground">
            Select a launch post to add to this campaign
          </p>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {launchPosts.map((launchPost) => {
            const platformInfo = LAUNCH_PLATFORM_INFO[launchPost.platform]
            return (
              <button
                key={launchPost.id}
                onClick={() => onAdd(launchPost.id)}
                className="w-full text-left p-3 bg-background border border-border rounded-lg hover:border-[hsl(var(--gold))]/50 transition-colors"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={cn(
                      'w-6 h-6 rounded flex items-center justify-center text-xs font-bold',
                      platformInfo.bgColor,
                      platformInfo.color
                    )}
                  >
                    {platformInfo.icon}
                  </span>
                  <span className="text-xs text-muted-foreground">{platformInfo.label}</span>
                  <span className="text-xs text-muted-foreground capitalize">
                    • {launchPost.status}
                  </span>
                </div>
                <p className="text-sm line-clamp-2 font-medium">{launchPost.title}</p>
              </button>
            )
          })}
        </div>
        <div className="p-4 border-t border-border">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-accent transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
