'use client'
/* eslint-disable max-lines -- large page component with extracted sub-components */

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Save,
  Archive,
  Trash2,
  RotateCcw,
  AlertCircle,
  CheckCircle,
  Tag,
} from 'lucide-react'
import { useBlogDraftsStore, BlogDraft, BLOG_DRAFT_TAGS } from '@/lib/blogDrafts'
import { cn } from '@/lib/utils'
import { IOSDateTimePicker } from '@/components/ui/IOSDateTimePicker'
import { MarkdownEditor } from '@/components/ui/MarkdownEditor'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'

interface BlogEditorFormProps {
  /** Draft ID for editing. Undefined for new drafts. */
  draftId?: string
  /** Route to redirect to after creating a new draft (e.g., '/blog/{id}' or '/blog/edit/{id}'). */
  newDraftRedirectPrefix: string
}

// eslint-disable-next-line max-lines-per-function
export function BlogEditorForm({ draftId, newDraftRedirectPrefix }: BlogEditorFormProps) {
  const router = useRouter()
  const isEditing = !!draftId

  const {
    getDraft,
    addDraft,
    updateDraft,
    archiveDraft,
    restoreDraft,
    deleteDraft,
    fetchDrafts,
    initialized,
  } = useBlogDraftsStore()

  // Form state
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [date, setDate] = useState('')
  const [notes, setNotes] = useState('')
  const [status, setStatus] = useState<BlogDraft['status']>('draft')
  const [scheduledAt, setScheduledAt] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false)

  // Track original values for change detection
  const originalRef = useRef<{
    title: string
    content: string
    notes: string
    date: string
    tags: string[]
  } | null>(null)

  // Clear message after 3 seconds
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(null), 3000)
      return () => clearTimeout(timer)
    }
  }, [message])

  // Load draft if editing
  useEffect(() => {
    if (!initialized) {
      fetchDrafts()
      return
    }

    if (isEditing) {
      const draft = getDraft(draftId!)
      if (draft) {
        setTitle(draft.title)
        setContent(draft.content)
        setDate(draft.date || '')
        setNotes(draft.notes || '')
        setStatus(draft.status)
        setScheduledAt(draft.scheduledAt || '')
        setTags(draft.tags || [])
        originalRef.current = {
          title: draft.title,
          content: draft.content,
          notes: draft.notes || '',
          date: draft.date || '',
          tags: draft.tags || [],
        }
      } else {
        // Draft not found, redirect to list
        router.push('/blog')
      }
    }
  }, [draftId, isEditing, getDraft, initialized, fetchDrafts, router])

  // Check for unsaved changes
  useEffect(() => {
    if (!originalRef.current && !isEditing) {
      // New draft - has unsaved changes if any content
      setHasUnsavedChanges(title.trim() !== '' || content.trim() !== '')
      return
    }

    if (originalRef.current) {
      const hasChanges =
        title !== originalRef.current.title ||
        content !== originalRef.current.content ||
        notes !== originalRef.current.notes ||
        date !== originalRef.current.date ||
        JSON.stringify(tags) !== JSON.stringify(originalRef.current.tags)
      setHasUnsavedChanges(hasChanges)
    }
  }, [title, content, notes, date, tags, isEditing])

  // Calculate word count
  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0

  // Save handler
  const handleSave = useCallback(async () => {
    if (!title.trim()) {
      setMessage({ type: 'error', text: 'Title is required' })
      return
    }

    setSaving(true)
    try {
      if (isEditing) {
        await updateDraft(draftId!, {
          title: title.trim(),
          content,
          date: date || null,
          notes: notes || undefined,
          scheduledAt: scheduledAt || null,
          tags,
        })
        originalRef.current = { title, content, notes, date, tags }
        setHasUnsavedChanges(false)
        setMessage({ type: 'success', text: 'Draft saved' })
      } else {
        const newDraft = await addDraft({
          title: title.trim(),
          content,
          date: date || null,
          notes: notes || undefined,
          status: 'draft',
          scheduledAt: null,
          tags,
        })
        setMessage({ type: 'success', text: 'Draft created' })
        router.replace(`${newDraftRedirectPrefix}${newDraft.id}`)
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to save draft' })
      console.error('Save error:', error)
    } finally {
      setSaving(false)
    }
  }, [
    title,
    content,
    date,
    notes,
    tags,
    scheduledAt,
    isEditing,
    draftId,
    addDraft,
    updateDraft,
    router,
    newDraftRedirectPrefix,
  ])

  // Archive handler
  const handleArchive = useCallback(async () => {
    if (!isEditing) return
    try {
      await archiveDraft(draftId!)
      router.push('/blog')
    } catch {
      setMessage({ type: 'error', text: 'Failed to archive draft' })
    }
  }, [isEditing, draftId, archiveDraft, router])

  // Restore handler
  const handleRestore = useCallback(async () => {
    if (!isEditing) return
    try {
      await restoreDraft(draftId!)
      setStatus('draft')
      setMessage({ type: 'success', text: 'Draft restored' })
    } catch {
      setMessage({ type: 'error', text: 'Failed to restore draft' })
    }
  }, [isEditing, draftId, restoreDraft])

  // Delete handler
  const handleDelete = useCallback(() => {
    if (!isEditing) return
    setShowDeleteConfirm(true)
  }, [isEditing])

  const confirmDelete = useCallback(async () => {
    try {
      await deleteDraft(draftId!)
      router.push('/blog')
    } catch {
      setMessage({ type: 'error', text: 'Failed to delete draft' })
    }
  }, [draftId, deleteDraft, router])

  // Keyboard shortcut for save
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        handleSave()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleSave])

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-xl border-b border-border">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => {
              if (hasUnsavedChanges) {
                setShowLeaveConfirm(true)
                return
              }
              router.push('/blog')
            }}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="hidden sm:inline">Back to Drafts</span>
          </button>

          <div className="flex items-center gap-2">
            {hasUnsavedChanges && (
              <span className="text-xs text-muted-foreground">Unsaved changes</span>
            )}
            <button
              onClick={handleSave}
              disabled={saving || !title.trim()}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-lg min-h-[40px]',
                'bg-linear-to-br from-[hsl(var(--gold))] to-[hsl(var(--gold-dark))]',
                'border-2 border-[hsl(var(--gold-dark))]',
                'text-primary-foreground font-medium text-sm',
                'hover:shadow-lg hover:shadow-[hsl(var(--gold))]/30 transition-all',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </header>

      {/* Status message */}
      {message && (
        <div
          role="status"
          aria-live="polite"
          className={cn(
            'max-w-4xl mx-auto px-4 py-2',
            'flex items-center gap-2 text-sm',
            message.type === 'success' ? 'text-green-400' : 'text-red-400'
          )}
        >
          {message.type === 'success' ? (
            <CheckCircle className="w-4 h-4" />
          ) : (
            <AlertCircle className="w-4 h-4" />
          )}
          {message.text}
        </div>
      )}

      {/* Main content */}
      <main className="max-w-4xl mx-auto px-4 py-6">
        {/* Title */}
        <input
          type="text"
          placeholder="Post title..."
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={300}
          className={cn(
            'w-full text-2xl md:text-3xl font-display font-bold',
            'bg-transparent border-none outline-hidden',
            'placeholder:text-muted-foreground/50',
            'mb-4'
          )}
        />

        {/* Metadata row */}
        <div className="flex flex-wrap items-center gap-4 mb-4 text-sm text-muted-foreground">
          <IOSDateTimePicker
            value={date ? new Date(`${date}T12:00:00`) : null}
            onChange={(newDate) => setDate(newDate ? newDate.toISOString().split('T')[0] : '')}
            mode="date"
            placeholder="Publication date"
            className="w-auto"
          />
          <span>{wordCount} words</span>
          {status !== 'draft' && (
            <span
              className={cn(
                'px-2 py-0.5 rounded text-xs font-medium',
                status === 'published' && 'bg-green-500/20 text-green-400',
                status === 'scheduled' && 'bg-blue-500/20 text-blue-400',
                status === 'archived' && 'bg-muted text-muted-foreground'
              )}
            >
              {status}
            </span>
          )}
        </div>

        {/* Tags */}
        <div className="flex items-center gap-3 mb-6">
          <Tag className="w-4 h-4 text-muted-foreground shrink-0" />
          <div className="flex flex-wrap gap-2">
            {BLOG_DRAFT_TAGS.map((tag) => {
              const isSelected = tags.includes(tag)
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => {
                    setTags((prev) => (isSelected ? prev.filter((t) => t !== tag) : [...prev, tag]))
                  }}
                  className={cn(
                    'sticker-badge px-3 py-1 text-xs font-medium rounded-full',
                    'transition-all duration-200 cursor-pointer',
                    isSelected
                      ? 'bg-[hsl(var(--gold))]/20 text-[hsl(var(--gold-dark))] border-[hsl(var(--gold))]/50'
                      : 'bg-muted text-muted-foreground border-border hover:border-foreground/20'
                  )}
                >
                  {tag}
                </button>
              )
            })}
          </div>
        </div>

        {/* Content */}
        <MarkdownEditor
          value={content}
          onChange={setContent}
          placeholder="Start writing your post in markdown..."
        />

        {/* Notes section */}
        <div className="mt-6">
          <label className="block text-sm font-medium text-muted-foreground mb-2">
            Private Notes (not published)
          </label>
          <textarea
            placeholder="Add private notes about this draft..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className={cn(
              'w-full min-h-[100px] resize-y',
              'bg-muted/50 border border-border rounded-lg',
              'p-3 text-sm',
              'placeholder:text-muted-foreground/50',
              'focus:outline-hidden focus:ring-2 focus:ring-[hsl(var(--gold))]/50'
            )}
          />
        </div>

        {/* Actions for existing drafts */}
        {isEditing && (
          <div className="mt-8 pt-6 border-t border-border">
            <div className="flex flex-wrap gap-3">
              {status === 'archived' ? (
                <button
                  onClick={handleRestore}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 rounded-lg',
                    'border border-border text-muted-foreground',
                    'hover:border-foreground/20 hover:text-foreground transition-colors'
                  )}
                >
                  <RotateCcw className="w-4 h-4" />
                  Restore
                </button>
              ) : (
                <button
                  onClick={handleArchive}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 rounded-lg',
                    'border border-border text-muted-foreground',
                    'hover:border-foreground/20 hover:text-foreground transition-colors'
                  )}
                >
                  <Archive className="w-4 h-4" />
                  Archive
                </button>
              )}
              <button
                onClick={handleDelete}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-lg',
                  'border border-destructive/50 text-destructive',
                  'hover:bg-destructive/10 transition-colors'
                )}
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            </div>
          </div>
        )}
      </main>

      <ConfirmDialog
        open={showDeleteConfirm}
        onConfirm={confirmDelete}
        onCancel={() => setShowDeleteConfirm(false)}
        title="Delete this draft?"
        description="This action cannot be undone. The draft will be permanently removed."
        confirmText="Delete"
        cancelText="Keep"
        variant="danger"
      />

      <ConfirmDialog
        open={showLeaveConfirm}
        onConfirm={() => router.push('/blog')}
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
