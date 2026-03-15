'use client'

import { useState, useEffect, useCallback, use } from 'react'
import { useRouter } from 'next/navigation'
import { useCampaignsStore } from '@/lib/campaigns'
import { usePostsStore } from '@/lib/storage'
import { useProjectsStore } from '@/lib/projects'
import { useLaunchPostsStore } from '@/lib/launchPosts'
import { Campaign, CampaignStatus, Post } from '@/lib/posts'
import { MoveCampaignModal } from '@/components/campaigns/MoveCampaignModal'
import { ResourceNotFound } from '@/components/ui/ResourceNotFound'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { CampaignHeader } from './CampaignHeader'
import { PostsSection, LaunchPostsSection } from './CampaignPostsSection'
import { AddPostModal } from './AddPostModal'
import { AddLaunchPostModal } from './AddLaunchPostModal'

function useCampaignStores() {
  const campaignStore = useCampaignsStore()
  const { posts: allPosts, fetchPosts, initialized: postsInitialized, updatePost } = usePostsStore()
  const { projects, fetchProjects, initialized: projectsInitialized } = useProjectsStore()
  const launchPostStore = useLaunchPostsStore()
  useEffect(() => {
    const fetches: Promise<void>[] = []
    if (!postsInitialized) fetches.push(fetchPosts())
    if (!projectsInitialized) fetches.push(fetchProjects())
    if (!launchPostStore.initialized) fetches.push(launchPostStore.fetchLaunchPosts())
    if (fetches.length > 0) void Promise.all(fetches).catch(() => {})
  }, [
    postsInitialized,
    fetchPosts,
    projectsInitialized,
    fetchProjects,
    launchPostStore.initialized,
    launchPostStore.fetchLaunchPosts,
  ])
  return { campaignStore, allPosts, updatePost, projects, launchPostStore }
}

function useCampaignData(id: string) {
  const { getCampaignWithPosts } = useCampaignsStore()
  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [campaignPosts, setCampaignPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    async function load() {
      if (!id) return
      setLoading(true)
      const data = await getCampaignWithPosts(id)
      if (data) {
        setCampaign(data.campaign)
        setCampaignPosts(data.posts)
      }
      setLoading(false)
    }
    load()
  }, [id, getCampaignWithPosts])
  return { campaign, setCampaign, campaignPosts, setCampaignPosts, loading }
}

