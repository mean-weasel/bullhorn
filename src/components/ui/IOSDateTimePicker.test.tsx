import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { IOSDateTimePicker } from './IOSDateTimePicker'

// Mock useIsMobile - default to false (desktop mode)
vi.mock('./IOSActionSheet', () => ({
  useIsMobile: vi.fn(() => false),
}))

const defaultProps = {
  value: null as Date | null,
  onChange: vi.fn(),
}

describe('IOSDateTimePicker - rendering', () => {
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

  it('renders as disabled when disabled prop is true', () => {
    render(<IOSDateTimePicker {...defaultProps} disabled data-testid="picker" />)
    const button = screen.getByTestId('picker')
    expect(button).toBeDisabled()
  })

  it('applies data-testid prop', () => {
    render(<IOSDateTimePicker {...defaultProps} data-testid="my-picker" />)
    expect(screen.getByTestId('my-picker')).toBeInTheDocument()
  })
})

describe('IOSDateTimePicker - hidden inputs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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

  it('sets min and max on date input', () => {
    const minDate = new Date(2026, 0, 1, 12, 0, 0)
    const maxDate = new Date(2026, 11, 31, 12, 0, 0)
    const { container } = render(
      <IOSDateTimePicker {...defaultProps} mode="date" minDate={minDate} maxDate={maxDate} />
    )
    const dateInput = container.querySelector('input[type="date"]') as HTMLInputElement
    expect(dateInput.min).toBe('2026-01-01')
    expect(dateInput.max).toBe('2026-12-31')
  })
})

describe('IOSDateTimePicker - onChange', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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
    expect(calledDate.getMonth()).toBe(5)
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
})

describe('IOSDateTimePicker - desktop button click', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

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

describe('IOSDateTimePicker - datetime preservation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

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
    expect(calledDate.getMonth()).toBe(3)
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
    const calledDate = onChange.mock.calls[0][0] as Date
    expect(calledDate.getHours()).toBe(12)
    expect(calledDate.getMinutes()).toBe(0)
  })
})

describe('IOSDateTimePicker - datetime preservation - continued', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

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
    const calledDate = onChange.mock.calls[0][0] as Date
    expect(calledDate.getMonth()).toBe(2)
    expect(calledDate.getDate()).toBe(15)
    expect(calledDate.getHours()).toBe(9)
    expect(calledDate.getMinutes()).toBe(15)
  })
})
