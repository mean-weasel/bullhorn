import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { IOSToggleSwitch } from './IOSToggleSwitch'

const defaultProps = {
  checked: false,
  onChange: vi.fn(),
}

describe('IOSToggleSwitch (1/4)', () => {
  it('renders a switch role element', () => {
    render(<IOSToggleSwitch {...defaultProps} />)
    expect(screen.getByRole('switch')).toBeInTheDocument()
  })

  it('renders unchecked by default', () => {
    render(<IOSToggleSwitch {...defaultProps} checked={false} />)
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false')
  })

  it('renders checked when checked=true', () => {
    render(<IOSToggleSwitch {...defaultProps} checked={true} />)
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true')
  })

  it('calls onChange with true when clicking an unchecked toggle', () => {
    const onChange = vi.fn()
    render(<IOSToggleSwitch {...defaultProps} checked={false} onChange={onChange} />)

    fireEvent.click(screen.getByRole('switch'))
    expect(onChange).toHaveBeenCalledWith(true)
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it('calls onChange with false when clicking a checked toggle', () => {
    const onChange = vi.fn()
    render(<IOSToggleSwitch {...defaultProps} checked={true} onChange={onChange} />)

    fireEvent.click(screen.getByRole('switch'))
    expect(onChange).toHaveBeenCalledWith(false)
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it('renders as disabled when disabled prop is true', () => {
    render(<IOSToggleSwitch {...defaultProps} disabled />)
    expect(screen.getByRole('switch')).toBeDisabled()
  })

  it('does not call onChange when disabled', () => {
    const onChange = vi.fn()
    render(<IOSToggleSwitch {...defaultProps} onChange={onChange} disabled />)

    fireEvent.click(screen.getByRole('switch'))
    expect(onChange).not.toHaveBeenCalled()
  })

  it('applies opacity when disabled', () => {
    render(<IOSToggleSwitch {...defaultProps} disabled />)
    const switchEl = screen.getByRole('switch')
    expect(switchEl.className).toContain('opacity-50')
  })
})

describe('IOSToggleSwitch (2/4)', () => {
  it('renders label text when provided', () => {
    render(<IOSToggleSwitch {...defaultProps} label="Enable notifications" />)
    expect(screen.getByText('Enable notifications')).toBeInTheDocument()
  })

  it('renders description text when provided', () => {
    render(
      <IOSToggleSwitch
        {...defaultProps}
        label="Notifications"
        description="Receive push notifications"
      />
    )
    expect(screen.getByText('Receive push notifications')).toBeInTheDocument()
  })

  it('renders label without description', () => {
    render(<IOSToggleSwitch {...defaultProps} label="Dark mode" />)
    expect(screen.getByText('Dark mode')).toBeInTheDocument()
  })

  it('renders only the switch button when no label or description', () => {
    const { container } = render(<IOSToggleSwitch {...defaultProps} />)
    // Without label/description, the root element should be the switch button itself
    const rootEl = container.firstElementChild!
    expect(rootEl.getAttribute('role')).toBe('switch')
  })

  it('wraps in a row layout when label is provided', () => {
    const { container } = render(<IOSToggleSwitch {...defaultProps} label="Dark mode" />)
    // With label, the root element is a wrapper button (not the switch itself)
    const rootEl = container.firstElementChild!
    expect(rootEl.getAttribute('role')).not.toBe('switch')
    expect(rootEl.tagName).toBe('BUTTON')
  })

  it('calls onChange when clicking the wrapper row (label area)', () => {
    const onChange = vi.fn()
    const { container } = render(
      <IOSToggleSwitch {...defaultProps} checked={false} onChange={onChange} label="Dark mode" />
    )

    // Click the outer wrapper button
    const wrapper = container.firstElementChild!
    fireEvent.click(wrapper)
    expect(onChange).toHaveBeenCalledWith(true)
  })
})

describe('IOSToggleSwitch (3/4)', () => {
  it('does not call onChange on wrapper click when disabled', () => {
    const onChange = vi.fn()
    const { container } = render(
      <IOSToggleSwitch {...defaultProps} onChange={onChange} label="Dark mode" disabled />
    )

    const wrapper = container.firstElementChild!
    fireEvent.click(wrapper)
    expect(onChange).not.toHaveBeenCalled()
  })

  it('uses label as aria-label for the inner switch (no label wrapper)', () => {
    // Without label prop, the switch button has role="switch" and uses aria-label
    render(<IOSToggleSwitch {...defaultProps} aria-label="Dark mode" />)
    const switchEl = screen.getByRole('switch')
    expect(switchEl).toHaveAttribute('aria-label', 'Dark mode')
  })

  it('uses aria-label prop when no label is provided', () => {
    render(<IOSToggleSwitch {...defaultProps} aria-label="Custom toggle" />)
    expect(screen.getByRole('switch')).toHaveAttribute('aria-label', 'Custom toggle')
  })

  it('does not render role=switch in the wrapper layout (label provided)', () => {
    // When label is provided, the component uses a wrapper button layout
    // without a nested role="switch" element — the wrapper button itself handles clicks
    const { container } = render(<IOSToggleSwitch {...defaultProps} label="Dark mode" />)
    const innerSwitch = container.querySelector('[role="switch"]')
    expect(innerSwitch).toBeNull()
  })

  it('renders the visual toggle track inside the wrapper layout', () => {
    const { container } = render(
      <IOSToggleSwitch {...defaultProps} label="Dark mode" checked={true} />
    )
    // The track div should exist inside the wrapper and show checked state
    const trackDiv = container.querySelector('.bg-sticker-green')
    expect(trackDiv).toBeInTheDocument()
  })

  it('renders with small size', () => {
    render(<IOSToggleSwitch {...defaultProps} size="sm" />)
    const switchEl = screen.getByRole('switch')
    expect(switchEl.className).toContain('w-9')
    expect(switchEl.className).toContain('h-5')
  })
})

describe('IOSToggleSwitch (4/4)', () => {
  it('renders with medium size (default)', () => {
    render(<IOSToggleSwitch {...defaultProps} />)
    const switchEl = screen.getByRole('switch')
    expect(switchEl.className).toContain('w-12')
    expect(switchEl.className).toContain('h-7')
  })

  it('renders with large size', () => {
    render(<IOSToggleSwitch {...defaultProps} size="lg" />)
    const switchEl = screen.getByRole('switch')
    expect(switchEl.className).toContain('w-14')
    expect(switchEl.className).toContain('h-8')
  })

  it('applies green background when checked', () => {
    render(<IOSToggleSwitch {...defaultProps} checked={true} />)
    const switchEl = screen.getByRole('switch')
    expect(switchEl.className).toContain('bg-sticker-green')
  })

  it('applies muted background when unchecked', () => {
    render(<IOSToggleSwitch {...defaultProps} checked={false} />)
    const switchEl = screen.getByRole('switch')
    expect(switchEl.className).toContain('bg-muted')
  })

  it('applies custom className when no label or description', () => {
    render(<IOSToggleSwitch {...defaultProps} className="custom-class" />)
    const switchEl = screen.getByRole('switch')
    expect(switchEl.className).toContain('custom-class')
  })

  it('applies custom className to wrapper when label is provided', () => {
    const { container } = render(
      <IOSToggleSwitch {...defaultProps} label="Dark mode" className="custom-wrapper" />
    )
    const wrapper = container.firstElementChild!
    expect(wrapper.className).toContain('custom-wrapper')
  })

  it('renders a thumb element with aria-hidden', () => {
    const { container } = render(<IOSToggleSwitch {...defaultProps} />)
    const thumb = container.querySelector('[aria-hidden="true"]')
    expect(thumb).toBeInTheDocument()
  })
})
