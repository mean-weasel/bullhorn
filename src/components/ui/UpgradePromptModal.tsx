'use client'

import { useEffect, useRef } from 'react'
import { Check } from 'lucide-react'
import {
  ResponsiveDialog,
  ResponsiveDialogDescription,
  ResponsiveDialogActions,
} from './ResponsiveDialog'
import { cn } from '@/lib/utils'

interface UpgradePromptModalProps {
  open: boolean
  onDismiss: () => void
  title?: string
  description?: string
  resourceName?: string
  currentCount?: number
  limit?: number
  mode?: 'resource-limit' | 'feature-locked'
  onJoinWaitlist?: () => void
  waitlistJoined?: boolean
}

const UPCOMING_FEATURES = [
  'Auto-publishing to Twitter, LinkedIn, and Reddit',
  'Analytics dashboards',
  'Team collaboration',
  'Higher limits on all resources',
]

// eslint-disable-next-line max-lines-per-function -- component JSX rendering, extraction would fragment UI
export function UpgradePromptModal({
  open,
  onDismiss,
  title = "You've reached the beta limit",
  description = 'Bullhorn is free during beta. Paid plans with higher limits are coming soon.',
  resourceName = 'Resources',
  currentCount = 3,
  limit = 3,
  mode = 'resource-limit',
  onJoinWaitlist,
  waitlistJoined,
}: UpgradePromptModalProps) {
  const dismissButtonRef = useRef<HTMLButtonElement>(null)

  // Focus dismiss button when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => dismissButtonRef.current?.focus(), 100)
    }
  }, [open])

  const iconWrapper = (
    <div className="w-14 h-14 rounded-lg bg-primary/10 flex items-center justify-center text-3xl border-[3px] border-border shadow-sticker-sm">
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
      {mode !== 'feature-locked' && (
        <div className="mb-6 p-4 rounded-md bg-card border-[3px] border-border shadow-sticker-sm">
          <div className="flex items-center justify-between text-sm mb-3">
            <span className="text-muted-foreground font-medium">{resourceName} used</span>
            <span className="font-bold text-foreground">
              {currentCount} / {limit}
            </span>
          </div>
          <div className="h-3 bg-muted rounded-full overflow-hidden border-2 border-border">
            <div
              className="h-full bg-linear-to-r from-sticker-yellow via-sticker-pink to-sticker-purple rounded-full transition-all"
              style={{ width: `${Math.min((currentCount / limit) * 100, 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Upcoming pro features */}
      <div className="mb-6">
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
          Coming Soon
        </p>
        <ul className="space-y-2">
          {UPCOMING_FEATURES.map((feature) => (
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
        {mode === 'feature-locked' && onJoinWaitlist && (
          <button
            onClick={waitlistJoined ? undefined : onJoinWaitlist}
            disabled={waitlistJoined}
            className={cn(
              'flex-1 px-4 py-3 md:py-3 py-3.5 min-h-[52px] md:min-h-0 rounded-md font-bold text-sm border-[3px] border-border shadow-sticker-sm transition-all',
              waitlistJoined
                ? 'bg-sticker-green text-white cursor-default'
                : 'bg-accent text-white hover:-translate-y-px hover:shadow-sticker'
            )}
          >
            {waitlistJoined ? "You're on the list!" : 'Join Waitlist'}
          </button>
        )}
        <button
          ref={dismissButtonRef}
          onClick={onDismiss}
          className="flex-1 px-4 py-3 md:py-3 py-3.5 min-h-[52px] md:min-h-0 rounded-md bg-primary text-primary-foreground font-bold text-sm border-[3px] border-border shadow-sticker-sm hover:-translate-y-px hover:shadow-sticker transition-all"
        >
          Got It
        </button>
      </ResponsiveDialogActions>
    </ResponsiveDialog>
  )
}
