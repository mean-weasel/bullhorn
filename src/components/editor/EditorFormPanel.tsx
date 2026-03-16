'use client'

import { Post, Platform, PLATFORM_INFO } from '@/lib/posts'
import { Campaign } from '@/lib/posts'
import { SocialAccount } from '@/lib/socialAccounts'

type AutoSaveStatus = 'idle' | 'saving' | 'saved' | 'error' | 'retrying'
import { AlertCircle } from 'lucide-react'
import { AutoSaveIndicator } from '@/components/ui/AutoSaveIndicator'
import { AutoPublishIndicator } from '@/components/editor/AutoPublishIndicator'
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
  PostActions,
} from '@/components/editor'
import RecurrencePicker from '@/components/editor/RecurrencePicker'

interface EditorFormPanelProps {
  isNew: boolean
  post: Post
  setPost: React.Dispatch<React.SetStateAction<Post>>
  content: string
  setContent: (c: string) => void
  autoSaveStatus: AutoSaveStatus
  autoSaveRetry: () => void
  setPlatform: (p: Platform) => void
  campaigns: Campaign[]
  showCampaignDropdown: boolean
  setShowCampaignDropdown: (v: boolean) => void
  showNotes: boolean
  setShowNotes: (v: boolean) => void
  copied: boolean
  onCopy: () => void
  showMediaInput: boolean
  setShowMediaInput: (v: boolean) => void
  mediaUrls: string[]
  setMediaUrls: (urls: string[]) => void
  linkedInMediaUrl: string
  setLinkedInMediaUrl: (url: string) => void
  redditUrl: string
  setRedditUrl: (url: string) => void
  newSubreddit: string
  setNewSubreddit: (v: string) => void
  subredditsInput: string[]
  setSubredditsInput: React.Dispatch<React.SetStateAction<string[]>>
  subredditTitles: Record<string, string>
  updateSubredditTitle: (sub: string, title: string) => void
  subredditSchedules: Record<string, string>
  updateSubredditSchedule: (sub: string, iso: string | null) => void
  expandedSubreddits: Record<string, boolean>
  toggleSubredditExpanded: (sub: string) => void
  removeSubreddit: (sub: string) => void
  showPublishedLinks: boolean
  setShowPublishedLinks: (v: boolean) => void
  platformAccounts: SocialAccount[]
  handleAccountSelect: (id: string) => void
  isSaving: boolean
  canSchedule: boolean
  onSaveDraft: () => void
  onSchedule: () => void
  onPublishNow: () => void
  isPublishing: boolean
  hasConnectedAccount: boolean
  onMarkAsPosted: () => void
  onArchive: () => void
  onRestore: () => void
  onDelete: () => void
  isOverLimit: boolean
}

function EditorHeader({
  isNew,
  autoSaveStatus,
  autoSaveRetry,
}: {
  isNew: boolean
  autoSaveStatus: AutoSaveStatus
  autoSaveRetry: () => void
}) {
  return (
    <div className="mb-4 md:mb-6">
      <div className="flex items-center gap-3 mb-1 md:mb-2">
        <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
          {isNew ? 'Create Post' : 'Edit Post'}
        </h1>
        <AutoSaveIndicator status={autoSaveStatus} retry={autoSaveRetry} />
      </div>
      <p className="text-sm md:text-base text-muted-foreground">
        Compose your message and schedule it across multiple platforms.
      </p>
      <div className="h-1 w-16 gradient-bar mt-2 rounded-full" />
    </div>
  )
}

function MediaWarning({ platform }: { platform: string }) {
  if (platform === 'reddit') {
    return (
      <div className="flex items-center gap-2 p-3 rounded-md bg-sticker-orange/10 text-sticker-orange text-sm border-2 border-sticker-orange/30 mb-4 md:mb-6">
        <AlertCircle className="w-4 h-4 shrink-0" />
        <span className="font-medium">
          Media attachments are not yet supported for Reddit publishing.
        </span>
      </div>
    )
  }
  return null
}

