'use client'

import { useEffect, useRef, ReactNode } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useIsMobile } from './IOSActionSheet'

interface ResponsiveDialogProps {
  open: boolean
  onClose: () => void
  children: ReactNode
  title?: string
  titleId?: string
  descriptionId?: string
  icon?: ReactNode
  showCloseButton?: boolean
  className?: string
  role?: 'dialog' | 'alertdialog'
  preventBackdropClose?: boolean
}

export function ResponsiveDialog({
  open,
  onClose,
  children,
  title,
  titleId,
  descriptionId,
  icon,
  showCloseButton = true,
  className,
  role = 'dialog',
  preventBackdropClose = false,
}: ResponsiveDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const isMobile = useIsMobile()

  // Handle escape key and prevent body scroll
  useEffect(() => {
    if (!open) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !preventBackdropClose) {
        onClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [open, onClose, preventBackdropClose])

  if (!open) return null

  return (
    <div
      className={cn(
        'fixed inset-0 z-50 flex p-4',
        isMobile ? 'items-end justify-center pb-0' : 'items-center justify-center'
      )}
      onClick={preventBackdropClose ? undefined : onClose}
    >
      {/* Backdrop */}
      <div
        className={cn(
          'absolute inset-0 animate-in fade-in duration-200',
          'bg-black/40 backdrop-blur-xs'
        )}
      />

      {/* Dialog/Sheet */}
      <div
        ref={dialogRef}
        role={role}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className={cn(
          'relative z-10 w-full',
          isMobile
            ? [
                'max-w-lg mx-0',
                'rounded-t-lg rounded-b-none',
                'animate-in slide-in-from-bottom duration-300 ease-out',
                'max-h-[90vh] overflow-hidden flex flex-col',
                'border-[3px] border-b-0 border-border',
              ]
            : [
                'max-w-md',
                'rounded-lg',
                'animate-in zoom-in-95 fade-in duration-200',
                'border-[3px] border-border',
                'shadow-sticker',
              ],
          'bg-card',
          className
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag indicator for mobile */}
        {isMobile && (
          <div className="flex justify-center pt-3 pb-1 shrink-0">
            <div className="w-12 h-1.5 rounded-full bg-border" />
          </div>
        )}

        {/* Close button */}
        {showCloseButton && (
          <button
            onClick={onClose}
            className={cn(
              'absolute p-2 rounded-md text-muted-foreground',
              'hover:text-foreground hover:bg-secondary transition-colors',
              'border-2 border-transparent hover:border-border',
              isMobile ? 'top-3 right-3' : 'top-4 right-4'
            )}
          >
            <X className="w-4 h-4" />
          </button>
        )}

        {/* Content wrapper */}
        <div className={cn('overflow-y-auto', isMobile ? 'px-4 pb-4 pt-2' : 'p-6')}>
          {/* Icon */}
          {icon && <div className={cn('shrink-0', isMobile ? 'mb-3' : 'mb-4')}>{icon}</div>}

          {/* Title */}
          {title && (
            <h2
              id={titleId}
              className={cn(
                'font-extrabold text-foreground',
                isMobile ? 'text-xl mb-2' : 'text-xl mb-3'
              )}
            >
              {title}
            </h2>
          )}

          {children}
        </div>

        {/* Safe area spacer for notched devices */}
        {isMobile && <div className="h-[env(safe-area-inset-bottom)] bg-card shrink-0" />}
      </div>
    </div>
  )
}

// Subcomponents for structured content
export function ResponsiveDialogDescription({
  children,
  id,
  className,
}: {
  children: ReactNode
  id?: string
  className?: string
}) {
  return (
    <p id={id} className={cn('text-sm text-muted-foreground mb-4', className)}>
      {children}
    </p>
  )
}

export function ResponsiveDialogActions({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  const isMobile = useIsMobile()

  return (
    <div className={cn('flex gap-3', isMobile ? 'flex-col-reverse pt-4' : 'pt-3', className)}>
      {children}
    </div>
  )
}

export function ResponsiveDialogButton({
  children,
  onClick,
  variant = 'secondary',
  disabled,
  type = 'button',
  className,
}: {
  children: ReactNode
  onClick?: () => void
  variant?: 'primary' | 'secondary' | 'danger' | 'warning'
  disabled?: boolean
  type?: 'button' | 'submit'
  className?: string
}) {
  const isMobile = useIsMobile()

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex-1 rounded-md font-bold text-sm transition-all',
        'border-[3px] border-border',
        isMobile ? 'px-4 py-3.5 min-h-[52px]' : 'px-4 py-3',
        variant === 'primary' && [
          'bg-primary text-primary-foreground',
          'shadow-sticker-sm',
          'hover:-translate-y-px hover:shadow-sticker',
          'active:translate-y-px active:shadow-sticker-hover',
        ],
        variant === 'secondary' && [
          'bg-secondary text-secondary-foreground',
          'shadow-sticker-sm',
          'hover:-translate-y-px hover:shadow-sticker',
          'active:translate-y-px active:shadow-sticker-hover',
        ],
        variant === 'danger' && [
          'bg-destructive text-destructive-foreground',
          'shadow-sticker-sm',
          'hover:-translate-y-px hover:shadow-sticker',
          'active:translate-y-px active:shadow-sticker-hover',
        ],
        variant === 'warning' && [
          'bg-sticker-orange text-white',
          'shadow-sticker-sm',
          'hover:-translate-y-px hover:shadow-sticker',
          'active:translate-y-px active:shadow-sticker-hover',
        ],
        'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0',
        className
      )}
    >
      {children}
    </button>
  )
}
