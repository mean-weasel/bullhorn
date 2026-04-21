'use client'

import { useEffect } from 'react'
import { usePlanStore } from '@/lib/planStore'

export function PlanInitializer() {
  const fetchPlan = usePlanStore((s) => s.fetchPlan)
  const initialized = usePlanStore((s) => s.initialized)

  useEffect(() => {
    if (!initialized) {
      fetchPlan()
    }
  }, [initialized, fetchPlan])

  return null
}