// eslint-disable-next-line max-lines-per-function
export function EditorFormPanel(props: EditorFormPanelProps) {
  return (
    <div className="p-4 md:p-8 max-w-2xl animate-slide-up" role="form" aria-label="Post editor">
      <EditorHeader
        isNew={props.isNew}
        autoSaveStatus={props.autoSaveStatus}
        autoSaveRetry={props.autoSaveRetry}
      />
      <PlatformSelector
        activePlatform={props.post.platform}
        onSelect={props.setPlatform}
        className="mb-4 md:mb-6"
      />
      <CampaignSelector
        campaignId={props.post.campaignId}
        campaigns={props.campaigns}
        showDropdown={props.showCampaignDropdown}
        onToggleDropdown={() => props.setShowCampaignDropdown(!props.showCampaignDropdown)}
        onSelect={(id) => props.setPost((prev) => ({ ...prev, campaignId: id }))}
        className="mb-4 md:mb-6"
      />
      <NotesSection
        notes={props.post.notes || ''}
        showNotes={props.showNotes}
        onToggle={() => props.setShowNotes(!props.showNotes)}
        onChange={(notes) => props.setPost((prev) => ({ ...prev, notes }))}
        className="mb-4 md:mb-6"
      />
      <ContentEditor
        content={props.content}
        onContentChange={props.setContent}
        platform={props.post.platform}
        copied={props.copied}
        onCopy={props.onCopy}
        showMediaInput={props.showMediaInput}
        onToggleMedia={() => props.setShowMediaInput(!props.showMediaInput)}
        mediaCount={props.mediaUrls.length + (props.linkedInMediaUrl ? 1 : 0)}
        className="mb-4 md:mb-6"
      />
      <MediaSection
        platform={props.post.platform}
        showMediaInput={props.showMediaInput}
        onClose={() => props.setShowMediaInput(false)}
        mediaUrls={props.mediaUrls}
        onMediaUrlsChange={props.setMediaUrls}
        linkedInMediaUrl={props.linkedInMediaUrl}
        onLinkedInMediaUrlChange={props.setLinkedInMediaUrl}
      />
      <LinkedInSettings post={props.post} onPostChange={props.setPost} />
      <RedditSettings
        post={props.post}
        onPostChange={props.setPost}
        redditUrl={props.redditUrl}
        onRedditUrlChange={props.setRedditUrl}
        newSubreddit={props.newSubreddit}
        onNewSubredditChange={props.setNewSubreddit}
        subredditsInput={props.subredditsInput}
        onSubredditsInputChange={props.setSubredditsInput}
        subredditTitles={props.subredditTitles}
        onUpdateSubredditTitle={props.updateSubredditTitle}
        subredditSchedules={props.subredditSchedules}
        onUpdateSubredditSchedule={props.updateSubredditSchedule}
        expandedSubreddits={props.expandedSubreddits}
        onToggleSubredditExpanded={props.toggleSubredditExpanded}
        onRemoveSubreddit={props.removeSubreddit}
      />
      <PublishedLinks
        post={props.post}
        onPostChange={props.setPost}
        showPublishedLinks={props.showPublishedLinks}
        onToggle={() => props.setShowPublishedLinks(!props.showPublishedLinks)}
        subredditsInput={props.subredditsInput}
        className="mb-4 md:mb-6"
      />
      {props.post.status === 'ready' && (
        <PostActions
          post={props.post}
          onMarkAsPublished={props.onMarkAsPosted}
          className="mb-4 md:mb-6"
        />
      )}
      <SchedulePicker
        scheduledAt={props.post.scheduledAt}
        onScheduleChange={(iso) => props.setPost((prev) => ({ ...prev, scheduledAt: iso }))}
        className="mb-4 md:mb-6"
      />
      <RecurrencePicker
        value={props.post.recurrenceRule ?? null}
        onChange={(rule) => props.setPost((prev) => ({ ...prev, recurrenceRule: rule }))}
        scheduledAt={props.post.scheduledAt}
        className="mb-4 md:mb-6"
      />
      {props.platformAccounts.length > 1 && (
        <AccountSelector
          accounts={props.platformAccounts}
          selectedAccountId={props.post.socialAccountId}
          onSelect={props.handleAccountSelect}
          platform={PLATFORM_INFO[props.post.platform].name}
        />
      )}
      <AutoPublishIndicator
        hasAccount={!!props.post.socialAccountId}
        hasSchedule={!!props.post.scheduledAt}
        platform={props.post.platform}
      />
      {props.mediaUrls.length > 0 && <MediaWarning platform={props.post.platform} />}
      <EditorActions
        isNew={props.isNew}
        isSaving={props.isSaving}
        canSchedule={props.canSchedule}
        postStatus={props.post.status}
        onSaveDraft={props.onSaveDraft}
        onSchedule={props.onSchedule}
        onPublishNow={props.onPublishNow}
        isPublishing={props.isPublishing}
        hasConnectedAccount={props.hasConnectedAccount}
        platformName={PLATFORM_INFO[props.post.platform].name}
        onMarkAsPosted={props.onMarkAsPosted}
        onArchive={props.onArchive}
        onRestore={props.onRestore}
        onDelete={props.onDelete}
        isOverLimit={props.isOverLimit}
      />
    </div>
  )
}
