'use client'

import { Calendar, Send, Save, Trash2, CheckCircle, Archive, RotateCcw } from 'lucide-react'
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
}

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
}: EditorActionsProps) => {
  return (
    <div className="flex gap-2 md:gap-3 pt-4 md:pt-6 border-t border-border overflow-x-auto pb-2 -mb-2 md:overflow-visible md:flex-wrap">
      {/* Archive button for non-archived posts */}
      {!isNew && postStatus !== 'archived' && onArchive && (
        <button
          onClick={onArchive}
          disabled={isSaving}
          className={cn(
            'flex items-center gap-2 px-3 md:px-4 py-2.5 rounded-lg min-h-[44px]',
            'text-muted-foreground hover:bg-accent',
            'font-medium text-sm',
            'transition-colors',
            'disabled:opacity-50',
            'flex-shrink-0'
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
              disabled={isSaving}
              className={cn(
                'flex items-center gap-2 px-3 md:px-4 py-2.5 rounded-lg min-h-[44px]',
                'bg-primary/10 text-primary',
                'font-medium text-sm',
                'hover:bg-primary/20 transition-colors',
                'disabled:opacity-50',
                'flex-shrink-0'
              )}
            >
              <RotateCcw className="w-4 h-4" />
              <span className="hidden sm:inline">Restore</span>
            </button>
          )}
          {onDelete && (
            <button
              onClick={onDelete}
              disabled={isSaving}
              className={cn(
                'flex items-center gap-2 px-3 md:px-4 py-2.5 rounded-lg min-h-[44px]',
                'text-destructive hover:bg-destructive/10',
                'font-medium text-sm',
                'transition-colors',
                'disabled:opacity-50',
                'flex-shrink-0'
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
        disabled={isSaving}
        title="Save Draft (Ctrl+S)"
        className={cn(
          'flex items-center gap-2 px-3 md:px-4 py-2.5 rounded-md min-h-[44px]',
          'bg-secondary text-secondary-foreground',
          'font-bold text-sm',
          'border-[3px] border-border',
          'shadow-[3px_3px_0_hsl(var(--border))]',
          'hover:translate-y-[-1px] hover:shadow-[4px_4px_0_hsl(var(--border))]',
          'active:translate-y-[1px] active:shadow-[2px_2px_0_hsl(var(--border))]',
          'disabled:opacity-50 disabled:hover:translate-y-0',
          'transition-all',
          'flex-shrink-0',
          !isNew && 'sm:ml-auto'
        )}
      >
        <Save className="w-4 h-4" />
        <span className="hidden sm:inline">Save Draft</span>
        <span className="sm:hidden">Draft</span>
      </button>

      <button
        onClick={onSchedule}
        disabled={isSaving || !canSchedule}
        title={canSchedule ? 'Schedule Post (Ctrl+Enter)' : 'Select a date and time to schedule'}
        className={cn(
          'flex items-center gap-2 px-3 md:px-4 py-2.5 rounded-md min-h-[44px]',
          'bg-sticker-blue text-white',
          'font-bold text-sm',
          'border-[3px] border-border',
          'shadow-[3px_3px_0_hsl(var(--border))]',
          'hover:translate-y-[-1px] hover:shadow-[4px_4px_0_hsl(var(--border))]',
          'active:translate-y-[1px] active:shadow-[2px_2px_0_hsl(var(--border))]',
          'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0',
          'transition-all',
          'flex-shrink-0'
        )}
      >
        <Calendar className="w-4 h-4" />
        Schedule
      </button>

      <button
        onClick={onPublishNow}
        disabled={isSaving}
        className={cn(
          'flex items-center gap-2 px-3 md:px-4 py-2.5 rounded-lg min-h-[44px]',
          'text-muted-foreground',
          'font-medium text-sm',
          'hover:bg-accent hover:text-foreground transition-colors',
          'disabled:opacity-50',
          'flex-shrink-0',
          isNew && 'sm:ml-auto'
        )}
      >
        <Send className="w-4 h-4" />
        <span className="hidden sm:inline">Publish Now</span>
        <span className="sm:hidden">Publish</span>
      </button>

      {!isNew && postStatus !== 'published' && onMarkAsPosted && (
        <button
          onClick={onMarkAsPosted}
          disabled={isSaving}
          className={cn(
            'flex items-center gap-2 px-3 md:px-4 py-2.5 rounded-lg min-h-[44px]',
            'bg-green-500/10 text-green-600 dark:text-green-400',
            'font-medium text-sm',
            'hover:bg-green-500/20 transition-colors',
            'disabled:opacity-50',
            'flex-shrink-0'
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
