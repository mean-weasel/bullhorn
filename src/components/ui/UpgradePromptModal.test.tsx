import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { UpgradePromptModal } from './UpgradePromptModal'

describe('UpgradePromptModal — feature-locked mode', () => {
  it('renders "Join Waitlist" button in feature-locked mode', () => {
    render(
      <UpgradePromptModal
        open={true}
        onDismiss={vi.fn()}
        mode="feature-locked"
        onJoinWaitlist={vi.fn()}
      />
    )
    expect(screen.getByText('Join Waitlist')).toBeDefined()
  })

  it('calls onJoinWaitlist when button clicked', () => {
    const onJoinWaitlist = vi.fn()
    render(
      <UpgradePromptModal
        open={true}
        onDismiss={vi.fn()}
        mode="feature-locked"
        onJoinWaitlist={onJoinWaitlist}
      />
    )
    fireEvent.click(screen.getByText('Join Waitlist'))
    expect(onJoinWaitlist).toHaveBeenCalled()
  })

  it('shows "You\'re on the list!" when waitlistJoined=true', () => {
    render(
      <UpgradePromptModal
        open={true}
        onDismiss={vi.fn()}
        mode="feature-locked"
        onJoinWaitlist={vi.fn()}
        waitlistJoined={true}
      />
    )
    expect(screen.getByText("You're on the list!")).toBeDefined()
  })

  it('hides progress bar in feature-locked mode', () => {
    const { container } = render(
      <UpgradePromptModal
        open={true}
        onDismiss={vi.fn()}
        mode="feature-locked"
        onJoinWaitlist={vi.fn()}
      />
    )
    expect(container.querySelector('.from-sticker-yellow')).toBeNull()
  })

  it('shows progress bar in resource-limit mode (default)', () => {
    const { container } = render(
      <UpgradePromptModal open={true} onDismiss={vi.fn()} currentCount={5} limit={10} />
    )
    expect(container.querySelector('.from-sticker-yellow')).not.toBeNull()
  })
})
