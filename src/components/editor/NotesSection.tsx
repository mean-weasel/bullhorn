'use client'

import { StickyNote, ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'

interface NotesSectionProps {
  notes: string
  showNotes: boolean
  onToggle: () => void
  onChange: (notes: string) => void
  className?: string
}

export const NotesSection = ({
  notes,
  showNotes,
  onToggle,
  onChange,
  className,
}: NotesSectionProps) => {
  return (
    <div className={className}>
      <button
        onClick={onToggle}
        className={cn(
          'w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all',
          showNotes || notes
            ? 'border-[hsl(var(--gold))]/30 bg-[hsl(var(--gold))]/5'
            : 'border-border bg-card hover:border-[hsl(var(--gold))]/30'
        )}
      >
        <div className="flex items-center gap-2 text-sm font-medium">
          <StickyNote className="w-4 h-4 text-[hsl(var(--gold-dark))]" />
          <span>Notes</span>
          {notes && !showNotes && (
            <span className="text-xs text-muted-foreground truncate max-w-[200px]">— {notes}</span>
          )}
        </div>
        {showNotes ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        )}
      </button>
      {showNotes && (
        <div className="mt-2 animate-slide-up">
          <textarea
            value={notes}
            onChange={(e) => onChange(e.target.value)}
            maxLength={5000}
            placeholder="Add notes about this post (e.g., context, hashtags to use, posting strategy)..."
            className={cn(
              'w-full min-h-[100px] p-3 md:p-4 rounded-xl',
              'bg-card border border-[hsl(var(--gold))]/20',
              'text-sm leading-relaxed',
              'placeholder:text-muted-foreground',
              'focus:outline-hidden focus:border-[hsl(var(--gold))] focus:ring-4 focus:ring-[hsl(var(--gold))]/10',
              'resize-y transition-all'
            )}
          />
          <p className="text-xs text-muted-foreground mt-1.5">
            Notes are private and won't be published. Use them to track ideas or instructions.
          </p>
        </div>
      )}
    </div>
  )
}
