'use client'
/* eslint-disable max-lines -- large page component with extracted sub-components */

import { useState, useEffect } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import toast from 'react-hot-toast'
import { usePostsStore } from '@/lib/storage'
import { useAutoSave } from '@/hooks/useAutoSave'
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { useLocalDraft } from '@/hooks/useLocalDraft'
import { ResourceNotFound } from '@/components/ui/ResourceNotFound'
import {
  PostDraftData,
  useEditorFormState,
  useSubredditManagement,
  useDirtyTracking,
  useLoadExistingPost,
  usePlatformContentSync,
} from '@/hooks/useEditorState'
import {
  useEditorSave,
  useEditorActions,
  usePublishNow,
  useCopyContent,
  usePlatformSwitch,
  usePostLifecycle,
} from '@/hooks/useEditorHandlers'
import { PreviewPanel, EditorConfirmDialogs, EditorFormPanel } from '@/components/editor'

// eslint-disable-next-line max-lines-per-function
export default function EditorPage() {
  const params = useParams()
  const id = params.id as string | undefined
  const searchParams = useSearchParams()
  const router = useRouter()

  const state = useEditorFormState({
    id,
    dateParam: searchParams.get('date'),
    campaignParam: searchParams.get('campaign'),
  })

  const { draft, hasDraft, saveDraft, clearDraft } = useLocalDraft<PostDraftData>(`edit-${id}`)
  const [showCampaignDropdown, setShowCampaignDropdown] = useState(false)
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false)

  const subredditMgmt = useSubredditManagement(
    state.setSubredditsInput,
    state.setSubredditTitles,
    state.setSubredditSchedules,
    state.setExpandedSubreddits
  )

  const dirtyTracking = useDirtyTracking({
    content: state.content,
    mediaUrls: state.mediaUrls,
    linkedInMediaUrl: state.linkedInMediaUrl,
    redditUrl: state.redditUrl,
    platform: state.post.platform,
    notes: state.post.notes,
  })

  useUnsavedChanges({ isDirty: dirtyTracking.isDirty })

  useLoadExistingPost(state.existingPost, {
    setPost: state.setPost,
    setContent: state.setContent,
    setMediaUrls: state.setMediaUrls,
    setLinkedInMediaUrl: state.setLinkedInMediaUrl,
    setRedditUrl: state.setRedditUrl,
    setSubredditsInput: state.setSubredditsInput,
    setSubredditTitles: state.setSubredditTitles,
    setSubredditSchedules: state.setSubredditSchedules,
    setExpandedSubreddits: state.setExpandedSubreddits,
    setShowNotes: state.setShowNotes,
    setShowPublishedLinks: state.setShowPublishedLinks,
    initialContentRef: dirtyTracking.initialContentRef,
  })

  usePlatformContentSync(
    state.content,
    state.mediaUrls,
    state.linkedInMediaUrl,
    state.redditUrl,
    state.setPost
  )

  const platformAccounts = state
    .getAccountsByProvider(state.post.platform)
    .filter((a) => a.status === 'active')

  useEffect(() => {
    if (platformAccounts.length === 1 && !state.post.socialAccountId) {
      state.setPost((prev) => ({ ...prev, socialAccountId: platformAccounts[0].id }))
    }
  }, [platformAccounts, state.post.socialAccountId]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleAccountSelect = (accountId: string) => {
    state.setPost((prev) => ({ ...prev, socialAccountId: accountId }))
  }

  const saveCtx = useEditorSave({
    isNew: state.isNew,
    subredditsInput: state.subredditsInput,
    subredditSchedules: state.subredditSchedules,
    subredditTitles: state.subredditTitles,
    clearDraft,
  })

  const actions = useEditorActions(
    state.post,
    state.content,
    saveCtx.handleSave,
    state.subredditsInput,
    state.subredditSchedules
  )

  const activeAccount = state.getActiveAccount(state.post.platform)
  const hasConnectedAccount = !!activeAccount

  const publishNow = usePublishNow(
    state.post,
    state.content,
    state.isNew,
    hasConnectedAccount,
    state.subredditsInput,
    actions.isOverLimit
  )

  const { copied, handleCopy } = useCopyContent(state.content)

  const platformSwitch = usePlatformSwitch(
    state.post,
    state.content,
    state.mediaUrls,
    state.linkedInMediaUrl,
    state.redditUrl,
    state.subredditsInput,
    state.setPost,
    state.setSubredditsInput,
    state.setSubredditTitles,
    state.setSubredditSchedules,
    state.setExpandedSubreddits
  )

  const lifecycle = usePostLifecycle(id)

  const { status: autoSaveStatus, retry: autoSaveRetry } = useAutoSave({
    data: {
      post: state.post,
      content: state.content,
      mediaUrls: state.mediaUrls,
      linkedInMediaUrl: state.linkedInMediaUrl,
      redditUrl: state.redditUrl,
    },
    onSave: async () => {
      if (saveCtx.isSaving) return
      const toSave = { ...state.post, status: 'draft' as const }
      try {
        if (state.isNew) {
          const created = await usePostsStore.getState().addPost(toSave)
          router.replace(`/edit/${created.id}`)
        } else {
          await usePostsStore.getState().updatePost(toSave.id, toSave)
        }
        dirtyTracking.setIsDirty(false)
        clearDraft()
      } catch (error) {
        const msg = (error as Error).message || ''
        if (msg.includes('401') || msg.includes('Unauthorized')) {
          toast.error('Session expired. Your changes are saved locally.')
        }
        console.error('Auto-save failed:', error)
      }
    },
    delay: 2000,
    enabled:
      (state.post.status === 'draft' || state.isNew) &&
      !(state.isNew && actions.hasMultipleSubreddits),
    skipInitialChange: !state.isNew,
  })

  const restoreFromDraft = (d: PostDraftData) => {
    state.setContent(d.content)
    state.setPost((prev) => ({
      ...prev,
      platform: d.platform as typeof prev.platform,
      notes: d.notes,
      campaignId: d.campaignId,
      scheduledAt: d.scheduledAt ?? null,
    }))
    state.setMediaUrls(d.mediaUrls)
    state.setLinkedInMediaUrl(d.linkedInMediaUrl)
    state.setRedditUrl(d.redditUrl)
    state.setSubredditsInput(d.subredditsInput)
    state.setSubredditTitles(d.subredditTitles)
    state.setSubredditSchedules(d.subredditSchedules)
    if (d.notes) state.setShowNotes(true)
  }

  useEffect(() => {
    if (hasDraft && draft && state.existingPost) {
      toast(
        (t) => (
          <span className="flex items-center gap-2">
            You have unsaved local changes.
            <button
              className="font-bold underline"
              onClick={() => {
                restoreFromDraft(draft)
                toast.dismiss(t.id)
              }}
            >
              Restore
            </button>
            <button
              className="text-muted-foreground"
              onClick={() => {
                clearDraft()
                toast.dismiss(t.id)
              }}
            >
              Discard
            </button>
          </span>
        ),
        { duration: 10000 }
      )
    }
  }, [state.existingPost?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!dirtyTracking.isDirty || !id) return
    saveDraft({
      content: state.content,
      platform: state.post.platform,
      notes: state.post.notes || '',
      mediaUrls: state.mediaUrls,
      linkedInMediaUrl: state.linkedInMediaUrl,
      redditUrl: state.redditUrl,
      subredditsInput: state.subredditsInput,
      subredditTitles: state.subredditTitles,
      subredditSchedules: state.subredditSchedules,
      campaignId: state.post.campaignId,
      scheduledAt: state.post.scheduledAt ?? undefined,
    })
  }, [
    dirtyTracking.isDirty,
    state.content,
    state.post.platform,
    state.post.notes,
    state.mediaUrls,
    state.linkedInMediaUrl,
    state.redditUrl,
    state.subredditsInput,
    state.subredditTitles,
    state.subredditSchedules,
  ])  

  useKeyboardShortcuts({
    shortcuts: [
      { key: 's', ctrl: true, handler: actions.handleSaveDraft },
      { key: 'Enter', ctrl: true, handler: actions.handleSchedule },
      {
        key: 'Escape',
        handler: () => {
          if (dirtyTracking.isDirty) setShowLeaveConfirm(true)
          else router.push('/')
        },
      },
    ],
  })

  if (state.postsInitialized && id && !state.existingPost) {
    return <ResourceNotFound type="Post" listUrl="/posts" listLabel="Posts" />
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] min-h-[calc(100vh-4rem)]">
      <EditorFormPanel
        isNew={state.isNew}
        post={state.post}
        setPost={state.setPost}
        content={state.content}
        setContent={state.setContent}
        autoSaveStatus={autoSaveStatus}
        autoSaveRetry={autoSaveRetry}
        setPlatform={platformSwitch.setPlatform}
        campaigns={state.campaigns}
        showCampaignDropdown={showCampaignDropdown}
        setShowCampaignDropdown={setShowCampaignDropdown}
        showNotes={state.showNotes}
        setShowNotes={state.setShowNotes}
        copied={copied}
        onCopy={handleCopy}
        showMediaInput={state.showMediaInput}
        setShowMediaInput={state.setShowMediaInput}
        mediaUrls={state.mediaUrls}
        setMediaUrls={state.setMediaUrls}
        linkedInMediaUrl={state.linkedInMediaUrl}
        setLinkedInMediaUrl={state.setLinkedInMediaUrl}
        redditUrl={state.redditUrl}
        setRedditUrl={state.setRedditUrl}
        newSubreddit={state.newSubreddit}
        setNewSubreddit={state.setNewSubreddit}
        subredditsInput={state.subredditsInput}
        setSubredditsInput={state.setSubredditsInput}
        subredditTitles={state.subredditTitles}
        updateSubredditTitle={subredditMgmt.updateSubredditTitle}
        subredditSchedules={state.subredditSchedules}
        updateSubredditSchedule={subredditMgmt.updateSubredditSchedule}
        expandedSubreddits={state.expandedSubreddits}
        toggleSubredditExpanded={subredditMgmt.toggleSubredditExpanded}
        removeSubreddit={subredditMgmt.removeSubreddit}
        showPublishedLinks={state.showPublishedLinks}
        setShowPublishedLinks={state.setShowPublishedLinks}
        platformAccounts={platformAccounts}
        handleAccountSelect={handleAccountSelect}
        isSaving={saveCtx.isSaving}
        canSchedule={actions.canSchedule}
        onSaveDraft={actions.handleSaveDraft}
        onSchedule={actions.handleSchedule}
        onPublishNow={() => publishNow.handlePublishNow(clearDraft)}
        isPublishing={publishNow.isPublishing}
        hasConnectedAccount={hasConnectedAccount}
        onMarkAsPosted={actions.handleMarkAsPosted}
        onArchive={lifecycle.handleArchive}
        onRestore={lifecycle.handleRestore}
        onDelete={lifecycle.handleDelete}
        isOverLimit={actions.isOverLimit}
      />
      <PreviewPanel
        post={state.post}
        content={state.content}
        mediaUrls={state.mediaUrls}
        linkedInMediaUrl={state.linkedInMediaUrl}
        redditUrl={state.redditUrl}
        subredditsInput={state.subredditsInput}
      />
      <EditorConfirmDialogs
        showDeleteConfirm={lifecycle.showDeleteConfirm}
        onConfirmDelete={lifecycle.confirmDelete}
        onCancelDelete={() => lifecycle.setShowDeleteConfirm(false)}
        showArchiveConfirm={lifecycle.showArchiveConfirm}
        onConfirmArchive={lifecycle.confirmArchive}
        onCancelArchive={() => lifecycle.setShowArchiveConfirm(false)}
        showPlatformSwitchConfirm={platformSwitch.showPlatformSwitchConfirm}
        onConfirmPlatformSwitch={platformSwitch.confirmPlatformSwitch}
        onCancelPlatformSwitch={() => {
          platformSwitch.setShowPlatformSwitchConfirm(false)
          platformSwitch.setPendingPlatform(null)
        }}
        showLeaveConfirm={showLeaveConfirm}
        onConfirmLeave={() => {
          dirtyTracking.setIsDirty(false)
          router.push('/')
        }}
        onCancelLeave={() => setShowLeaveConfirm(false)}
      />
    </div>
  )
}
