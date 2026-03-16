'use client'

import { useState } from 'react'
import { Zap, Lock } from 'lucide-react'
import { usePlanStore } from '@/lib/planStore'
import { UpgradePromptModal } from '@/components/ui/UpgradePromptModal'

interface AutoPublishIndicatorProps {
  hasAccount: boolean
  hasSchedule: boolean
  platform: string
}

export function AutoPublishIndicator({
  hasAccount,
  hasSchedule,
  platform,
}: AutoPublishIndicatorProps) {
  const canAutoPublish = usePlanStore((s) => s.hasFeature('autoPublish'))
  const initialized = usePlanStore((s) => s.initialized)
  const [showUpgrade, setShowUpgrade] = useState(false)
  const [waitlistJoined, setWaitlistJoined] = useState(false)

  if (!initialized || !hasAccount) return null
  if (platform === 'reddit') return null

  async function handleJoinWaitlist() {
    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feature: 'auto_publish' }),
      })
      if (res.ok) setWaitlistJoined(true)
    } catch {
      // Silently fail — modal stays open for retry
    }
  }

  if (canAutoPublish) {
    if (!hasSchedule) return null
    return (
      <div className="flex items-center gap-2 p-3 rounded-md bg-sticker-green/10 text-sticker-green text-sm border-2 border-sticker-green/30 mb-4 md:mb-6">
        <Zap className="w-4 h-4 shrink-0" />
        <span className="font-medium">This post will be auto-published at the scheduled time.</span>
      </div>
    )
  }

  return (
    <>
      <button
        onClick={() => setShowUpgrade(true)}
        className="flex items-center gap-2 p-3 rounded-md bg-primary/5 text-muted-foreground text-sm border-2 border-border hover:border-primary/30 transition-colors mb-4 md:mb-6 w-full text-left"
      >
        <Lock className="w-4 h-4 shrink-0" />
        <span className="font-medium">
          Upgrade to Pro to auto-publish — you'll be notified to publish manually.
        </span>
      </button>
      <UpgradePromptModal
        open={showUpgrade}
        onDismiss={() => setShowUpgrade(false)}
        mode="feature-locked"
        title="Auto-Publishing is a Pro feature"
        description="Scheduled posts will be published automatically to your connected accounts. No manual work needed."
        onJoinWaitlist={handleJoinWaitlist}
        waitlistJoined={waitlistJoined}
      />
    </>
  )
}
