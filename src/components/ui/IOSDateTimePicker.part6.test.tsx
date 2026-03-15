import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { IOSDateTimePicker } from './IOSDateTimePicker'
import { useIsMobile } from './IOSActionSheet'

// Mock useIsMobile - default to false (desktop mode)
vi.mock('./IOSActionSheet', () => ({
  useIsMobile: vi.fn(() => false),
}))

const defaultProps = {
  value: null as Date | null,
  onChange: vi.fn(),
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(useIsMobile).mockReturnValue(true)
})

afterEach(() => {
  vi.mocked(useIsMobile).mockReturnValue(false)
})

describe('IOSDateTimePicker (7/15)', () => {
  describe('mobile mode (1/9)', () => {
    it('renders mobile button with placeholder', () => {
      render(<IOSDateTimePicker {...defaultProps} data-testid="picker" />)
      expect(screen.getByTestId('picker')).toBeInTheDocument()
      expect(screen.getByText('Select date & time')).toBeInTheDocument()
    })

    it('renders mobile button with formatted value', () => {
      const testDate = new Date('2026-03-15T14:30:00')
      render(<IOSDateTimePicker {...defaultProps} value={testDate} />)
      expect(screen.getByText('Mar 15, 2026 2:30 PM')).toBeInTheDocument()
    })

    it('opens bottom sheet on click', () => {
      render(<IOSDateTimePicker {...defaultProps} data-testid="picker" />)
      fireEvent.click(screen.getByTestId('picker'))
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    it('does not open when disabled', () => {
      render(<IOSDateTimePicker {...defaultProps} disabled data-testid="picker" />)
      fireEvent.click(screen.getByTestId('picker'))
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('shows correct header for datetime mode', () => {
      render(<IOSDateTimePicker {...defaultProps} data-testid="picker" />)
      fireEvent.click(screen.getByTestId('picker'))
      expect(screen.getByText(/Select Date & Time/)).toBeInTheDocument()
    })

    it('shows correct header for date mode', () => {
      render(<IOSDateTimePicker {...defaultProps} mode="date" data-testid="picker" />)
      fireEvent.click(screen.getByTestId('picker'))
      expect(screen.getByText(/Select Date/)).toBeInTheDocument()
    })

    it('shows correct header for time mode', () => {
      render(<IOSDateTimePicker {...defaultProps} mode="time" data-testid="picker" />)
      fireEvent.click(screen.getByTestId('picker'))
      expect(screen.getByText(/Select Time/)).toBeInTheDocument()
    })

    it('renders date input in date mode bottom sheet', () => {
      const { container } = render(
        <IOSDateTimePicker {...defaultProps} mode="date" data-testid="picker" />
      )
      fireEvent.click(screen.getByTestId('picker'))
      expect(container.querySelector('input[type="date"]')).toBeInTheDocument()
      expect(container.querySelector('input[type="time"]')).not.toBeInTheDocument()
    })
  })
})

describe('IOSDateTimePicker (8/15)', () => {
  describe('mobile mode (2/9)', () => {
    it('renders time input in time mode bottom sheet', () => {
      const { container } = render(
        <IOSDateTimePicker {...defaultProps} mode="time" data-testid="picker" />
      )
      fireEvent.click(screen.getByTestId('picker'))
      expect(container.querySelector('input[type="time"]')).toBeInTheDocument()
      expect(container.querySelector('input[type="date"]')).not.toBeInTheDocument()
    })

    it('renders both inputs in datetime mode bottom sheet', () => {
      const { container } = render(
        <IOSDateTimePicker {...defaultProps} mode="datetime" data-testid="picker" />
      )
      fireEvent.click(screen.getByTestId('picker'))
      expect(container.querySelector('input[type="date"]')).toBeInTheDocument()
      expect(container.querySelector('input[type="time"]')).toBeInTheDocument()
    })

    it('closes on backdrop click', () => {
      render(<IOSDateTimePicker {...defaultProps} data-testid="picker" />)
      fireEvent.click(screen.getByTestId('picker'))
      expect(screen.getByRole('dialog')).toBeInTheDocument()

      // Click the backdrop (the outer fixed div)
      const backdrop = screen.getByRole('dialog').parentElement!
      fireEvent.click(backdrop)
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('does not close when clicking inside the dialog', () => {
      render(<IOSDateTimePicker {...defaultProps} data-testid="picker" />)
      fireEvent.click(screen.getByTestId('picker'))

      const dialog = screen.getByRole('dialog')
      fireEvent.click(dialog)
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    it('closes on Escape key', () => {
      render(<IOSDateTimePicker {...defaultProps} data-testid="picker" />)
      fireEvent.click(screen.getByTestId('picker'))
      expect(screen.getByRole('dialog')).toBeInTheDocument()

      act(() => {
        fireEvent.keyDown(document, { key: 'Escape' })
      })
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })
})

describe('IOSDateTimePicker (9/15)', () => {
  describe('mobile mode (3/9)', () => {
    it('sets body overflow hidden when open', () => {
      render(<IOSDateTimePicker {...defaultProps} data-testid="picker" />)
      fireEvent.click(screen.getByTestId('picker'))
      expect(document.body.style.overflow).toBe('hidden')
    })

    describe('handleClear', () => {
      it('calls onChange with null and closes sheet', () => {
        const onChange = vi.fn()
        render(
          <IOSDateTimePicker
            {...defaultProps}
            onChange={onChange}
            value={new Date('2026-03-15T14:30:00')}
            data-testid="picker"
          />
        )
        fireEvent.click(screen.getByTestId('picker'))
        fireEvent.click(screen.getByText('Clear'))

        expect(onChange).toHaveBeenCalledWith(null)
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      })
    })
  })
})
