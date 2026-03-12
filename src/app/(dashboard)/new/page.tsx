'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import toast from 'react-hot-toast'
import { usePostsStore } from '@/lib/storage'
import { useCampaignsStore } from '@/lib/campaigns'
import { useSocialAccountsStore } from '@/lib/socialAccounts'
import {
  Post,
  Platform,
  PostStatus,
  PLATFORM_INFO,
  createPost,
  isTwitterContent,
  isLinkedInContent,
  isRedditContent,
} from '@/lib/posts'
import { AlertCircle } from 'lucide-react'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { AutoSaveIndicator } from '@/components/ui/AutoSaveIndicator'
import { useAutoSave } from '@/hooks/useAutoSave'
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import {
  PlatformSelector,
  CampaignSelector,
  AccountSelector,
  NotesSection,
  ContentEditor,
  MediaSection,
  LinkedInSettings,
  RedditSettings,
  PublishedLinks,
  SchedulePicker,
  EditorActions,
  PreviewPanel,
} from '@/components/editor'
import RecurrencePicker from '@/components/editor/RecurrencePicker'
import { copyToClipboard } from '@/lib/nativeClipboard'
import { trackMilestone } from '@/lib/appReview'

export default function EditorPage() {
  const params = useParams()
  const id = params.id as string | undefined
  const searchParams = useSearchParams()
  const router = useRouter()
  const {
    addPost,
    updatePost,
    deletePost,
    archivePost,
    restorePost,
    getPost,
    fetchPosts,
    initialized: postsInitialized,
  } = usePostsStore()
  const { campaigns, fetchCampaigns, initialized: campaignsInitialized } = useCampaignsStore()
  const {
    getAccountsByProvider,
    fetchAccounts,
    getActiveAccount,
    initialized: accountsInitialized,
  } = useSocialAccountsStore()

  const isNew = !id
  const existingPost = id ? getPost(id) : undefined
  const [isSaving, setIsSaving] = useState(false)
  const [isPublishing, setIsPublishing] = useState(false)
  const [copied, setCopied] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false)
  const [showPlatformSwitchConfirm, setShowPlatformSwitchConfirm] = useState(false)
  const [pendingPlatform, setPendingPlatform] = useState<Platform | null>(null)
  const [showCampaignDropdown, setShowCampaignDropdown] = useState(false)
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false)

  // Fetch stores on mount if not initialized
  useEffect(() => {
    if (!postsInitialized) fetchPosts()
    if (!campaignsInitialized) fetchCampaigns()
    if (!accountsInitialized) fetchAccounts()
  }, [
    postsInitialized,
    fetchPosts,
    campaignsInitialized,
    fetchCampaigns,
    accountsInitialized,
    fetchAccounts,
  ])

  // Form state
  const [post, setPost] = useState<Post>(() => {
    if (existingPost) return existingPost
    const newPost = createPost()
    const dateParam = searchParams.get('date')
    if (dateParam) {
      newPost.scheduledAt = `${dateParam}T12:00:00.000Z`
    }
    // Handle campaign from URL param
    const campaignParam = searchParams.get('campaign')
    if (campaignParam) {
      newPost.campaignId = campaignParam
    }
    return newPost
  })
  // Pre-populate content from shared URL params (iOS share extension)
  const [content, setContent] = useState(() => {
    const sharedText = searchParams.get('text') || ''
    const sharedUrl = searchParams.get('url') || ''
    if (sharedText && sharedUrl) return `${sharedText}\n\n${sharedUrl}`
    return sharedText || sharedUrl || ''
  })
  const [mediaUrls, setMediaUrls] = useState<string[]>([])
  const [linkedInMediaUrl, setLinkedInMediaUrl] = useState('')
  const [redditUrl, setRedditUrl] = useState('')
  const [showMediaInput, setShowMediaInput] = useState(false)
  const [showNotes, setShowNotes] = useState(false)
  const [showPublishedLinks, setShowPublishedLinks] = useState(false)
  const [newSubreddit, setNewSubreddit] = useState('')
  const [subredditsInput, setSubredditsInput] = useState<string[]>([])
  const [subredditSchedules, setSubredditSchedules] = useState<Record<string, string>>({})
  const [subredditTitles, setSubredditTitles] = useState<Record<string, string>>({})
  const [expandedSubreddits, setExpandedSubreddits] = useState<Record<string, boolean>>({})

  // Get active accounts for current platform
  const platformAccounts = getAccountsByProvider(post.platform).filter((a) => a.status === 'active')

  // Auto-select single account
  useEffect(() => {
    if (platformAccounts.length === 1 && !post.socialAccountId) {
      setPost((prev) => ({ ...prev, socialAccountId: platformAccounts[0].id }))
    }
  }, [platformAccounts, post.socialAccountId])

  const handleAccountSelect = (accountId: string) => {
    setPost((prev) => ({ ...prev, socialAccountId: accountId }))
  }

  // Helper functions for subreddit card management
  const toggleSubredditExpanded = (subreddit: string) => {
    setExpandedSubreddits((prev) => ({
      ...prev,
      [subreddit]: !prev[subreddit],
    }))
  }

  const updateSubredditTitle = (subreddit: string, title: string) => {
    setSubredditTitles((prev) => ({ ...prev, [subreddit]: title }))
  }

  const updateSubredditSchedule = (subreddit: string, isoString: string | null) => {
    if (isoString === null) {
      setSubredditSchedules((prev) => {
        const next = { ...prev }
        delete next[subreddit]
        return next
      })
    } else {
      setSubredditSchedules((prev) => ({ ...prev, [subreddit]: isoString }))
    }
  }

  const removeSubreddit = (subreddit: string) => {
    setSubredditsInput((prev) => prev.filter((s) => s !== subreddit))
    setSubredditTitles((prev) => {
      const next = { ...prev }
      delete next[subreddit]
      return next
    })
    setSubredditSchedules((prev) => {
      const next = { ...prev }
      delete next[subreddit]
      return next
    })
    setExpandedSubreddits((prev) => {
      const next = { ...prev }
      delete next[subreddit]
      return next
    })
  }

  // Track if form has unsaved changes
  const initialContentRef = useRef('')
  const [isDirty, setIsDirty] = useState(false)

  // Update dirty state when content changes
  useEffect(() => {
    const currentContent = JSON.stringify({
      content,
      mediaUrls,
      linkedInMediaUrl,
      redditUrl,
      platform: post.platform,
      notes: post.notes,
    })
    if (initialContentRef.current && currentContent !== initialContentRef.current) {
      setIsDirty(true)
    }
  }, [content, mediaUrls, linkedInMediaUrl, redditUrl, post.platform, post.notes])

  // Warn about unsaved changes on browser close/refresh
  useUnsavedChanges({ isDirty })

  // Auto-save (only for drafts or new posts)
  const hasMultipleSubreddits = post.platform === 'reddit' && subredditsInput.length > 1

  // Check if scheduling is valid
  const canSchedule = hasMultipleSubreddits
    ? subredditsInput.every((sub) => subredditSchedules[sub]) || !!post.scheduledAt
    : !!post.scheduledAt

  const { status: autoSaveStatus } = useAutoSave({
    data: { post, content, mediaUrls, linkedInMediaUrl, redditUrl },
    onSave: async () => {
      if (isSaving) return // Manual save in progress, skip auto-save
      const toSave = { ...post, status: 'draft' as const }
      try {
        if (isNew) {
          const created = await addPost(toSave)
          router.replace(`/edit/${created.id}`)
        } else {
          await updatePost(toSave.id, toSave)
        }
        setIsDirty(false)
      } catch (error) {
        console.error('Auto-save failed:', error)
      }
    },
    delay: 2000,
    enabled:
      (post.status === 'draft' || isNew) &&
      !(isNew && hasMultipleSubreddits) &&
      (process.env.NEXT_PUBLIC_E2E_TEST_MODE !== 'true' || searchParams.get('autosave') === 'true'),
    skipInitialChange: !isNew,
  })

  // Load existing post data into form
  useEffect(() => {
    if (existingPost) {
      setPost(existingPost)
      let text = ''
      if (isTwitterContent(existingPost.content)) {
        text = existingPost.content.text
        setMediaUrls(existingPost.content.mediaUrls || [])
      } else if (isLinkedInContent(existingPost.content)) {
        text = existingPost.content.text
        setLinkedInMediaUrl(existingPost.content.mediaUrl || '')
      } else if (isRedditContent(existingPost.content)) {
        text = existingPost.content.body || ''
        setRedditUrl(existingPost.content.url || '')
        const subreddit = existingPost.content.subreddit
        setSubredditsInput([subreddit])
        if (existingPost.content.title) {
          setSubredditTitles({ [subreddit]: existingPost.content.title })
        }
        if (existingPost.scheduledAt) {
          setSubredditSchedules({ [subreddit]: existingPost.scheduledAt })
        }
        setExpandedSubreddits({ [subreddit]: true })
      }
      setContent(text)
      const loadedMediaUrls = isTwitterContent(existingPost.content)
        ? existingPost.content.mediaUrls || []
        : []
      const loadedLinkedInMedia = isLinkedInContent(existingPost.content)
        ? existingPost.content.mediaUrl || ''
        : ''
      const loadedRedditUrl = isRedditContent(existingPost.content)
        ? existingPost.content.url || ''
        : ''
      initialContentRef.current = JSON.stringify({
        content: text,
        mediaUrls: loadedMediaUrls,
        linkedInMediaUrl: loadedLinkedInMedia,
        redditUrl: loadedRedditUrl,
        platform: existingPost.platform,
        notes: existingPost.notes || '',
      })
      if (existingPost.notes) {
        setShowNotes(true)
      }
      const hasLaunchedUrls =
        (isTwitterContent(existingPost.content) && existingPost.content.launchedUrl) ||
        (isLinkedInContent(existingPost.content) && existingPost.content.launchedUrl) ||
        (isRedditContent(existingPost.content) && existingPost.content.launchedUrl)
      if (hasLaunchedUrls) {
        setShowPublishedLinks(true)
      }
    } else {
      initialContentRef.current = JSON.stringify({
        content: '',
        mediaUrls: [],
        linkedInMediaUrl: '',
        redditUrl: '',
        platform: 'twitter',
        notes: '',
      })
    }
  }, [existingPost])

  // Handle save
  const handleSave = async (postToSave: Post) => {
    setIsSaving(true)
    setIsDirty(false)
    try {
      if (isNew && postToSave.platform === 'reddit' && subredditsInput.length > 1) {
        const groupId = crypto.randomUUID()
        const redditContent = postToSave.content as {
          subreddit: string
          title: string
          body?: string
          url?: string
          flairText?: string
        }
        for (const subreddit of subredditsInput) {
          const subredditScheduledAt = subredditSchedules[subreddit] || postToSave.scheduledAt
          const subredditTitle = subredditTitles[subreddit] || ''
          const postForSubreddit: Post = {
            ...postToSave,
            id: crypto.randomUUID(),
            groupId,
            groupType: 'reddit-crosspost',
            scheduledAt: subredditScheduledAt,
            content: {
              ...redditContent,
              subreddit,
              title: subredditTitle,
            },
          }
          await addPost(postForSubreddit)
        }
      } else if (isNew) {
        const finalPost = { ...postToSave }
        if (finalPost.platform === 'reddit' && subredditsInput.length === 1) {
          const subreddit = subredditsInput[0]
          const redditContent = finalPost.content as {
            subreddit: string
            title: string
            body?: string
            url?: string
            flairText?: string
          }
          finalPost.content = {
            ...redditContent,
            subreddit,
            title: subredditTitles[subreddit] || redditContent.title || '',
          }
        }
        await addPost(finalPost)
      } else {
        const finalPost = { ...postToSave }
        if (finalPost.platform === 'reddit' && subredditsInput.length >= 1) {
          const subreddit = subredditsInput[0]
          const redditContent = finalPost.content as {
            subreddit: string
            title: string
            body?: string
            url?: string
            flairText?: string
          }
          finalPost.content = {
            ...redditContent,
            subreddit,
            title: subredditTitles[subreddit] || redditContent.title || '',
          }
        }
        await updatePost(finalPost.id, finalPost)
      }
      trackMilestone()
      router.push('/')
    } catch (error) {
      toast.error('Failed to save post')
      setIsDirty(true)
    } finally {
      setIsSaving(false)
    }
  }

  // Handle delete
  const handleDelete = () => {
    setShowDeleteConfirm(true)
  }

  const confirmDelete = async () => {
    if (id) {
      try {
        await deletePost(id)
        toast.success('Post deleted')
        router.push('/')
      } catch (error) {
        toast.error('Failed to delete post')
      }
    }
  }

  // Handle archive
  const handleArchive = () => {
    setShowArchiveConfirm(true)
  }

  const confirmArchive = async () => {
    if (id) {
      try {
        await archivePost(id)
        toast.success('Post archived')
        router.push('/')
      } catch (error) {
        toast.error('Failed to archive post')
      }
    }
  }

  // Handle restore
  const handleRestore = async () => {
    if (id) {
      try {
        await restorePost(id)
        toast.success('Post restored to drafts')
        router.push('/')
      } catch (error) {
        toast.error('Failed to restore post')
      }
    }
  }

  // Set platform (single selection)
  const setPlatform = (platform: Platform) => {
    const hasContent =
      content.trim().length > 0 ||
      mediaUrls.length > 0 ||
      linkedInMediaUrl ||
      redditUrl ||
      subredditsInput.length > 0

    if (hasContent && platform !== post.platform) {
      setPendingPlatform(platform)
      setShowPlatformSwitchConfirm(true)
      return
    }
    executePlatformSwitch(platform)
  }

  const executePlatformSwitch = (platform: Platform) => {
    setPost((prev) => ({ ...prev, platform, socialAccountId: undefined }))
    if (platform !== 'reddit') {
      setSubredditsInput([])
      setSubredditTitles({})
      setSubredditSchedules({})
      setExpandedSubreddits({})
    }
    setPendingPlatform(null)
  }

  const confirmPlatformSwitch = () => {
    if (pendingPlatform) {
      executePlatformSwitch(pendingPlatform)
    }
    setShowPlatformSwitchConfirm(false)
  }

  // Update content for the selected platform
  useEffect(() => {
    setPost((prev) => {
      let newContent = prev.content
      const platform = prev.platform

      if (platform === 'twitter') {
        const existingContent = prev.content as { launchedUrl?: string }
        newContent = {
          text: content,
          ...(mediaUrls.length > 0 && { mediaUrls }),
          ...(existingContent?.launchedUrl && { launchedUrl: existingContent.launchedUrl }),
        }
      } else if (platform === 'linkedin') {
        const existingContent = prev.content as {
          visibility?: 'public' | 'connections'
          launchedUrl?: string
        }
        newContent = {
          text: content,
          visibility: existingContent?.visibility || 'public',
          ...(linkedInMediaUrl && { mediaUrl: linkedInMediaUrl }),
          ...(existingContent?.launchedUrl && { launchedUrl: existingContent.launchedUrl }),
        }
      } else if (platform === 'reddit') {
        const existingContent = prev.content as {
          subreddit?: string
          title?: string
          launchedUrl?: string
        }
        newContent = {
          subreddit: existingContent?.subreddit || '',
          title: existingContent?.title || '',
          body: content,
          ...(redditUrl && { url: redditUrl }),
          ...(existingContent?.launchedUrl && { launchedUrl: existingContent.launchedUrl }),
        }
      }

      return { ...prev, content: newContent }
    })
  }, [content, mediaUrls, linkedInMediaUrl, redditUrl])

  // Save as draft
  const handleSaveDraft = () => {
    if (post.platform === 'reddit' && subredditsInput.length === 0) {
      toast.error('Please select at least one subreddit')
      return
    }
    const toSave = { ...post, status: 'draft' as const }
    handleSave(toSave)
    toast.success('Draft saved')
  }

  // Schedule
  const handleSchedule = () => {
    if (post.platform === 'reddit' && subredditsInput.length === 0) {
      toast.error('Please select at least one subreddit')
      return
    }
    const isRedditMulti = post.platform === 'reddit' && subredditsInput.length > 1
    const allSubredditsHaveSchedule =
      isRedditMulti && subredditsInput.every((sub) => subredditSchedules[sub])

    if (!post.scheduledAt && !allSubredditsHaveSchedule) {
      toast.error('Please select a date and time')
      return
    }
    const toSave = { ...post, status: 'scheduled' as const }
    handleSave(toSave)
    toast.success('Post scheduled')
  }

  // Publish Now via API
  const activeAccount = getActiveAccount(post.platform)
  const hasConnectedAccount = !!activeAccount

  const handlePublishNow = async () => {
    if (!content.trim()) {
      toast.error('Please add some content')
      return
    }

    if (post.platform === 'reddit' && subredditsInput.length === 0) {
      toast.error('Please select at least one subreddit')
      return
    }

    const platformLabel = PLATFORM_INFO[post.platform].name

    if (!hasConnectedAccount) {
      toast.error(`Connect your ${platformLabel} account in Settings`)
      return
    }

    // For new posts, save as draft first so we get an id
    let postId = post.id
    if (isNew) {
      try {
        const draft = { ...post, status: 'draft' as PostStatus }
        const created = await addPost(draft)
        postId = created.id
      } catch {
        toast.error('Failed to save post before publishing')
        return
      }
    }

    setIsPublishing(true)
    try {
      const res = await fetch(`/api/posts/${postId}/publish`, {
        method: 'POST',
      })
      const data = await res.json()

      if (data.success) {
        toast.success('Post published!')
        setPost((prev) => ({
          ...prev,
          status: 'published' as PostStatus,
          publishResult: data.publishResult,
        }))
        fetchPosts()
      } else {
        toast.error(data.error || 'Failed to publish')
      }
    } catch (err) {
      toast.error('Failed to publish post')
      console.error('Publish error:', err)
    } finally {
      setIsPublishing(false)
    }
  }

  // Copy content to clipboard
  const handleCopy = async () => {
    const success = await copyToClipboard(content)
    if (success) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      toast.success('Copied to clipboard')
    }
  }

  // Mark as posted (published)
  const handleMarkAsPosted = () => {
    const toSave = {
      ...post,
      status: 'published' as const,
      publishResult: {
        success: true,
        publishedAt: new Date().toISOString(),
      },
    }
    handleSave(toSave)
    toast.success('Marked as posted')
  }

  // Keyboard shortcuts
  useKeyboardShortcuts({
    shortcuts: [
      { key: 's', ctrl: true, handler: handleSaveDraft },
      { key: 'Enter', ctrl: true, handler: handleSchedule },
      {
        key: 'Escape',
        handler: () => {
          if (isDirty) {
            setShowLeaveConfirm(true)
          } else {
            router.push('/')
          }
        },
      },
    ],
  })

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] min-h-[calc(100vh-4rem)]">
      {/* Editor */}
      <div className="p-4 md:p-8 max-w-2xl animate-slide-up" role="form" aria-label="Post editor">
        <div className="mb-4 md:mb-6">
          <div className="flex items-center gap-3 mb-1 md:mb-2">
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
              {isNew ? 'Create Post' : 'Edit Post'}
            </h1>
            <AutoSaveIndicator status={autoSaveStatus} />
          </div>
          <p className="text-sm md:text-base text-muted-foreground">
            Compose your message and schedule it across multiple platforms.
          </p>
          <div className="h-1 w-16 gradient-bar mt-2 rounded-full" />
        </div>

        <PlatformSelector
          activePlatform={post.platform}
          onSelect={setPlatform}
          className="mb-4 md:mb-6"
        />

        <CampaignSelector
          campaignId={post.campaignId}
          campaigns={campaigns}
          showDropdown={showCampaignDropdown}
          onToggleDropdown={() => setShowCampaignDropdown(!showCampaignDropdown)}
          onSelect={(campaignId) => setPost((prev) => ({ ...prev, campaignId }))}
          className="mb-4 md:mb-6"
        />

        <NotesSection
          notes={post.notes || ''}
          showNotes={showNotes}
          onToggle={() => setShowNotes(!showNotes)}
          onChange={(notes) => setPost((prev) => ({ ...prev, notes }))}
          className="mb-4 md:mb-6"
        />

        <ContentEditor
          content={content}
          onContentChange={setContent}
          platform={post.platform}
          copied={copied}
          onCopy={handleCopy}
          showMediaInput={showMediaInput}
          onToggleMedia={() => setShowMediaInput(!showMediaInput)}
          mediaCount={mediaUrls.length + (linkedInMediaUrl ? 1 : 0)}
          className="mb-4 md:mb-6"
        />

        <MediaSection
          platform={post.platform}
          showMediaInput={showMediaInput}
          onClose={() => setShowMediaInput(false)}
          mediaUrls={mediaUrls}
          onMediaUrlsChange={setMediaUrls}
          linkedInMediaUrl={linkedInMediaUrl}
          onLinkedInMediaUrlChange={setLinkedInMediaUrl}
        />

        <LinkedInSettings post={post} onPostChange={setPost} />

        <RedditSettings
          post={post}
          onPostChange={setPost}
          redditUrl={redditUrl}
          onRedditUrlChange={setRedditUrl}
          newSubreddit={newSubreddit}
          onNewSubredditChange={setNewSubreddit}
          subredditsInput={subredditsInput}
          onSubredditsInputChange={setSubredditsInput}
          subredditTitles={subredditTitles}
          onUpdateSubredditTitle={updateSubredditTitle}
          subredditSchedules={subredditSchedules}
          onUpdateSubredditSchedule={updateSubredditSchedule}
          expandedSubreddits={expandedSubreddits}
          onToggleSubredditExpanded={toggleSubredditExpanded}
          onRemoveSubreddit={removeSubreddit}
        />

        <PublishedLinks
          post={post}
          onPostChange={setPost}
          showPublishedLinks={showPublishedLinks}
          onToggle={() => setShowPublishedLinks(!showPublishedLinks)}
          subredditsInput={subredditsInput}
          className="mb-4 md:mb-6"
        />

        <SchedulePicker
          scheduledAt={post.scheduledAt}
          onScheduleChange={(isoString) => setPost((prev) => ({ ...prev, scheduledAt: isoString }))}
          className="mb-4 md:mb-6"
        />

        <RecurrencePicker
          value={post.recurrenceRule ?? null}
          onChange={(rule) => setPost((prev) => ({ ...prev, recurrenceRule: rule }))}
          scheduledAt={post.scheduledAt}
          className="mb-4 md:mb-6"
        />

        {platformAccounts.length > 1 && (
          <AccountSelector
            accounts={platformAccounts}
            selectedAccountId={post.socialAccountId}
            onSelect={handleAccountSelect}
            platform={PLATFORM_INFO[post.platform].name}
          />
        )}

        {mediaUrls.length > 0 && (
          <div className="flex items-center gap-2 p-3 rounded-md bg-sticker-orange/10 text-sticker-orange text-sm border-2 border-sticker-orange/30">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span className="font-medium">
              Media attachments are not yet supported for publishing. Your text will be published
              without images/videos.
            </span>
          </div>
        )}

        <EditorActions
          isNew={isNew}
          isSaving={isSaving}
          canSchedule={canSchedule}
          postStatus={post.status}
          onSaveDraft={handleSaveDraft}
          onSchedule={handleSchedule}
          onPublishNow={handlePublishNow}
          isPublishing={isPublishing}
          hasConnectedAccount={hasConnectedAccount}
          platformName={PLATFORM_INFO[post.platform].name}
          onMarkAsPosted={handleMarkAsPosted}
          onArchive={handleArchive}
          onRestore={handleRestore}
          onDelete={handleDelete}
        />
      </div>

      <PreviewPanel
        post={post}
        content={content}
        mediaUrls={mediaUrls}
        linkedInMediaUrl={linkedInMediaUrl}
        redditUrl={redditUrl}
        subredditsInput={subredditsInput}
      />

      {/* Delete confirmation dialog */}
      <ConfirmDialog
        open={showDeleteConfirm}
        onConfirm={confirmDelete}
        onCancel={() => setShowDeleteConfirm(false)}
        title="Delete this post?"
        description="This action cannot be undone. The post will be permanently removed."
        confirmText="Delete"
        cancelText="Keep"
        variant="danger"
      />

      {/* Archive confirmation dialog */}
      <ConfirmDialog
        open={showArchiveConfirm}
        onConfirm={confirmArchive}
        onCancel={() => setShowArchiveConfirm(false)}
        title="Archive this post?"
        description="The post will be moved to your archive. You can restore it later or delete it permanently."
        confirmText="Archive"
        cancelText="Cancel"
      />

      {/* Platform switch confirmation dialog */}
      <ConfirmDialog
        open={showPlatformSwitchConfirm}
        onConfirm={confirmPlatformSwitch}
        onCancel={() => {
          setShowPlatformSwitchConfirm(false)
          setPendingPlatform(null)
        }}
        title="Switch platform?"
        description="Switching platforms will reset some content. Your text will be preserved, but platform-specific settings will be cleared."
        confirmText="Switch"
        cancelText="Cancel"
      />

      {/* Leave without saving confirmation dialog */}
      <ConfirmDialog
        open={showLeaveConfirm}
        onConfirm={() => {
          setIsDirty(false)
          router.push('/')
        }}
        onCancel={() => setShowLeaveConfirm(false)}
        title="Leave without saving?"
        description="You have unsaved changes that will be lost."
        confirmText="Leave"
        cancelText="Stay"
        variant="danger"
      />
    </div>
  )
}
