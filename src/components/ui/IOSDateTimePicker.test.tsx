import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { IOSDateTimePicker } from './IOSDateTimePicker'
import { useIsMobile } from './IOSActionSheet'

// Mock useIsMobile - default to false (desktop mode)
vi.mock('./IOSActionSheet', () => ({
  useIsMobile: vi.fn(() => false),
}))

describe('IOSDateTimePicker', () => {
  const defaultProps = {
    value: null as Date | null,
    onChange: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders with default placeholder when no value', () => {
    render(<IOSDateTimePicker {...defaultProps} />)
    expect(screen.getByText('Select date & time')).toBeInTheDocument()
  })

  it('renders with custom placeholder', () => {
    render(<IOSDateTimePicker {...defaultProps} placeholder="Pick a date" />)
    expect(screen.getByText('Pick a date')).toBeInTheDocument()
  })

  it('renders date placeholder for date mode', () => {
    render(<IOSDateTimePicker {...defaultProps} mode="date" />)
    expect(screen.getByText('Select date')).toBeInTheDocument()
  })

  it('renders time placeholder for time mode', () => {
    render(<IOSDateTimePicker {...defaultProps} mode="time" />)
    expect(screen.getByText('Select time')).toBeInTheDocument()
  })

  it('displays formatted date when value is provided', () => {
    const testDate = new Date('2026-03-15T14:30:00')
    render(<IOSDateTimePicker {...defaultProps} value={testDate} mode="date" />)
    expect(screen.getByText('Mar 15, 2026')).toBeInTheDocument()
  })

  it('displays formatted time when value is provided in time mode', () => {
    const testDate = new Date('2026-03-15T14:30:00')
    render(<IOSDateTimePicker {...defaultProps} value={testDate} mode="time" />)
    expect(screen.getByText('2:30 PM')).toBeInTheDocument()
  })

  it('displays formatted datetime when value is provided', () => {
    const testDate = new Date('2026-03-15T14:30:00')
    render(<IOSDateTimePicker {...defaultProps} value={testDate} mode="datetime" />)
    expect(screen.getByText('Mar 15, 2026 2:30 PM')).toBeInTheDocument()
  })

  it('renders hidden date input in desktop date mode', () => {
    const { container } = render(<IOSDateTimePicker {...defaultProps} mode="date" />)
    const dateInput = container.querySelector('input[type="date"]')
    expect(dateInput).toBeInTheDocument()
  })

  it('renders hidden time input in desktop time mode', () => {
    const { container } = render(<IOSDateTimePicker {...defaultProps} mode="time" />)
    const timeInput = container.querySelector('input[type="time"]')
    expect(timeInput).toBeInTheDocument()
  })

  it('renders both date and time inputs in datetime mode', () => {
    const { container } = render(<IOSDateTimePicker {...defaultProps} mode="datetime" />)
    expect(container.querySelector('input[type="date"]')).toBeInTheDocument()
    expect(container.querySelector('input[type="time"]')).toBeInTheDocument()
  })

  it('calls onChange when date input value changes', () => {
    const onChange = vi.fn()
    const { container } = render(
      <IOSDateTimePicker {...defaultProps} onChange={onChange} mode="date" />
    )

    const dateInput = container.querySelector('input[type="date"]') as HTMLInputElement
    fireEvent.change(dateInput, { target: { value: '2026-06-15' } })

    expect(onChange).toHaveBeenCalledTimes(1)
    const calledDate = onChange.mock.calls[0][0] as Date
    expect(calledDate.getFullYear()).toBe(2026)
    expect(calledDate.getMonth()).toBe(5) // June (0-indexed)
    expect(calledDate.getDate()).toBe(15)
  })

  it('calls onChange with null when date input is cleared', () => {
    const onChange = vi.fn()
    const { container } = render(
      <IOSDateTimePicker
        {...defaultProps}
        onChange={onChange}
        mode="date"
        value={new Date('2026-06-15T12:00:00')}
      />
    )

    const dateInput = container.querySelector('input[type="date"]') as HTMLInputElement
    fireEvent.change(dateInput, { target: { value: '' } })

    expect(onChange).toHaveBeenCalledWith(null)
  })

  it('calls onChange when time input value changes', () => {
    const onChange = vi.fn()
    const { container } = render(
      <IOSDateTimePicker {...defaultProps} onChange={onChange} mode="time" />
    )

    const timeInput = container.querySelector('input[type="time"]') as HTMLInputElement
    fireEvent.change(timeInput, { target: { value: '09:45' } })

    expect(onChange).toHaveBeenCalledTimes(1)
    const calledDate = onChange.mock.calls[0][0] as Date
    expect(calledDate.getHours()).toBe(9)
    expect(calledDate.getMinutes()).toBe(45)
  })

  it('renders as disabled when disabled prop is true', () => {
    render(<IOSDateTimePicker {...defaultProps} disabled data-testid="picker" />)
    const button = screen.getByTestId('picker')
    expect(button).toBeDisabled()
  })

  it('applies data-testid prop', () => {
    render(<IOSDateTimePicker {...defaultProps} data-testid="my-picker" />)
    expect(screen.getByTestId('my-picker')).toBeInTheDocument()
  })

  it('sets min and max on date input', () => {
    // Use midday times to avoid timezone-related date shifts
    const minDate = new Date(2026, 0, 1, 12, 0, 0) // Jan 1, 2026 noon local
    const maxDate = new Date(2026, 11, 31, 12, 0, 0) // Dec 31, 2026 noon local
    const { container } = render(
      <IOSDateTimePicker {...defaultProps} mode="date" minDate={minDate} maxDate={maxDate} />
    )

    const dateInput = container.querySelector('input[type="date"]') as HTMLInputElement
    expect(dateInput.min).toBe('2026-01-01')
    expect(dateInput.max).toBe('2026-12-31')
  })

  describe('desktop button click handler', () => {
    it('calls showPicker on date input for date mode', () => {
      const showPickerMock = vi.fn()
      const { container } = render(
        <IOSDateTimePicker {...defaultProps} mode="date" data-testid="picker" />
      )
      const dateInput = container.querySelector('input[type="date"]') as HTMLInputElement
      dateInput.showPicker = showPickerMock

      fireEvent.click(screen.getByTestId('picker'))
      expect(showPickerMock).toHaveBeenCalled()
    })

    it('calls showPicker on time input for time mode', () => {
      const showPickerMock = vi.fn()
      const { container } = render(
        <IOSDateTimePicker {...defaultProps} mode="time" data-testid="picker" />
      )
      const timeInput = container.querySelector('input[type="time"]') as HTMLInputElement
      timeInput.showPicker = showPickerMock

      fireEvent.click(screen.getByTestId('picker'))
      expect(showPickerMock).toHaveBeenCalled()
    })

    it('calls showPicker on date input for datetime mode', () => {
      const showPickerMock = vi.fn()
      const { container } = render(
        <IOSDateTimePicker {...defaultProps} mode="datetime" data-testid="picker" />
      )
      const dateInput = container.querySelector('input[type="date"]') as HTMLInputElement
      dateInput.showPicker = showPickerMock

      fireEvent.click(screen.getByTestId('picker'))
      expect(showPickerMock).toHaveBeenCalled()
    })

    it('does not call showPicker when disabled', () => {
      const showPickerMock = vi.fn()
      const { container } = render(
        <IOSDateTimePicker {...defaultProps} mode="date" disabled data-testid="picker" />
      )
      const dateInput = container.querySelector('input[type="date"]') as HTMLInputElement
      dateInput.showPicker = showPickerMock

      fireEvent.click(screen.getByTestId('picker'))
      expect(showPickerMock).not.toHaveBeenCalled()
    })
  })

  describe('desktop date input preserves time in datetime mode', () => {
    it('keeps existing time when date changes with a value', () => {
      const onChange = vi.fn()
      const existingDate = new Date('2026-03-15T14:30:00')
      const { container } = render(
        <IOSDateTimePicker
          {...defaultProps}
          onChange={onChange}
          mode="datetime"
          value={existingDate}
        />
      )
      const dateInput = container.querySelector('input[type="date"]') as HTMLInputElement
      fireEvent.change(dateInput, { target: { value: '2026-04-20' } })

      expect(onChange).toHaveBeenCalledTimes(1)
      const calledDate = onChange.mock.calls[0][0] as Date
      expect(calledDate.getFullYear()).toBe(2026)
      expect(calledDate.getMonth()).toBe(3) // April
      expect(calledDate.getDate()).toBe(20)
      expect(calledDate.getHours()).toBe(14)
      expect(calledDate.getMinutes()).toBe(30)
    })

    it('uses 12:00 default time when no existing value', () => {
      const onChange = vi.fn()
      const { container } = render(
        <IOSDateTimePicker {...defaultProps} onChange={onChange} mode="datetime" />
      )
      const dateInput = container.querySelector('input[type="date"]') as HTMLInputElement
      fireEvent.change(dateInput, { target: { value: '2026-04-20' } })

      expect(onChange).toHaveBeenCalledTimes(1)
      const calledDate = onChange.mock.calls[0][0] as Date
      expect(calledDate.getHours()).toBe(12)
      expect(calledDate.getMinutes()).toBe(0)
    })
  })

  describe('desktop time input in datetime mode', () => {
    it('preserves date when time changes with existing value', () => {
      const onChange = vi.fn()
      const existingDate = new Date('2026-03-15T14:30:00')
      const { container } = render(
        <IOSDateTimePicker
          {...defaultProps}
          onChange={onChange}
          mode="datetime"
          value={existingDate}
        />
      )
      const timeInput = container.querySelector('input[type="time"]') as HTMLInputElement
      fireEvent.change(timeInput, { target: { value: '09:15' } })

      expect(onChange).toHaveBeenCalledTimes(1)
      const calledDate = onChange.mock.calls[0][0] as Date
      expect(calledDate.getFullYear()).toBe(2026)
      expect(calledDate.getMonth()).toBe(2) // March
      expect(calledDate.getDate()).toBe(15)
      expect(calledDate.getHours()).toBe(9)
      expect(calledDate.getMinutes()).toBe(15)
    })
  })

  describe('mobile mode', () => {
    beforeEach(() => {
      vi.mocked(useIsMobile).mockReturnValue(true)
    })

    afterEach(() => {
      vi.mocked(useIsMobile).mockReturnValue(false)
    })

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

    describe('handleConfirm', () => {
      it('confirms date-only mode with correct value', () => {
        const onChange = vi.fn()
        const { container } = render(
          <IOSDateTimePicker
            {...defaultProps}
            onChange={onChange}
            mode="date"
            data-testid="picker"
          />
        )
        fireEvent.click(screen.getByTestId('picker'))

        const dateInput = container.querySelector('input[type="date"]') as HTMLInputElement
        fireEvent.change(dateInput, { target: { value: '2026-07-04' } })
        fireEvent.click(screen.getByText('Done'))

        expect(onChange).toHaveBeenCalledTimes(1)
        const calledDate = onChange.mock.calls[0][0] as Date
        expect(calledDate.getFullYear()).toBe(2026)
        expect(calledDate.getMonth()).toBe(6) // July
        expect(calledDate.getDate()).toBe(4)
        expect(calledDate.getHours()).toBe(12) // Default noon for date-only
      })

      it('confirms time-only mode with existing value', () => {
        const onChange = vi.fn()
        const existingDate = new Date('2026-03-15T14:30:00')
        const { container } = render(
          <IOSDateTimePicker
            {...defaultProps}
            onChange={onChange}
            mode="time"
            value={existingDate}
            data-testid="picker"
          />
        )
        fireEvent.click(screen.getByTestId('picker'))

        const timeInput = container.querySelector('input[type="time"]') as HTMLInputElement
        fireEvent.change(timeInput, { target: { value: '09:15' } })
        fireEvent.click(screen.getByText('Done'))

        expect(onChange).toHaveBeenCalledTimes(1)
        const calledDate = onChange.mock.calls[0][0] as Date
        expect(calledDate.getHours()).toBe(9)
        expect(calledDate.getMinutes()).toBe(15)
        // Should preserve the original date
        expect(calledDate.getMonth()).toBe(2) // March
        expect(calledDate.getDate()).toBe(15)
      })

      it('confirms time-only mode without existing value uses today', () => {
        const onChange = vi.fn()
        const { container } = render(
          <IOSDateTimePicker
            {...defaultProps}
            onChange={onChange}
            mode="time"
            data-testid="picker"
          />
        )
        fireEvent.click(screen.getByTestId('picker'))

        const timeInput = container.querySelector('input[type="time"]') as HTMLInputElement
        fireEvent.change(timeInput, { target: { value: '16:45' } })
        fireEvent.click(screen.getByText('Done'))

        expect(onChange).toHaveBeenCalledTimes(1)
        const calledDate = onChange.mock.calls[0][0] as Date
        expect(calledDate.getHours()).toBe(16)
        expect(calledDate.getMinutes()).toBe(45)
        // Should use today's date
        const today = new Date()
        expect(calledDate.getFullYear()).toBe(today.getFullYear())
        expect(calledDate.getMonth()).toBe(today.getMonth())
        expect(calledDate.getDate()).toBe(today.getDate())
      })

      it('confirms datetime mode with both date and time', () => {
        const onChange = vi.fn()
        const { container } = render(
          <IOSDateTimePicker
            {...defaultProps}
            onChange={onChange}
            mode="datetime"
            data-testid="picker"
          />
        )
        fireEvent.click(screen.getByTestId('picker'))

        const dateInput = container.querySelector('input[type="date"]') as HTMLInputElement
        const timeInput = container.querySelector('input[type="time"]') as HTMLInputElement
        fireEvent.change(dateInput, { target: { value: '2026-12-25' } })
        fireEvent.change(timeInput, { target: { value: '08:00' } })
        fireEvent.click(screen.getByText('Done'))

        expect(onChange).toHaveBeenCalledTimes(1)
        const calledDate = onChange.mock.calls[0][0] as Date
        expect(calledDate.getFullYear()).toBe(2026)
        expect(calledDate.getMonth()).toBe(11) // December
        expect(calledDate.getDate()).toBe(25)
        expect(calledDate.getHours()).toBe(8)
        expect(calledDate.getMinutes()).toBe(0)
      })

      it('confirms datetime mode with null when tempDate is empty', () => {
        const onChange = vi.fn()
        const { container } = render(
          <IOSDateTimePicker
            {...defaultProps}
            onChange={onChange}
            mode="datetime"
            data-testid="picker"
          />
        )
        fireEvent.click(screen.getByTestId('picker'))

        // Clear the temp date that was auto-set
        const dateInput = container.querySelector('input[type="date"]') as HTMLInputElement
        fireEvent.change(dateInput, { target: { value: '' } })
        fireEvent.click(screen.getByText('Done'))

        expect(onChange).toHaveBeenCalledWith(null)
      })

      it('closes the sheet after confirm', () => {
        render(<IOSDateTimePicker {...defaultProps} mode="date" data-testid="picker" />)
        fireEvent.click(screen.getByTestId('picker'))
        expect(screen.getByRole('dialog')).toBeInTheDocument()

        fireEvent.click(screen.getByText('Done'))
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      })
    })

    describe('initializes temp values from existing value', () => {
      it('pre-populates date and time from value', () => {
        const testDate = new Date('2026-06-15T10:30:00')
        const { container } = render(
          <IOSDateTimePicker
            {...defaultProps}
            value={testDate}
            mode="datetime"
            data-testid="picker"
          />
        )
        fireEvent.click(screen.getByTestId('picker'))

        const dateInput = container.querySelector('input[type="date"]') as HTMLInputElement
        const timeInput = container.querySelector('input[type="time"]') as HTMLInputElement
        expect(dateInput.value).toBe('2026-06-15')
        expect(timeInput.value).toBe('10:30')
      })

      it('defaults to today/now when value is null', () => {
        const { container } = render(
          <IOSDateTimePicker {...defaultProps} mode="datetime" data-testid="picker" />
        )
        fireEvent.click(screen.getByTestId('picker'))

        const dateInput = container.querySelector('input[type="date"]') as HTMLInputElement
        // Should have today's date
        expect(dateInput.value).toBeTruthy()
        expect(dateInput.value).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      })
    })

    describe('min/max constraints on mobile', () => {
      it('applies min and max to mobile date input', () => {
        const minDate = new Date(2026, 0, 1, 12, 0, 0)
        const maxDate = new Date(2026, 11, 31, 12, 0, 0)
        const { container } = render(
          <IOSDateTimePicker
            {...defaultProps}
            mode="date"
            minDate={minDate}
            maxDate={maxDate}
            data-testid="picker"
          />
        )
        fireEvent.click(screen.getByTestId('picker'))

        const dateInput = container.querySelector('input[type="date"]') as HTMLInputElement
        expect(dateInput.min).toBe('2026-01-01')
        expect(dateInput.max).toBe('2026-12-31')
      })
    })

    describe('preview rendering', () => {
      it('shows date preview in date mode', () => {
        const { container } = render(
          <IOSDateTimePicker {...defaultProps} mode="date" data-testid="picker" />
        )
        fireEvent.click(screen.getByTestId('picker'))

        const dateInput = container.querySelector('input[type="date"]') as HTMLInputElement
        fireEvent.change(dateInput, { target: { value: '2026-07-04' } })

        // Preview should show the formatted date
        expect(screen.getByText(/Saturday, July 4, 2026/)).toBeInTheDocument()
      })

      it('shows time preview in time mode', () => {
        const { container } = render(
          <IOSDateTimePicker {...defaultProps} mode="time" data-testid="picker" />
        )
        fireEvent.click(screen.getByTestId('picker'))

        // tempDate is set from default (today), but preview for time
        // mode shows time format. We need tempDate truthy for preview.
        const timeInput = container.querySelector('input[type="time"]') as HTMLInputElement
        fireEvent.change(timeInput, { target: { value: '14:30' } })

        expect(screen.getByText('2:30 PM')).toBeInTheDocument()
      })

      it('shows datetime preview in datetime mode', () => {
        const { container } = render(
          <IOSDateTimePicker {...defaultProps} mode="datetime" data-testid="picker" />
        )
        fireEvent.click(screen.getByTestId('picker'))

        const dateInput = container.querySelector('input[type="date"]') as HTMLInputElement
        const timeInput = container.querySelector('input[type="time"]') as HTMLInputElement
        fireEvent.change(dateInput, { target: { value: '2026-12-25' } })
        fireEvent.change(timeInput, { target: { value: '08:00' } })

        expect(screen.getByText(/Friday, December 25, 2026 at 8:00 AM/)).toBeInTheDocument()
      })
    })

    it('applies className to the mobile button', () => {
      render(<IOSDateTimePicker {...defaultProps} className="custom-class" data-testid="picker" />)
      const button = screen.getByTestId('picker')
      expect(button.className).toContain('custom-class')
    })
  })
})
