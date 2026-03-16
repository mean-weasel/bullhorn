import { describe, it, expect } from 'vitest'
import { PLAN_FEATURES, PLAN_LIMITS } from './limits'

describe('PLAN_FEATURES', () => {
  it('free tier does not have autoPublish', () => {
    expect(PLAN_FEATURES.free.autoPublish).toBe(false)
  })

  it('pro tier has autoPublish', () => {
    expect(PLAN_FEATURES.pro.autoPublish).toBe(true)
  })

  it('every plan in PLAN_LIMITS has a matching PLAN_FEATURES entry', () => {
    for (const plan of Object.keys(PLAN_LIMITS)) {
      expect(PLAN_FEATURES).toHaveProperty(plan)
    }
  })
})
