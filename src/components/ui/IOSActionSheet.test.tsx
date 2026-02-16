import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { IOSActionSheet, type ActionSheetOption } from './IOSActionSheet'

const mockOptions: ActionSheetOption[] = [
  { value: 'edit', label: 'Edit' },
  { value: 'duplicate', label: 'Duplicate', description: 'Create a copy' },
  { value: 'delete', label: 'Delete', destructive: true },
]

const defaultProps = {
  open: true,
  onClose: vi.fn(),
  onSelect: vi.fn(),
  options: mockOptions,
}

describe('IOSActionSheet', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    document.body.style.overflow = ''
  })

  it('renders nothing when not open', () => {
    const { container } = render(<IOSActionSheet {...defaultProps} open={false} />)
    expect(container.firstChild).toBeNull()
  })

  it('shows all options when open', () => {
    render(<IOSActionSheet {...defaultProps} />)

    expect(screen.getByText('Edit')).toBeInTheDocument()
    expect(screen.getByText('Duplicate')).toBeInTheDocument()
    expect(screen.getByText('Delete')).toBeInTheDocument()
  })

  it('shows option descriptions', () => {
    render(<IOSActionSheet {...defaultProps} />)
    expect(screen.getByText('Create a copy')).toBeInTheDocument()
  })

  it('renders the title when provided', () => {
    render(<IOSActionSheet {...defaultProps} title="Choose an action" />)
    expect(screen.getByText('Choose an action')).toBeInTheDocument()
  })

  it('calls onSelect with the chosen option value and closes', () => {
    const onSelect = vi.fn()
    const onClose = vi.fn()
    render(<IOSActionSheet {...defaultProps} onSelect={onSelect} onClose={onClose} />)

    fireEvent.click(screen.getByText('Edit'))

    expect(onSelect).toHaveBeenCalledWith('edit')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when cancel button is clicked', () => {
    const onClose = vi.fn()
    render(<IOSActionSheet {...defaultProps} onClose={onClose} />)

    fireEvent.click(screen.getByText('Cancel'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('uses custom cancel text', () => {
    render(<IOSActionSheet {...defaultProps} cancelText="Dismiss" />)
    expect(screen.getByText('Dismiss')).toBeInTheDocument()
    expect(screen.queryByText('Cancel')).not.toBeInTheDocument()
  })

  it('calls onClose when backdrop is clicked', () => {
    const onClose = vi.fn()
    const { container } = render(<IOSActionSheet {...defaultProps} onClose={onClose} />)

    // Click the outer fixed wrapper div (has onClick={onClose})
    const outerWrapper = container.firstElementChild!
    fireEvent.click(outerWrapper)

    expect(onClose).toHaveBeenCalled()
  })

  it('does not call onClose when clicking inside the sheet content', () => {
    const onClose = vi.fn()
    render(<IOSActionSheet {...defaultProps} onClose={onClose} />)

    const dialog = screen.getByRole('dialog')
    fireEvent.click(dialog)

    // onClose should not be called from stopPropagation
    expect(onClose).not.toHaveBeenCalled()
  })

  it('calls onClose when Escape key is pressed', () => {
    const onClose = vi.fn()
    render(<IOSActionSheet {...defaultProps} onClose={onClose} />)

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('shows checkmark for the selected value', () => {
    render(<IOSActionSheet {...defaultProps} selectedValue="duplicate" />)

    // The Check icon from lucide-react should render as an SVG near the selected option
    const duplicateButton = screen.getByText('Duplicate').closest('button')!
    const svg = duplicateButton.querySelector('svg')
    expect(svg).toBeInTheDocument()
  })

  it('prevents body scroll when open', () => {
    render(<IOSActionSheet {...defaultProps} />)
    expect(document.body.style.overflow).toBe('hidden')
  })

  it('restores body scroll when closed', () => {
    const { unmount } = render(<IOSActionSheet {...defaultProps} />)
    expect(document.body.style.overflow).toBe('hidden')

    unmount()
    expect(document.body.style.overflow).toBe('')
  })

  it('uses default aria-label when no title provided', () => {
    render(<IOSActionSheet {...defaultProps} />)
    expect(screen.getByLabelText('Select an option')).toBeInTheDocument()
  })

  it('uses title as aria-label when title provided', () => {
    render(<IOSActionSheet {...defaultProps} title="Pick one" />)
    expect(screen.getByLabelText('Pick one')).toBeInTheDocument()
  })
})
