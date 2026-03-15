import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
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

describe('mobile handleConfirm - date only', () => {
  it('confirms date-only mode with correct value', () => {
    const onChange = vi.fn()
    const { container } = render(
      <IOSDateTimePicker {...defaultProps} onChange={onChange} mode="date" data-testid="picker" />
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
})

describe('mobile handleConfirm - time with existing value', () => {
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
})

describe('mobile handleConfirm - time without existing value', () => {
  it('confirms time-only mode without existing value uses today', () => {
    const onChange = vi.fn()
    const { container } = render(
      <IOSDateTimePicker {...defaultProps} onChange={onChange} mode="time" data-testid="picker" />
    )
    fireEvent.click(screen.getByTestId('picker'))

    const timeInput = container.querySelector('input[type="time"]') as HTMLInputElement
    fireEvent.change(timeInput, { target: { value: '16:45' } })
    fireEvent.click(screen.getByText('Done'))

    expect(onChange).toHaveBeenCalledTimes(1)
    const calledDate = onChange.mock.calls[0][0] as Date
    expect(calledDate.getHours()).toBe(16)
    expect(calledDate.getMinutes()).toBe(45)
    const today = new Date()
    expect(calledDate.getFullYear()).toBe(today.getFullYear())
    expect(calledDate.getMonth()).toBe(today.getMonth())
    expect(calledDate.getDate()).toBe(today.getDate())
  })

  it('closes the sheet after confirm', () => {
    render(<IOSDateTimePicker {...defaultProps} mode="date" data-testid="picker" />)
    fireEvent.click(screen.getByTestId('picker'))
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Done'))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})

describe('mobile handleConfirm - datetime', () => {
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
    expect(calledDate.getMonth()).toBe(11)
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

    const dateInput = container.querySelector('input[type="date"]') as HTMLInputElement
    fireEvent.change(dateInput, { target: { value: '' } })
    fireEvent.click(screen.getByText('Done'))

    expect(onChange).toHaveBeenCalledWith(null)
  })
})

describe('mobile temp value initialization', () => {
  it('pre-populates date and time from value', () => {
    const testDate = new Date('2026-06-15T10:30:00')
    const { container } = render(
      <IOSDateTimePicker {...defaultProps} value={testDate} mode="datetime" data-testid="picker" />
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
    expect(dateInput.value).toBeTruthy()
    expect(dateInput.value).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

describe('mobile min/max constraints', () => {
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

describe('mobile preview rendering', () => {
  it('shows date preview in date mode', () => {
    const { container } = render(
      <IOSDateTimePicker {...defaultProps} mode="date" data-testid="picker" />
    )
    fireEvent.click(screen.getByTestId('picker'))

    const dateInput = container.querySelector('input[type="date"]') as HTMLInputElement
    fireEvent.change(dateInput, { target: { value: '2026-07-04' } })

    expect(screen.getByText(/Saturday, July 4, 2026/)).toBeInTheDocument()
  })

  it('shows time preview in time mode', () => {
    const { container } = render(
      <IOSDateTimePicker {...defaultProps} mode="time" data-testid="picker" />
    )
    fireEvent.click(screen.getByTestId('picker'))

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

describe('mobile className', () => {
  it('applies className to the mobile button', () => {
    render(<IOSDateTimePicker {...defaultProps} className="custom-class" data-testid="picker" />)
    const button = screen.getByTestId('picker')
    expect(button.className).toContain('custom-class')
  })
})
