'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { formatDistanceToNow, format } from 'date-fns'
import { Bell, Check, Trash2, Plus, FileText, FolderOpen } from 'lucide-react'
import { useRemindersStore, type Reminder } from '@/lib/reminders'
import { usePostsStore } from '@/lib/storage'
import { useCampaignsStore } from '@/lib/campaigns'
import { getPostPreviewText } from '@/lib/posts'
import { cn } from '@/lib/utils'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { AddReminderModal } from './AddReminderModal'
import { sendLocalNotification } from '@/lib/pushNotifications'

interface RemindersListProps {
  /** Maximum number of reminders to show (0 = show all) */
  limit?: number
  /** Whether to show the "Add Reminder" button */
  showAddButton?: boolean
  /** Whether to show completed reminders */
  showCompleted?: boolean
}

// eslint-disable-next-line max-lines-per-function
export function RemindersList({
  limit = 0,
  showAddButton = true,
  showCompleted = false,
}: RemindersListProps) {
  const { reminders, loading, initialized, fetchReminders, completeReminder, deleteReminder } =
    useRemindersStore()
  const posts = usePostsStore((s) => s.posts)
  const campaigns = useCampaignsStore((s) => s.campaigns)

  const [showAddModal, setShowAddModal] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  useEffect(() => {
    if (!initialized) {
      fetchReminders()
    }
  }, [initialized, fetchReminders])

  // Check for due reminders and fire browser notifications
  useEffect(() => {
    if (reminders.length === 0) return

    const checkDueReminders = () => {
      const now = new Date()
      reminders
        .filter((r) => !r.isCompleted && new Date(r.remindAt) <= now)
        .forEach((r) => {
          sendLocalNotification(
            'Reminder: ' + r.title,
            r.description || 'Your reminder is due!',
            '/dashboard'
          )
        })
    }

    // Check every 60 seconds
    const interval = setInterval(checkDueReminders, 60_000)
    // Also check immediately on mount
    checkDueReminders()

    return () => clearInterval(interval)
  }, [reminders])

  const displayedReminders = useMemo(() => {
    let filtered = reminders
    if (!showCompleted) {
      filtered = filtered.filter((r) => !r.isCompleted)
    }
    // Sort: overdue first, then by remind_at ascending
    filtered = [...filtered].sort(
      (a, b) => new Date(a.remindAt).getTime() - new Date(b.remindAt).getTime()
    )
    if (limit > 0) {
      filtered = filtered.slice(0, limit)
    }
    return filtered
  }, [reminders, showCompleted, limit])

  const getLinkedPostName = useCallback(
    (postId?: string) => {
      if (!postId) return null
      const post = posts.find((p) => p.id === postId)
      if (!post) return null
      const text = getPostPreviewText(post)
      return text ? text.slice(0, 40) + (text.length > 40 ? '...' : '') : 'Untitled post'
    },
    [posts]
  )

  const getLinkedCampaignName = useCallback(
    (campaignId?: string) => {
      if (!campaignId) return null
      const campaign = campaigns.find((c) => c.id === campaignId)
      return campaign?.name || null
    },
    [campaigns]
  )

  const handleComplete = async (id: string) => {
    try {
      await completeReminder(id)
    } catch {
      // Error is set in the store
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await deleteReminder(deleteTarget)
    } catch {
      // Error is set in the store
    } finally {
      setDeleteTarget(null)
    }
  }

  const isOverdue = (remindAt: string) => new Date(remindAt) <= new Date()

  if (loading && !initialized) {
    return (
      <div className="text-center py-8 text-sm text-muted-foreground font-medium">
        Loading reminders...
      </div>
    )
  }

  return (
    <>
      {displayedReminders.length === 0 ? (
        <div className="text-center py-8 px-4 rounded-md border-[3px] border-dashed border-border bg-card">
          <div className="w-14 h-14 mx-auto mb-3 rounded-md bg-sticker-pink/10 flex items-center justify-center border-2 border-sticker-pink/30">
            <Bell className="w-6 h-6 text-sticker-pink" />
          </div>
          <p className="text-sm font-bold mb-1">No upcoming reminders</p>
          <p className="text-xs text-muted-foreground mb-3">
            Set reminders on your posts and campaigns
          </p>
          {showAddButton && (
            <button
              onClick={() => setShowAddModal(true)}
              className={cn(
                'inline-flex items-center gap-2 px-4 py-2.5 rounded-md',
                'bg-sticker-pink/10 text-sticker-pink',
                'text-sm font-bold',
                'border-2 border-sticker-pink/30',
                'hover:bg-sticker-pink/20 transition-colors'
              )}
            >
              <Plus className="w-4 h-4" />
              Add Reminder
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {showAddButton && (
            <button
              onClick={() => setShowAddModal(true)}
              className={cn(
                'w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-md',
                'bg-sticker-pink/10 text-sticker-pink',
                'text-sm font-bold',
                'border-2 border-sticker-pink/30',
                'hover:bg-sticker-pink/20 transition-colors'
              )}
            >
              <Plus className="w-4 h-4" />
              Add Reminder
            </button>
          )}

          {displayedReminders.map((reminder) => (
            <ReminderCard
              key={reminder.id}
              reminder={reminder}
              isOverdue={isOverdue(reminder.remindAt)}
              linkedPostName={getLinkedPostName(reminder.postId)}
              linkedCampaignName={getLinkedCampaignName(reminder.campaignId)}
              onComplete={() => handleComplete(reminder.id)}
              onDelete={() => setDeleteTarget(reminder.id)}
            />
          ))}
        </div>
      )}

      <AddReminderModal open={showAddModal} onClose={() => setShowAddModal(false)} />

      <ConfirmDialog
        open={deleteTarget !== null}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        title="Delete Reminder"
        description="Are you sure you want to delete this reminder? This action cannot be undone."
        confirmText="Delete"
        variant="danger"
      />
    </>
  )
}

// ---------------------------------------------------------------------------
// ReminderCard subcomponent
// ---------------------------------------------------------------------------

// eslint-disable-next-line max-lines-per-function
function ReminderCard({
  reminder,
  isOverdue,
  linkedPostName,
  linkedCampaignName,
  onComplete,
  onDelete,
}: {
  reminder: Reminder
  isOverdue: boolean
  linkedPostName: string | null
  linkedCampaignName: string | null
  onComplete: () => void
  onDelete: () => void
}) {
  return (
    <div
      className={cn(
        'p-4 rounded-md bg-card',
        'border-[3px] border-border',
        'shadow-sticker',
        isOverdue && !reminder.isCompleted && 'border-destructive/50',
        reminder.isCompleted && 'opacity-60'
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          {/* Title */}
          <h3
            className={cn(
              'font-bold text-sm mb-1',
              reminder.isCompleted && 'line-through text-muted-foreground'
            )}
          >
            {reminder.title}
          </h3>

          {/* Description */}
          {reminder.description && (
            <p className="text-xs text-muted-foreground line-clamp-2 mb-2 font-medium">
              {reminder.description}
            </p>
          )}

          {/* Time info */}
          <div className="flex items-center gap-2 text-xs font-medium mb-2">
            <Bell className="w-3.5 h-3.5 shrink-0" />
            {isOverdue && !reminder.isCompleted ? (
              <span className="text-destructive font-bold">
                Overdue by {formatDistanceToNow(new Date(reminder.remindAt))}
              </span>
            ) : (
              <span className="text-muted-foreground">
                {format(new Date(reminder.remindAt), 'MMM d, h:mm a')} (
                {formatDistanceToNow(new Date(reminder.remindAt), {
                  addSuffix: true,
                })}
                )
              </span>
            )}
          </div>

          {/* Linked post/campaign */}
          <div className="flex items-center gap-3 flex-wrap">
            {linkedPostName && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-sticker-blue/10 text-sticker-blue border border-sticker-blue/30">
                <FileText className="w-3 h-3" />
                {linkedPostName}
              </span>
            )}
            {linkedCampaignName && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-sticker-orange/10 text-sticker-orange border border-sticker-orange/30">
                <FolderOpen className="w-3 h-3" />
                {linkedCampaignName}
              </span>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-col gap-1.5 shrink-0">
          {!reminder.isCompleted && (
            <button
              onClick={onComplete}
              title="Mark as complete"
              className={cn(
                'p-2 rounded-md text-sticker-green',
                'border-2 border-sticker-green/30',
                'hover:bg-sticker-green/10 transition-colors'
              )}
            >
              <Check className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={onDelete}
            title="Delete reminder"
            className={cn(
              'p-2 rounded-md text-destructive',
              'border-2 border-destructive/30',
              'hover:bg-destructive/10 transition-colors'
            )}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
