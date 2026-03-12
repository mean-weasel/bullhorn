'use client'

import { useState, useRef, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Bold, Italic, Heading1, Link, Code, List } from 'lucide-react'
import { cn } from '@/lib/utils'

interface MarkdownEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

type FormatAction = 'bold' | 'italic' | 'heading' | 'link' | 'code' | 'list'

export function MarkdownEditor({ value, onChange, placeholder }: MarkdownEditorProps) {
  const [mode, setMode] = useState<'write' | 'preview'>('write')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const insertFormat = useCallback(
    (action: FormatAction) => {
      const textarea = textareaRef.current
      if (!textarea) return

      const start = textarea.selectionStart
      const end = textarea.selectionEnd
      const selected = value.substring(start, end)
      let before = value.substring(0, start)
      const after = value.substring(end)
      let inserted = ''
      let cursorOffset = 0

      switch (action) {
        case 'bold':
          inserted = `**${selected || 'bold text'}**`
          cursorOffset = selected ? inserted.length : 2
          break
        case 'italic':
          inserted = `*${selected || 'italic text'}*`
          cursorOffset = selected ? inserted.length : 1
          break
        case 'heading':
          // Insert at beginning of current line
          {
            const lineStart = before.lastIndexOf('\n') + 1
            const linePrefix = before.substring(lineStart)
            before = before.substring(0, lineStart)
            inserted = `## ${linePrefix}${selected}`
            cursorOffset = inserted.length
          }
          break
        case 'link':
          inserted = `[${selected || 'link text'}](url)`
          cursorOffset = selected ? inserted.length - 1 : 1
          break
        case 'code':
          if (selected.includes('\n')) {
            inserted = `\`\`\`\n${selected}\n\`\`\``
            cursorOffset = inserted.length
          } else {
            inserted = `\`${selected || 'code'}\``
            cursorOffset = selected ? inserted.length : 1
          }
          break
        case 'list':
          {
            const lines = (selected || 'item').split('\n')
            inserted = lines.map((line) => `- ${line}`).join('\n')
            cursorOffset = inserted.length
          }
          break
      }

      const newValue = before + inserted + after
      onChange(newValue)

      // Restore focus and set cursor position
      requestAnimationFrame(() => {
        textarea.focus()
        const pos = before.length + cursorOffset
        textarea.setSelectionRange(pos, pos)
      })
    },
    [value, onChange]
  )

  const toolbarButtons: { action: FormatAction; icon: typeof Bold; label: string }[] = [
    { action: 'bold', icon: Bold, label: 'Bold' },
    { action: 'italic', icon: Italic, label: 'Italic' },
    { action: 'heading', icon: Heading1, label: 'Heading' },
    { action: 'link', icon: Link, label: 'Link' },
    { action: 'code', icon: Code, label: 'Code' },
    { action: 'list', icon: List, label: 'List' },
  ]

  return (
    <div className="border border-border rounded-lg bg-card overflow-hidden">
      {/* Tab bar and toolbar */}
      <div className="flex items-center justify-between border-b border-border bg-muted/30 px-2">
        {/* Tabs */}
        <div className="flex">
          <button
            type="button"
            onClick={() => setMode('write')}
            className={cn(
              'px-4 py-2 text-sm font-medium transition-colors',
              mode === 'write'
                ? 'text-foreground border-b-2 border-[hsl(var(--gold))]'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Write
          </button>
          <button
            type="button"
            onClick={() => setMode('preview')}
            className={cn(
              'px-4 py-2 text-sm font-medium transition-colors',
              mode === 'preview'
                ? 'text-foreground border-b-2 border-[hsl(var(--gold))]'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Preview
          </button>
        </div>

        {/* Toolbar (only in write mode) */}
        {mode === 'write' && (
          <div className="flex items-center gap-0.5">
            {toolbarButtons.map(({ action, icon: Icon, label }) => (
              <button
                key={action}
                type="button"
                title={label}
                onClick={() => insertFormat(action)}
                className={cn(
                  'p-1.5 rounded text-muted-foreground',
                  'hover:text-foreground hover:bg-muted transition-colors'
                )}
              >
                <Icon className="w-4 h-4" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Content area */}
      {mode === 'write' ? (
        <textarea
          ref={textareaRef}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={cn(
            'w-full min-h-[400px] resize-y',
            'bg-transparent border-none',
            'p-4 text-base font-mono leading-relaxed',
            'placeholder:text-muted-foreground/50',
            'focus:outline-hidden'
          )}
        />
      ) : (
        <div
          className={cn(
            'markdown-preview p-4 min-h-[400px]',
            'text-base leading-relaxed',
            !value && 'text-muted-foreground/50 italic'
          )}
        >
          {value ? (
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{value}</ReactMarkdown>
          ) : (
            'Nothing to preview'
          )}
        </div>
      )}
    </div>
  )
}
