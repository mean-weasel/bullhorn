'use client'

import { useState, useEffect } from 'react'
import { Bell } from 'lucide-react'
import { useRemindersStore } from '@/lib/reminders'
import { usePostsStore } from '@/lib/storage'
import { useCampaignsStore } from '@/lib/campaigns'
import { getPostPreviewText } from '@/lib/posts'
import { cn } from '@/lib/utils'
import {
  ResponsiveDialog,
  ResponsiveDialogDescription,
  ResponsiveDialogActions,
  ResponsiveDialogButton,
} from '@/components/ui/ResponsiveDialog'

interface AddReminderModalProps {
  open: boolean
  onClose: () => void
  /** Pre-select a post */
  defaultPostId?: string
  /** Pre-select a campaign */
  defaultCampaignId?: string
}

export function AddReminderModal({
  open,
  onClose,
  defaultPostId,
  defaultCampaignId,
}: AddReminderModalProps) {
  const addReminder = useRemindersStore((s) => s.addReminder)
  const posts = usePostsStore((s) => s.posts)
  const postsInitialized = usePostsStore((s) => s.initialized)
  const fetchPosts = usePostsStore((s) => s.fetchPosts)
  const campaigns = useCampaignsStore((s) => s.campaigns)
  const campaignsInitialized = useCampaignsStore((s) => s.initialized)
  const fetchCampaigns = useCampaignsStore((s) => s.fetchCampaigns)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [remindAt, setRemindAt] = useState('')
  const [postId, setPostId] = useState(defaultPostId || '')
  const [campaignId, setCampaignId] = useState(defaultCampaignId || '')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch posts and campaigns if not initialized
  useEffect(() => {
    if (open && !postsInitialized) fetchPosts()
  }, [open, postsInitialized, fetchPosts])

  useEffect(() => {
    if (open && !campaignsInitialized) fetchCampaigns()
  }, [open, campaignsInitialized, fetchCampaigns])

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      setTitle('')
      setDescription('')
      setRemindAt('')
      setPostId(defaultPostId || '')
      setCampaignId(defaultCampaignId || '')
      setError(null)
    }
  }, [open, defaultPostId, defaultCampaignId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !remindAt) return

    setSubmitting(true)
    setError(null)

    try {
      await addReminder({
        title: title.trim(),
        description: description.trim() || undefined,
        remindAt: new Date(remindAt).toISOString(),
        postId: postId || undefined,
        campaignId: campaignId || undefined,
      })
      onClose()
    } catch (err) {
      setError((err as Error).message || 'Failed to create reminder')
    } finally {
      setSubmitting(false)
    }
  }

  // Filter active posts/campaigns for selectors
  const activePosts = posts.filter((p) => p.status !== 'archived')
  const activeCampaigns = campaigns.filter((c) => c.status !== 'archived')

  const iconWrapper = (
    <div
      className={cn(
        'w-14 h-14 rounded-lg flex items-center justify-center',
        'border-[3px] border-border shadow-sticker-sm',
        'bg-sticker-pink/10'
      )}
    >
      <Bell className="w-7 h-7 text-sticker-pink" />
    </div>
  )

  return (
    <ResponsiveDialog
      open={open}
      onClose={onClose}
      title="Add Reminder"
      titleId="add-reminder-title"
      descriptionId="add-reminder-description"
      icon={iconWrapper}
    >
      <ResponsiveDialogDescription id="add-reminder-description">
        Set a reminder to get notified about your posts and campaigns.
      </ResponsiveDialogDescription>

      <form onSubmit={handleSubmit}>
        {error && (
          <div className="mb-4 p-3 rounded-md bg-destructive/10 text-destructive text-sm font-medium border-2 border-destructive/30">
            {error}
          </div>
        )}

        {/* Title */}
        <div className="mb-4">
          <label htmlFor="reminder-title" className="block text-sm font-bold mb-1.5">
            Title <span className="text-destructive">*</span>
          </label>
          <input
            id="reminder-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., Review campaign posts"
            maxLength={200}
            required
            className={cn(
              'w-full px-3 py-2.5 rounded-md text-sm',
              'border-[3px] border-border bg-background',
              'shadow-sticker-sm',
              'focus:outline-hidden focus:ring-2 focus:ring-primary/50',
              'placeholder:text-muted-foreground/60'
            )}
          />
        </div>

        {/* Description */}
        <div className="mb-4">
          <label htmlFor="reminder-description" className="block text-sm font-bold mb-1.5">
            Description
          </label>
          <textarea
            id="reminder-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional notes..."
            maxLength={2000}
            rows={2}
            className={cn(
              'w-full px-3 py-2.5 rounded-md text-sm resize-none',
              'border-[3px] border-border bg-background',
              'shadow-sticker-sm',
              'focus:outline-hidden focus:ring-2 focus:ring-primary/50',
              'placeholder:text-muted-foreground/60'
            )}
          />
        </div>

        {/* Remind At */}
        <div className="mb-4">
          <label htmlFor="reminder-remind-at" className="block text-sm font-bold mb-1.5">
            Remind at <span className="text-destructive">*</span>
          </label>
          <input
            id="reminder-remind-at"
            type="datetime-local"
            value={remindAt}
            onChange={(e) => setRemindAt(e.target.value)}
            required
            className={cn(
              'w-full px-3 py-2.5 rounded-md text-sm',
              'border-[3px] border-border bg-background',
              'shadow-sticker-sm',
              'focus:outline-hidden focus:ring-2 focus:ring-primary/50'
            )}
          />
        </div>

        {/* Post selector */}
        <div className="mb-4">
          <label htmlFor="reminder-post" className="block text-sm font-bold mb-1.5">
            Link to post
          </label>
          <select
            id="reminder-post"
            value={postId}
            onChange={(e) => setPostId(e.target.value)}
            className={cn(
              'w-full px-3 py-2.5 rounded-md text-sm',
              'border-[3px] border-border bg-background',
              'shadow-sticker-sm',
              'focus:outline-hidden focus:ring-2 focus:ring-primary/50'
            )}
          >
            <option value="">None</option>
            {activePosts.map((post) => {
              const preview = getPostPreviewText(post)
              const label = preview
                ? preview.slice(0, 50) + (preview.length > 50 ? '...' : '')
                : 'Untitled post'
              return (
                <option key={post.id} value={post.id}>
                  [{post.platform}] {label}
                </option>
              )
            })}
          </select>
        </div>

        {/* Campaign selector */}
        <div className="mb-4">
          <label htmlFor="reminder-campaign" className="block text-sm font-bold mb-1.5">
            Link to campaign
          </label>
          <select
            id="reminder-campaign"
            value={campaignId}
            onChange={(e) => setCampaignId(e.target.value)}
            className={cn(
              'w-full px-3 py-2.5 rounded-md text-sm',
              'border-[3px] border-border bg-background',
              'shadow-sticker-sm',
              'focus:outline-hidden focus:ring-2 focus:ring-primary/50'
            )}
          >
            <option value="">None</option>
            {activeCampaigns.map((campaign) => (
              <option key={campaign.id} value={campaign.id}>
                {campaign.name}
              </option>
            ))}
          </select>
        </div>

        <ResponsiveDialogActions>
          <ResponsiveDialogButton onClick={onClose} variant="secondary" disabled={submitting}>
            Cancel
          </ResponsiveDialogButton>
          <ResponsiveDialogButton
            type="submit"
            variant="primary"
            disabled={submitting || !title.trim() || !remindAt}
          >
            {submitting ? 'Creating...' : 'Create Reminder'}
          </ResponsiveDialogButton>
        </ResponsiveDialogActions>
      </form>
    </ResponsiveDialog>
  )
}
