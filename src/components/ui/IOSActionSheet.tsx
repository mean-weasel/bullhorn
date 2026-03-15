'use client'

import { useEffect, useRef, ReactNode } from 'react'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface ActionSheetOption<T = string> {
  value: T
  label: string
  icon?: ReactNode
  description?: string
  destructive?: boolean
}

interface IOSActionSheetProps<T = string> {
  open: boolean
  onClose: () => void
  onSelect: (value: T) => void
  title?: string
  options: ActionSheetOption<T>[]
  selectedValue?: T
  cancelText?: string
}

// eslint-disable-next-line max-lines-per-function
export function IOSActionSheet<T = string>({
  open,
  onClose,
  onSelect,
  title,
  options,
  selectedValue,
  cancelText = 'Cancel',
}: IOSActionSheetProps<T>) {
  const sheetRef = useRef<HTMLDivElement>(null)

  // Handle escape key and prevent body scroll
  useEffect(() => {
    if (!open) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  const handleSelect = (option: ActionSheetOption<T>) => {
    onSelect(option.value)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-xs animate-in fade-in duration-200" />

      {/* Sheet */}
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label={title || 'Select an option'}
        className={cn(
          'relative z-10 w-full max-w-lg mx-4 mb-4',
          'animate-in slide-in-from-bottom duration-300 ease-out'
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Options container */}
        <div className="bg-card border-[3px] border-border rounded-lg overflow-hidden shadow-sticker">
          {/* Title */}
          {title && (
            <div className="px-4 py-3 text-center border-b-2 border-border bg-secondary">
              <span className="text-sm font-bold text-foreground">{title}</span>
            </div>
          )}

          {/* Options */}
          <div className="max-h-[50vh] overflow-y-auto">
            {options.map((option, index) => (
              <button
                key={String(option.value)}
                type="button"
                onClick={() => handleSelect(option)}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-4',
                  'text-left transition-colors',
                  'active:bg-primary/20',
                  'hover:bg-secondary',
                  index !== options.length - 1 && 'border-b-2 border-border',
                  option.destructive && 'text-destructive'
                )}
              >
                {/* Icon */}
                {option.icon && (
                  <span
                    className={cn(
                      'shrink-0',
                      option.destructive ? 'text-destructive' : 'text-muted-foreground'
                    )}
                  >
                    {option.icon}
                  </span>
                )}

                {/* Label and description */}
                <div className="flex-1 min-w-0">
                  <span
                    className={cn(
                      'text-base font-bold block',
                      option.destructive ? 'text-destructive' : 'text-foreground'
                    )}
                  >
                    {option.label}
                  </span>
                  {option.description && (
                    <span className="text-sm text-muted-foreground block mt-0.5">
                      {option.description}
                    </span>
                  )}
                </div>

                {/* Checkmark for selected */}
                {selectedValue === option.value && (
                  <Check className="w-5 h-5 text-sticker-green shrink-0" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Cancel button - separate card */}
        <button
          type="button"
          onClick={onClose}
          className={cn(
            'w-full mt-3 px-4 py-4',
            'bg-card border-[3px] border-border rounded-lg',
            'text-base font-bold text-primary',
            'active:bg-primary/20 transition-colors',
            'shadow-sticker',
            'hover:translate-y-[-2px] hover:shadow-[6px_6px_0_hsl(var(--border))]'
          )}
        >
          {cancelText}
        </button>
      </div>

      {/* Safe area spacer for notched devices */}
      <div className="h-[env(safe-area-inset-bottom)]" />
    </div>
  )
}

// eslint-disable-next-line react-refresh/only-export-components -- utility hook co-located with component
export function useIsIOS() {
  if (typeof window === 'undefined') return false

  const ua = window.navigator.userAgent
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (ua.includes('Mac') && 'ontouchend' in document)

  return isIOS
}

// eslint-disable-next-line react-refresh/only-export-components -- utility hook co-located with component
export function useIsMobile() {
  if (typeof window === 'undefined') return false

  return (
    window.innerWidth < 768 ||
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      window.navigator.userAgent
    )
  )
}

// Re-export iOS components for convenience
export { IOSDateTimePicker } from './IOSDateTimePicker'
export { IOSSegmentedControl } from './IOSSegmentedControl'
export { IOSToggleSwitch } from './IOSToggleSwitch'
