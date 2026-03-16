import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

const mockHasFeature = vi.fn()
vi.mock('@/lib/planStore', () => ({
  usePlanStore: vi.fn((selector) =>
    selector({
      hasFeature: mockHasFeature,
      initialized: true,
      features: {},
    })
  ),
}))

import { AutoPublishIndicator } from './AutoPublishIndicator'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('AutoPublishIndicator', () => {
  it('returns null when hasAccount is false', () => {
    mockHasFeature.mockReturnValue(true)
    const { container } = render(
      <AutoPublishIndicator hasAccount={false} hasSchedule={true} platform="twitter" />
    )
    expect(container.innerHTML).toBe('')
  })

  it('returns null for reddit platform', () => {
    mockHasFeature.mockReturnValue(true)
    const { container } = render(
      <AutoPublishIndicator hasAccount={true} hasSchedule={true} platform="reddit" />
    )
    expect(container.innerHTML).toBe('')
  })

  it('shows auto-publish badge for Pro user with schedule', () => {
    mockHasFeature.mockReturnValue(true)
    render(<AutoPublishIndicator hasAccount={true} hasSchedule={true} platform="twitter" />)
    expect(screen.getByText(/auto-published/i)).toBeDefined()
  })

  it('shows upgrade prompt for Free user', () => {
    mockHasFeature.mockReturnValue(false)
    render(<AutoPublishIndicator hasAccount={true} hasSchedule={true} platform="twitter" />)
    expect(screen.getByText(/upgrade to pro/i)).toBeDefined()
  })

  it('returns null for Pro user without schedule', () => {
    mockHasFeature.mockReturnValue(true)
    const { container } = render(
      <AutoPublishIndicator hasAccount={true} hasSchedule={false} platform="linkedin" />
    )
    expect(container.innerHTML).toBe('')
  })
})
