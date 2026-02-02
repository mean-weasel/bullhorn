'use client'

import { useEffect, useRef } from 'react'
import { Check } from 'lucide-react'
import {
  ResponsiveDialog,
  ResponsiveDialogDescription,
  ResponsiveDialogActions,
  ResponsiveDialogButton,
} from './ResponsiveDialog'

interface UpgradePromptModalProps {
  open: boolean
  onDismiss: () => void
  title?: string
  description?: string
  currentCount?: number
  limit?: number
}

const PRO_FEATURES = [
  'Unlimited projects',
  'Team collaboration',
  'Advanced analytics',
  'Priority support',
]

export function UpgradePromptModal({
  open,
  onDismiss,
  title = "You've reached the free tier limit",
  description = "You can continue using your existing projects, but you'll need to upgrade to create more.",
  currentCount = 3,
  limit = 3,
}: UpgradePromptModalProps) {
  const dismissButtonRef = useRef<HTMLButtonElement>(null)

  // Focus dismiss button when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => dismissButtonRef.current?.focus(), 100)
    }
  }, [open])

  const iconWrapper = (
    <div className="w-14 h-14 rounded-lg bg-primary/10 flex items-center justify-center text-3xl border-[3px] border-border shadow-[3px_3px_0_hsl(var(--border))]">
      ✨
    </div>
  )

  return (
    <ResponsiveDialog
      open={open}
      onClose={onDismiss}
      title={title}
      titleId="upgrade-title"
      descriptionId="upgrade-description"
      icon={iconWrapper}
    >
      <ResponsiveDialogDescription id="upgrade-description">
        {description}
      </ResponsiveDialogDescription>

      {/* Usage indicator */}
      <div className="mb-6 p-4 rounded-md bg-card border-[3px] border-border shadow-[3px_3px_0_hsl(var(--border))]">
        <div className="flex items-center justify-between text-sm mb-3">
          <span className="text-muted-foreground font-medium">📊 Projects used</span>
          <span className="font-bold text-foreground">
            {currentCount} / {limit}
          </span>
        </div>
        <div className="h-3 bg-muted rounded-full overflow-hidden border-2 border-border">
          <div
            className="h-full bg-gradient-to-r from-sticker-yellow via-sticker-pink to-sticker-purple rounded-full transition-all"
            style={{ width: `${Math.min((currentCount / limit) * 100, 100)}%` }}
          />
        </div>
      </div>

      {/* Pro features */}
      <div className="mb-6">
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
          🚀 Upgrade to Pro
        </p>
        <ul className="space-y-2">
          {PRO_FEATURES.map((feature) => (
            <li key={feature} className="flex items-center gap-3 text-sm">
              <div className="w-5 h-5 rounded-full bg-sticker-green/20 flex items-center justify-center">
                <Check className="w-3 h-3 text-sticker-green" />
              </div>
              <span className="text-foreground font-medium">{feature}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Actions */}
      <ResponsiveDialogActions>
        <button
          ref={dismissButtonRef}
          onClick={onDismiss}
          className="flex-1 px-4 py-3 md:py-3 py-3.5 min-h-[52px] md:min-h-0 rounded-md bg-secondary text-secondary-foreground font-bold text-sm border-[3px] border-border shadow-[3px_3px_0_hsl(var(--border))] hover:translate-y-[-1px] hover:shadow-[4px_4px_0_hsl(var(--border))] transition-all"
        >
          Maybe Later
        </button>
        <ResponsiveDialogButton
          onClick={() => {
            // TODO: Implement upgrade flow
            onDismiss()
          }}
          variant="primary"
        >
          Upgrade Now ✨
        </ResponsiveDialogButton>
      </ResponsiveDialogActions>
    </ResponsiveDialog>
  )
}
