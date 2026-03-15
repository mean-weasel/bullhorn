'use client'

import { useState, useEffect, useRef } from 'react'
import { FolderKanban } from 'lucide-react'
import { useProjectsStore } from '@/lib/projects'
import { cn } from '@/lib/utils'
import {
  ResponsiveDialog,
  ResponsiveDialogDescription,
  ResponsiveDialogActions,
  ResponsiveDialogButton,
} from '@/components/ui/ResponsiveDialog'

interface CreateProjectModalProps {
  open: boolean
  onClose: () => void
  onSuccess?: (projectId: string) => void
}

// eslint-disable-next-line max-lines-per-function
export function CreateProjectModal({ open, onClose, onSuccess }: CreateProjectModalProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const { createProject } = useProjectsStore()

  // Focus input on open
  useEffect(() => {
    if (open) {
      setName('')
      setDescription('')
      setError(null)
      // Delay focus to allow animation
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || isSubmitting) return

    setIsSubmitting(true)
    setError(null)

    try {
      const project = await createProject({
        name: name.trim(),
        description: description.trim() || undefined,
      })
      onClose()
      onSuccess?.(project.id)
    } catch (err) {
      setError((err as Error).message || 'Failed to create project')
    } finally {
      setIsSubmitting(false)
    }
  }

  const iconWrapper = (
    <div className="w-12 h-12 rounded-full bg-[hsl(var(--gold))]/10 flex items-center justify-center">
      <FolderKanban className="w-6 h-6 text-[hsl(var(--gold-dark))]" />
    </div>
  )

  return (
    <ResponsiveDialog
      open={open}
      onClose={onClose}
      title="New Project"
      titleId="create-project-title"
      icon={iconWrapper}
    >
      <ResponsiveDialogDescription>
        Create a project to organize campaigns and maintain brand consistency.
      </ResponsiveDialogDescription>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="project-name" className="block text-sm font-medium mb-2">
            Name <span className="text-destructive">*</span>
          </label>
          <input
            ref={inputRef}
            id="project-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter project name..."
            maxLength={200}
            className={cn(
              'w-full px-3 py-2.5 rounded-lg',
              'bg-background border border-border',
              'text-foreground placeholder:text-muted-foreground',
              'focus:outline-hidden focus:ring-2 focus:ring-[hsl(var(--gold))]/50 focus:border-[hsl(var(--gold))]',
              'transition-all'
            )}
            required
          />
        </div>

        <div>
          <label htmlFor="project-description" className="block text-sm font-medium mb-2">
            Description <span className="text-muted-foreground text-xs">(optional)</span>
          </label>
          <textarea
            id="project-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe this project..."
            rows={3}
            maxLength={2000}
            className={cn(
              'w-full px-3 py-2.5 rounded-lg',
              'bg-background border border-border',
              'text-foreground placeholder:text-muted-foreground',
              'focus:outline-hidden focus:ring-2 focus:ring-[hsl(var(--gold))]/50 focus:border-[hsl(var(--gold))]',
              'resize-none transition-all'
            )}
          />
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>
        )}

        {/* Actions */}
        <ResponsiveDialogActions>
          <ResponsiveDialogButton onClick={onClose} variant="secondary">
            Cancel
          </ResponsiveDialogButton>
          <ResponsiveDialogButton
            type="submit"
            variant="primary"
            disabled={!name.trim() || isSubmitting}
          >
            {isSubmitting ? 'Creating...' : 'Create Project'}
          </ResponsiveDialogButton>
        </ResponsiveDialogActions>
      </form>
    </ResponsiveDialog>
  )
}
