import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { IOSSegmentedControl } from './IOSSegmentedControl'

const mockOptions = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'archived', label: 'Archived' },
]

const defaultProps = {
  options: mockOptions,
  value: 'all' as string,
  onChange: vi.fn(),
}

describe('IOSSegmentedControl', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // --- Rendering ---

  it('renders all visible options as tabs', () => {
    render(<IOSSegmentedControl {...defaultProps} />)

    expect(screen.getByText('All')).toBeInTheDocument()
    expect(screen.getByText('Active')).toBeInTheDocument()
    expect(screen.getByText('Archived')).toBeInTheDocument()
  })

  it('renders a tablist container', () => {
    render(<IOSSegmentedControl {...defaultProps} />)
    expect(screen.getByRole('tablist')).toBeInTheDocument()
  })

  it('renders each option as a tab button', () => {
    render(<IOSSegmentedControl {...defaultProps} />)
    const tabs = screen.getAllByRole('tab')
    expect(tabs).toHaveLength(3)
  })

  it('renders with empty options array', () => {
    render(<IOSSegmentedControl options={[]} value="" onChange={vi.fn()} />)
    const tablist = screen.getByRole('tablist')
    expect(tablist).toBeInTheDocument()
    expect(screen.queryAllByRole('tab')).toHaveLength(0)
  })

  // --- Active state ---

  it('marks the active option with aria-selected=true', () => {
    render(<IOSSegmentedControl {...defaultProps} value="active" />)
    const tabs = screen.getAllByRole('tab')

    const allTab = tabs.find((t) => t.textContent?.includes('All'))!
    const activeTab = tabs.find((t) => t.textContent?.includes('Active'))!

    expect(activeTab).toHaveAttribute('aria-selected', 'true')
    expect(allTab).toHaveAttribute('aria-selected', 'false')
  })

  it('sets aria-selected=false on inactive options', () => {
    render(<IOSSegmentedControl {...defaultProps} value="all" />)
    const tabs = screen.getAllByRole('tab')

    const archivedTab = tabs.find((t) => t.textContent?.includes('Archived'))!
    expect(archivedTab).toHaveAttribute('aria-selected', 'false')
  })

  // --- Interaction ---

  it('calls onChange with the clicked option value', () => {
    const onChange = vi.fn()
    render(<IOSSegmentedControl {...defaultProps} onChange={onChange} />)

    fireEvent.click(screen.getByText('Active'))
    expect(onChange).toHaveBeenCalledWith('active')
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it('calls onChange when clicking the already-active option', () => {
    const onChange = vi.fn()
    render(<IOSSegmentedControl {...defaultProps} value="all" onChange={onChange} />)

    fireEvent.click(screen.getByText('All'))
    expect(onChange).toHaveBeenCalledWith('all')
  })

  // --- Hidden options ---

  it('does not render hidden options', () => {
    const optionsWithHidden = [
      { value: 'all', label: 'All' },
      { value: 'draft', label: 'Draft', hidden: true },
      { value: 'active', label: 'Active' },
    ]

    render(<IOSSegmentedControl options={optionsWithHidden} value="all" onChange={vi.fn()} />)

    expect(screen.getByText('All')).toBeInTheDocument()
    expect(screen.getByText('Active')).toBeInTheDocument()
    expect(screen.queryByText('Draft')).not.toBeInTheDocument()
    expect(screen.getAllByRole('tab')).toHaveLength(2)
  })

  // --- Count badges ---

  it('renders count badges when showCounts is true (default)', () => {
    const optionsWithCounts = [
      { value: 'all', label: 'All', count: 10 },
      { value: 'active', label: 'Active', count: 5 },
      { value: 'archived', label: 'Archived', count: 0 },
    ]

    render(<IOSSegmentedControl options={optionsWithCounts} value="all" onChange={vi.fn()} />)

    expect(screen.getByText('10')).toBeInTheDocument()
    expect(screen.getByText('5')).toBeInTheDocument()
    expect(screen.getByText('0')).toBeInTheDocument()
  })

  it('does not render count badges when showCounts is false', () => {
    const optionsWithCounts = [
      { value: 'all', label: 'All', count: 10 },
      { value: 'active', label: 'Active', count: 5 },
    ]

    render(
      <IOSSegmentedControl
        options={optionsWithCounts}
        value="all"
        onChange={vi.fn()}
        showCounts={false}
      />
    )

    expect(screen.queryByText('10')).not.toBeInTheDocument()
    expect(screen.queryByText('5')).not.toBeInTheDocument()
  })

  it('does not render count badge when count is undefined', () => {
    const optionsMixed = [
      { value: 'all', label: 'All', count: 10 },
      { value: 'active', label: 'Active' }, // no count
    ]

    render(<IOSSegmentedControl options={optionsMixed} value="all" onChange={vi.fn()} />)

    expect(screen.getByText('10')).toBeInTheDocument()
    // 'Active' tab should not have a count badge
    const activeTab = screen.getByText('Active').closest('button')!
    // Only the label should be in the tab, no extra numeric spans
    expect(activeTab.querySelectorAll('span')).toHaveLength(1) // just the label span
  })

  // --- Icons ---

  it('renders icons when provided in options', () => {
    const optionsWithIcons = [
      { value: 'all', label: 'All', icon: <span data-testid="icon-all">*</span> },
      { value: 'active', label: 'Active', icon: <span data-testid="icon-active">+</span> },
    ]

    render(<IOSSegmentedControl options={optionsWithIcons} value="all" onChange={vi.fn()} />)

    expect(screen.getByTestId('icon-all')).toBeInTheDocument()
    expect(screen.getByTestId('icon-active')).toBeInTheDocument()
  })

  // --- Disabled state ---

  it('applies disabled state to all buttons', () => {
    render(<IOSSegmentedControl {...defaultProps} disabled />)

    const tabs = screen.getAllByRole('tab')
    tabs.forEach((tab) => {
      expect(tab).toBeDisabled()
    })
  })

  it('does not call onChange when disabled', () => {
    const onChange = vi.fn()
    render(<IOSSegmentedControl {...defaultProps} onChange={onChange} disabled />)

    fireEvent.click(screen.getByText('Active'))
    expect(onChange).not.toHaveBeenCalled()
  })

  it('applies opacity to the container when disabled', () => {
    render(<IOSSegmentedControl {...defaultProps} disabled />)
    const tablist = screen.getByRole('tablist')
    expect(tablist.className).toContain('opacity-50')
  })

  // --- Sizes ---

  it('renders with small size classes', () => {
    render(<IOSSegmentedControl {...defaultProps} size="sm" />)
    const tabs = screen.getAllByRole('tab')
    expect(tabs[0].className).toContain('h-9')
    expect(tabs[0].className).toContain('text-xs')
  })

  it('renders with medium size classes (default)', () => {
    render(<IOSSegmentedControl {...defaultProps} />)
    const tabs = screen.getAllByRole('tab')
    expect(tabs[0].className).toContain('h-11')
    expect(tabs[0].className).toContain('text-sm')
  })

  it('renders with large size classes', () => {
    render(<IOSSegmentedControl {...defaultProps} size="lg" />)
    const tabs = screen.getAllByRole('tab')
    expect(tabs[0].className).toContain('h-13')
    expect(tabs[0].className).toContain('text-base')
  })

  // --- fullWidth ---

  it('applies full-width class to container when fullWidth is true', () => {
    render(<IOSSegmentedControl {...defaultProps} fullWidth />)
    const tablist = screen.getByRole('tablist')
    expect(tablist.className).toContain('w-full')
  })

  it('applies flex-1 to tabs when fullWidth is true', () => {
    render(<IOSSegmentedControl {...defaultProps} fullWidth />)
    const tabs = screen.getAllByRole('tab')
    tabs.forEach((tab) => {
      expect(tab.className).toContain('flex-1')
    })
  })

  // --- className ---

  it('applies custom className to the container', () => {
    render(<IOSSegmentedControl {...defaultProps} className="custom-class" />)
    const tablist = screen.getByRole('tablist')
    expect(tablist.className).toContain('custom-class')
  })

  // --- Accessibility ---

  it('has aria-label on the tablist', () => {
    render(<IOSSegmentedControl {...defaultProps} />)
    expect(screen.getByLabelText('Filter options')).toBeInTheDocument()
  })
})
