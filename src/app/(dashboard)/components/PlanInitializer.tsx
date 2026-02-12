'use client'

import { useEffect } from 'react'
import { usePlanStore } from '@/lib/planStore'

export function PlanInitializer() {
  const { fetchPlan, initialized } = usePlanStore()

  useEffect(() => {
    if (!initialized) {
      fetchPlan()
    }
  }, [initialized, fetchPlan])

  return null
}
