'use client'

import { useEffect, useRef, ReactNode } from 'react'
import { cn } from '@/lib/utils'
import {
  ResponsiveDialog,
  ResponsiveDialogDescription,
  ResponsiveDialogActions,
  ResponsiveDialogButton,
} from './ResponsiveDialog'
import { showNativeConfirm, isNativeDialogAvailable } from '@/lib/nativeDialog'

interface ConfirmDialogProps {
  open: boolean
  onConfirm: () => void
  onCancel: () => void
  title: string
  description: string
  confirmText?: string
  cancelText?: string
  variant?: 'danger' | 'warning' | 'default'
  children?: ReactNode
}

export function ConfirmDialog({
  open,
  onConfirm,
  onCancel,
  title,
  description,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'default',
  children,
}: ConfirmDialogProps) {
  const confirmButtonRef = useRef<HTMLButtonElement>(null)
  const nativeHandled = useRef(false)

  // Show native dialog on iOS when no custom children
  useEffect(() => {
    if (!open || children || !isNativeDialogAvailable()) {
      nativeHandled.current = false
      return
    }

    nativeHandled.current = true
    showNativeConfirm({
      title,
      message: description,
      okButtonTitle: confirmText,
      cancelButtonTitle: cancelText,
    }).then((result) => {
      if (result === true) {
        onConfirm()
      } else {
        onCancel()
      }
    })
  }, [open, children, title, description, confirmText, cancelText, onConfirm, onCancel])

  // Focus confirm button when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => confirmButtonRef.current?.focus(), 100)
    }
  }, [open])

  // If native dialog is handling this, don't render web dialog
  if (open && !children && isNativeDialogAvailable()) {
    return null
  }

  const iconWrapper = (
    <div
      className={cn(
        'w-14 h-14 rounded-lg flex items-center justify-center text-3xl',
        'border-[3px] border-border shadow-sticker-sm',
        variant === 'danger' && 'bg-destructive/10',
        variant === 'warning' && 'bg-sticker-orange/10',
        variant === 'default' && 'bg-primary/10'
      )}
    >
      {variant === 'danger' && '🚨'}
      {variant === 'warning' && '⚠️'}
      {variant === 'default' && '🤔'}
    </div>
  )

  return (
    <ResponsiveDialog
      open={open}
      onClose={onCancel}
      title={title}
      titleId="confirm-title"
      descriptionId="confirm-description"
      icon={iconWrapper}
      role="alertdialog"
    >
      <ResponsiveDialogDescription id="confirm-description">
        {description}
      </ResponsiveDialogDescription>

      {/* Additional content */}
      {children && <div className="mb-4">{children}</div>}

      {/* Actions */}
      <ResponsiveDialogActions>
        <ResponsiveDialogButton onClick={onCancel} variant="secondary">
          {cancelText}
        </ResponsiveDialogButton>
        <button
          ref={confirmButtonRef}
          onClick={onConfirm}
          className={cn(
            'flex-1 px-4 py-3 rounded-md font-bold text-sm transition-all',
            'border-[3px] border-border',
            'md:py-3 py-3.5 min-h-[52px] md:min-h-0',
            'shadow-sticker-sm',
            'hover:-translate-y-px hover:shadow-sticker',
            'active:translate-y-px active:shadow-sticker-hover',
            variant === 'danger' && 'bg-destructive text-destructive-foreground',
            variant === 'warning' && 'bg-sticker-orange text-white',
            variant === 'default' && 'bg-primary text-primary-foreground'
          )}
        >
          {confirmText}
        </button>
      </ResponsiveDialogActions>
    </ResponsiveDialog>
  )
}
