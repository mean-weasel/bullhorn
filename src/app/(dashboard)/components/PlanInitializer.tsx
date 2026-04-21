'use client'

import { useEffect } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { usePlanStore } from '@/lib/planStore'

export function PlanInitializer() {
  const { fetchPlan, initialized } = usePlanStore(
    useShallow((s) => ({ fetchPlan: s.fetchPlan, initialized: s.initialized }))
  )

  useEffect(() => {
    if (!initialized) {
      fetchPlan()
    }
  }, [initialized, fetchPlan])

  return null
}
