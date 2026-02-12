'use client'

import { useState, type ReactNode, type ReactElement, cloneElement } from 'react'
import { usePlanStore } from '@/lib/planStore'
import { RESOURCE_LABELS, type ResourceType } from '@/lib/limits'
import { UpgradePromptModal } from './UpgradePromptModal'

interface LimitGateProps {
  resource: Exclude<ResourceType, 'storageBytes'>
  children: ReactNode
}

export function LimitGate({ resource, children }: LimitGateProps) {
  const [showUpgrade, setShowUpgrade] = useState(false)
  const isAtLimit = usePlanStore((s) => s.isAtLimit(resource))
  const limitInfo = usePlanStore((s) => s.limits[resource])
  const initialized = usePlanStore((s) => s.initialized)

  // Before plan data loads, render children normally
  if (!initialized || !isAtLimit) {
    return <>{children}</>
  }

  // At limit: intercept clicks and show upgrade modal
  const label = RESOURCE_LABELS[resource]

  return (
    <>
      {cloneElement(children as ReactElement<Record<string, unknown>>, {
        onClick: (e: React.MouseEvent) => {
          e.preventDefault()
          e.stopPropagation()
          setShowUpgrade(true)
        },
        'aria-disabled': true,
        className:
          ((children as ReactElement<{ className?: string }>).props.className || '') +
          ' opacity-60 cursor-not-allowed',
      })}
      <UpgradePromptModal
        open={showUpgrade}
        onDismiss={() => setShowUpgrade(false)}
        title={`${label} limit reached`}
        description={`You've used all ${limitInfo.limit} ${label.toLowerCase()} on the free plan. Upgrade to Pro for higher limits.`}
        resourceName={label}
        currentCount={limitInfo.current}
        limit={limitInfo.limit}
      />
    </>
  )
}
