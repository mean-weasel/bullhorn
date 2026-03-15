'use client'

import Link from 'next/link'
import {
  Calendar,
  Send,
  Save,
  Trash2,
  CheckCircle,
  Archive,
  RotateCcw,
  Loader2,
  Link as LinkIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface EditorActionsProps {
  isNew: boolean
  isSaving: boolean
  canSchedule: boolean
  postStatus: string
  onSaveDraft: () => void
  onSchedule: () => void
  onPublishNow: () => void
  onMarkAsPosted?: () => void
  onArchive?: () => void
  onRestore?: () => void
  onDelete?: () => void
  isPublishing?: boolean
  hasConnectedAccount?: boolean
  platformName?: string
  isOverLimit?: boolean
}

// eslint-disable-next-line max-lines-per-function -- component JSX rendering, extraction would fragment UI
function PublishButton({
  postStatus,
  isPublishing,
  isSaving,
  hasConnectedAccount,
  platformName,
  onPublishNow,
  isNew,
  isOverLimit,
}: Pick<
  EditorActionsProps,
  | 'postStatus'
  | 'isPublishing'
  | 'isSaving'
  | 'hasConnectedAccount'
  | 'platformName'
  | 'onPublishNow'
  | 'isNew'
  | 'isOverLimit'
>) {
  // Published state: show green indicator
  if (postStatus === 'published') {
    return (
      <div
        className={cn(
          'flex items-center gap-2 px-3 md:px-4 py-2.5',
          'rounded-md min-h-[44px]',
          'text-green-600 dark:text-green-400 font-bold text-sm',
          'shrink-0'
        )}
      >
        <CheckCircle className="w-4 h-4" />
        <span className="hidden sm:inline">Published</span>
        <span className="sm:hidden">Published</span>
      </div>
    )
  }

  // Not connected: show link to settings
  if (hasConnectedAccount === false) {
    return (
      <Link
        href="/settings"
        className={cn(
          'flex items-center gap-2 px-3 md:px-4 py-2.5',
          'rounded-md min-h-[44px]',
          'text-muted-foreground font-medium text-sm',
          'border-2 border-dashed border-border',
          'hover:border-primary/50 hover:text-foreground',
          'transition-all shrink-0',
          isNew && 'sm:ml-auto'
        )}
      >
        <LinkIcon className="w-4 h-4" />
        <span className="hidden sm:inline">Connect {platformName || 'account'} to publish</span>
        <span className="sm:hidden">Connect</span>
      </Link>
    )
  }

  // Connected: show prominent publish button
  return (
    <button
      onClick={onPublishNow}
      disabled={isSaving || isPublishing || isOverLimit}
      className={cn(
        'flex items-center gap-2 px-3 md:px-4 py-2.5',
        'rounded-md min-h-[44px]',
        'bg-linear-to-r from-[hsl(var(--gold))]',
        'to-[hsl(var(--gold-dark))]',
        'text-white font-bold text-sm',
        'border-[3px] border-border',
        'shadow-sticker-sm',
        'hover:-translate-y-px',
        'hover:shadow-sticker',
        'active:translate-y-px',
        'active:shadow-sticker-hover',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        'disabled:hover:translate-y-0',
        'transition-all shrink-0',
        isNew && 'sm:ml-auto'
      )}
    >
      {isPublishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
      {isPublishing ? 'Publishing...' : 'Publish Now'}
    </button>
  )
}

// eslint-disable-next-line max-lines-per-function
export const EditorActions = ({
  isNew,
  isSaving,
  canSchedule,
  postStatus,
  onSaveDraft,
  onSchedule,
  onPublishNow,
  onMarkAsPosted,
  onArchive,
  onRestore,
  onDelete,
  isPublishing = false,
  hasConnectedAccount,
  platformName,
  isOverLimit,
}: EditorActionsProps) => {
  return (
    <div
      className={cn(
        'flex gap-2 md:gap-3 pt-4 md:pt-6 border-t border-border',
        'overflow-x-auto pb-2 -mb-2 md:overflow-visible md:flex-wrap'
      )}
    >
      {/* Archive button for non-archived posts */}
      {!isNew && postStatus !== 'archived' && onArchive && (
        <button
          onClick={onArchive}
          disabled={isSaving || isPublishing}
          className={cn(
            'flex items-center gap-2 px-3 md:px-4 py-2.5',
            'rounded-lg min-h-[44px]',
            'text-muted-foreground hover:bg-accent',
            'font-medium text-sm transition-colors',
            'disabled:opacity-50 shrink-0'
          )}
        >
          <Archive className="w-4 h-4" />
          <span className="hidden sm:inline">Archive</span>
        </button>
      )}

      {/* Restore and Delete buttons for archived posts */}
      {!isNew && postStatus === 'archived' && (
        <>
          {onRestore && (
            <button
              onClick={onRestore}
              disabled={isSaving || isPublishing}
              className={cn(
                'flex items-center gap-2 px-3 md:px-4 py-2.5',
                'rounded-lg min-h-[44px]',
                'bg-primary/10 text-primary',
                'font-medium text-sm',
                'hover:bg-primary/20 transition-colors',
                'disabled:opacity-50 shrink-0'
              )}
            >
              <RotateCcw className="w-4 h-4" />
              <span className="hidden sm:inline">Restore</span>
            </button>
          )}
          {onDelete && (
            <button
              onClick={onDelete}
              disabled={isSaving || isPublishing}
              className={cn(
                'flex items-center gap-2 px-3 md:px-4 py-2.5',
                'rounded-lg min-h-[44px]',
                'text-destructive hover:bg-destructive/10',
                'font-medium text-sm transition-colors',
                'disabled:opacity-50 shrink-0'
              )}
            >
              <Trash2 className="w-4 h-4" />
              <span className="hidden sm:inline">Delete</span>
            </button>
          )}
        </>
      )}

      <button
        onClick={onSaveDraft}
        disabled={isSaving || isPublishing}
        title="Save Draft (Ctrl+S)"
        className={cn(
          'flex items-center gap-2 px-3 md:px-4 py-2.5',
          'rounded-md min-h-[44px]',
          'bg-secondary text-secondary-foreground',
          'font-bold text-sm',
          'border-[3px] border-border',
          'shadow-sticker-sm',
          'hover:-translate-y-px',
          'hover:shadow-sticker',
          'active:translate-y-px',
          'active:shadow-sticker-hover',
          'disabled:opacity-50 disabled:hover:translate-y-0',
          'transition-all shrink-0',
          !isNew && 'sm:ml-auto'
        )}
      >
        <Save className="w-4 h-4" />
        <span className="hidden sm:inline">Save Draft</span>
        <span className="sm:hidden">Draft</span>
      </button>

      <button
        onClick={onSchedule}
        disabled={isSaving || isPublishing || !canSchedule || isOverLimit}
        title={canSchedule ? 'Schedule Post (Ctrl+Enter)' : 'Select a date and time to schedule'}
        className={cn(
          'flex items-center gap-2 px-3 md:px-4 py-2.5',
          'rounded-md min-h-[44px]',
          'bg-sticker-blue text-white',
          'font-bold text-sm',
          'border-[3px] border-border',
          'shadow-sticker-sm',
          'hover:-translate-y-px',
          'hover:shadow-sticker',
          'active:translate-y-px',
          'active:shadow-sticker-hover',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          'disabled:hover:translate-y-0',
          'transition-all shrink-0'
        )}
      >
        <Calendar className="w-4 h-4" />
        Schedule
      </button>

      <PublishButton
        postStatus={postStatus}
        isPublishing={isPublishing}
        isSaving={isSaving}
        hasConnectedAccount={hasConnectedAccount}
        platformName={platformName}
        onPublishNow={onPublishNow}
        isNew={isNew}
        isOverLimit={isOverLimit}
      />

      {!isNew && postStatus !== 'published' && onMarkAsPosted && (
        <button
          onClick={onMarkAsPosted}
          disabled={isSaving || isPublishing}
          className={cn(
            'flex items-center gap-2 px-3 md:px-4 py-2.5',
            'rounded-lg min-h-[44px]',
            'bg-green-500/10 text-green-600 dark:text-green-400',
            'font-medium text-sm',
            'hover:bg-green-500/20 transition-colors',
            'disabled:opacity-50 shrink-0'
          )}
        >
          <CheckCircle className="w-4 h-4" />
          <span className="hidden sm:inline">Mark as Posted</span>
          <span className="sm:hidden">Posted</span>
        </button>
      )}
    </div>
  )
}