// eslint-disable-next-line max-lines-per-function
export default function CampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const { campaignStore, allPosts, updatePost, projects, launchPostStore } = useCampaignStores()
  const { campaign, setCampaign, campaignPosts, setCampaignPosts, loading } = useCampaignData(id)

  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState(campaign?.name || '')
  const [editDescription, setEditDescription] = useState(campaign?.description || '')
  const [showAddPostModal, setShowAddPostModal] = useState(false)
  const [showAddLaunchPostModal, setShowAddLaunchPostModal] = useState(false)
  const [showMoveModal, setShowMoveModal] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<'campaign' | string | null>(null)

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (campaign) {
      setEditName(campaign.name)
      setEditDescription(campaign.description || '')
    }
  }, [campaign])

  /* eslint-enable react-hooks/set-state-in-effect */
  const handleSave = async () => {
    if (!campaign || !editName.trim()) return
    await campaignStore.updateCampaign(campaign.id, {
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
    await campaignStore.updateCampaign(campaign.id, { status })
    setCampaign({ ...campaign, status })
  }

  const confirmDeleteCampaign = useCallback(async () => {
    if (!campaign) return
    await campaignStore.deleteCampaign(campaign.id)
    setDeleteTarget(null)
    router.push('/campaigns')
  }, [campaign, campaignStore, router])

  const handleRemovePost = async (postId: string) => {
    if (!campaign) return
    await campaignStore.removePostFromCampaign(campaign.id, postId)
    setCampaignPosts(campaignPosts.filter((p) => p.id !== postId))
  }

  const handleAddPost = async (postId: string) => {
    if (!campaign) return
    await updatePost(postId, { campaignId: campaign.id })
    const data = await campaignStore.getCampaignWithPosts(campaign.id)
    if (data) setCampaignPosts(data.posts)
    setShowAddPostModal(false)
  }

  const availablePosts = allPosts.filter(
    (p) => !p.campaignId && p.status !== 'archived' && !campaignPosts.some((cp) => cp.id === p.id)
  )
  const campaignLaunchPosts = launchPostStore.launchPosts.filter((lp) => lp.campaignId === id)
  const availableLaunchPosts = launchPostStore.launchPosts.filter((lp) => !lp.campaignId)

  const handleAddLaunchPost = async (launchPostId: string) => {
    if (!campaign) return
    await launchPostStore.updateLaunchPost(launchPostId, { campaignId: campaign.id })
    setShowAddLaunchPostModal(false)
  }

  const handleRemoveLaunchPost = async (launchPostId: string) => {
    if (!campaign) return
    await launchPostStore.updateLaunchPost(launchPostId, { campaignId: null })
  }

  const confirmDeleteLaunchPost = useCallback(async () => {
    if (deleteTarget && deleteTarget !== 'campaign') {
      await launchPostStore.deleteLaunchPost(deleteTarget)
      setDeleteTarget(null)
    }
  }, [deleteTarget, launchPostStore])

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
    return <ResourceNotFound type="Campaign" listUrl="/campaigns" listLabel="Campaigns" />
  }

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto animate-fade-in">
      <CampaignHeader
        campaign={campaign}
        projects={projects}
        postCount={campaignPosts.length}
        editing={editing}
        editName={editName}
        setEditName={setEditName}
        editDescription={editDescription}
        setEditDescription={setEditDescription}
        onSave={handleSave}
        onCancelEdit={() => {
          setEditing(false)
          setEditName(campaign.name)
          setEditDescription(campaign.description || '')
        }}
        onEdit={() => setEditing(true)}
        onDelete={() => setDeleteTarget('campaign')}
        onMove={() => setShowMoveModal(true)}
        onStatusChange={handleStatusChange}
      />
      <PostsSection
        campaignId={campaign.id}
        posts={campaignPosts}
        availablePostsCount={availablePosts.length}
        onShowAddModal={() => setShowAddPostModal(true)}
        onRemovePost={handleRemovePost}
      />
      <LaunchPostsSection
        campaignId={campaign.id}
        launchPosts={campaignLaunchPosts}
        availableLaunchPostsCount={availableLaunchPosts.length}
        onShowAddModal={() => setShowAddLaunchPostModal(true)}
        onRemoveLaunchPost={handleRemoveLaunchPost}
        onDeleteLaunchPost={(id) => setDeleteTarget(id)}
        onEditLaunchPost={(id) => router.push(`/launch-posts/${id}`)}
      />
      {showAddPostModal && (
        <AddPostModal
          posts={availablePosts}
          onClose={() => setShowAddPostModal(false)}
          onAdd={handleAddPost}
        />
      )}
      {showAddLaunchPostModal && (
        <AddLaunchPostModal
          launchPosts={availableLaunchPosts}
          onClose={() => setShowAddLaunchPostModal(false)}
          onAdd={handleAddLaunchPost}
        />
      )}
      {showMoveModal && campaign && (
        <MoveCampaignModal
          campaign={campaign}
          onClose={() => setShowMoveModal(false)}
          onMoved={async () => {
            const data = await campaignStore.getCampaignWithPosts(campaign.id)
            if (data) setCampaign(data.campaign)
          }}
        />
      )}
      <ConfirmDialog
        open={deleteTarget === 'campaign'}
        onConfirm={confirmDeleteCampaign}
        onCancel={() => setDeleteTarget(null)}
        title="Delete Campaign"
        description="Are you sure you want to delete this campaign? Posts will be unlinked but not deleted."
        confirmText="Delete"
        variant="danger"
      />
      <ConfirmDialog
        open={!!deleteTarget && deleteTarget !== 'campaign'}
        onConfirm={confirmDeleteLaunchPost}
        onCancel={() => setDeleteTarget(null)}
        title="Delete Launch Post"
        description="Are you sure you want to delete this launch post?"
        confirmText="Delete"
        variant="danger"
      />
    </div>
  )
}
