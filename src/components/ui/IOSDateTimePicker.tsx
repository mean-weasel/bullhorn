'use client'

import { useState, useEffect, useRef } from 'react'
import { format } from 'date-fns'
import { Calendar, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useIsMobile } from './IOSActionSheet'

interface IOSDateTimePickerProps {
  value: Date | null
  onChange: (date: Date | null) => void
  mode?: 'date' | 'time' | 'datetime'
  placeholder?: string
  className?: string
  disabled?: boolean
  minDate?: Date
  maxDate?: Date
  'data-testid'?: string
}

export function IOSDateTimePicker({
  value,
  onChange,
  mode = 'datetime',
  placeholder,
  className,
  disabled = false,
  minDate,
  maxDate,
  'data-testid': dataTestId,
}: IOSDateTimePickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [tempDate, setTempDate] = useState<string>('')
  const [tempTime, setTempTime] = useState<string>('')
  const isMobile = useIsMobile()
  const dateInputRef = useRef<HTMLInputElement>(null)
  const timeInputRef = useRef<HTMLInputElement>(null)

  const handleOpen = () => {
    if (disabled) return
    if (value) {
      setTempDate(format(value, 'yyyy-MM-dd'))
      setTempTime(format(value, 'HH:mm'))
    } else {
      const now = new Date()
      setTempDate(format(now, 'yyyy-MM-dd'))
      setTempTime(format(now, 'HH:mm'))
    }
    setIsOpen(true)
  }

  // Handle escape key and prevent body scroll
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [isOpen])

  const handleConfirm = () => {
    if (mode === 'date') {
      onChange(tempDate ? new Date(`${tempDate}T12:00:00`) : null)
    } else if (mode === 'time' && value) {
      const dateStr = format(value, 'yyyy-MM-dd')
      onChange(new Date(`${dateStr}T${tempTime}:00`))
    } else if (mode === 'time') {
      const today = format(new Date(), 'yyyy-MM-dd')
      onChange(new Date(`${today}T${tempTime}:00`))
    } else {
      onChange(tempDate && tempTime ? new Date(`${tempDate}T${tempTime}:00`) : null)
    }
    setIsOpen(false)
  }

  const handleClear = () => {
    onChange(null)
    setIsOpen(false)
  }

  const getDisplayText = () => {
    if (!value) {
      return (
        placeholder ||
        (mode === 'time' ? 'Select time' : mode === 'date' ? 'Select date' : 'Select date & time')
      )
    }
    if (mode === 'date') {
      return format(value, 'MMM d, yyyy')
    }
    if (mode === 'time') {
      return format(value, 'h:mm a')
    }
    return format(value, 'MMM d, yyyy h:mm a')
  }

  const Icon = mode === 'time' ? Clock : Calendar

  // Desktop: use native picker via showPicker()
  if (!isMobile) {
    return (
      <div className={cn('relative', className)}>
        <button
          type="button"
          data-testid={dataTestId}
          onClick={() => {
            if (disabled) return
            if (mode === 'time' && timeInputRef.current) {
              timeInputRef.current.showPicker()
            } else if (dateInputRef.current) {
              dateInputRef.current.showPicker()
            }
          }}
          disabled={disabled}
          className={cn(
            'flex items-center gap-2 px-4 py-3 rounded-md border-[3px] w-full',
            'bg-card text-foreground text-sm text-left font-medium',
            'border-border shadow-sticker-sm',
            'hover:-translate-y-px hover:shadow-sticker',
            'transition-all duration-200',
            disabled && 'opacity-50 cursor-not-allowed hover:translate-y-0',
            !value && 'text-muted-foreground'
          )}
        >
          <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
          <span className="flex-1">{getDisplayText()}</span>
        </button>

        {/* Hidden inputs for desktop */}
        {(mode === 'date' || mode === 'datetime') && (
          <input
            ref={dateInputRef}
            type="date"
            data-testid={dataTestId ? `${dataTestId}-input` : undefined}
            value={value ? format(value, 'yyyy-MM-dd') : ''}
            min={minDate ? format(minDate, 'yyyy-MM-dd') : undefined}
            max={maxDate ? format(maxDate, 'yyyy-MM-dd') : undefined}
            onChange={(e) => {
              if (!e.target.value) {
                onChange(null)
                return
              }
              const time = value ? format(value, 'HH:mm') : '12:00'
              onChange(new Date(`${e.target.value}T${time}:00`))
            }}
            className="sr-only"
            tabIndex={-1}
          />
        )}
        {(mode === 'time' || mode === 'datetime') && (
          <input
            ref={timeInputRef}
            type="time"
            data-testid={dataTestId ? `${dataTestId}-input` : undefined}
            value={value ? format(value, 'HH:mm') : ''}
            onChange={(e) => {
              const dateStr = value ? format(value, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd')
              onChange(new Date(`${dateStr}T${e.target.value}:00`))
            }}
            className="sr-only"
            tabIndex={-1}
          />
        )}
      </div>
    )
  }

  // Mobile: iOS-style bottom sheet picker
  return (
    <>
      <button
        type="button"
        data-testid={dataTestId}
        onClick={handleOpen}
        disabled={disabled}
        className={cn(
          'flex items-center gap-2 px-4 py-3 rounded-md border-[3px] w-full',
          'bg-card text-foreground text-sm text-left font-medium',
          'border-border shadow-sticker-sm',
          'transition-all duration-200',
          disabled && 'opacity-50 cursor-not-allowed',
          !value && 'text-muted-foreground',
          className
        )}
      >
        <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
        <span className="flex-1">{getDisplayText()}</span>
      </button>

      {/* Bottom sheet picker */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center"
          onClick={() => setIsOpen(false)}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/40 backdrop-blur-xs animate-in fade-in duration-200" />

          {/* Sheet */}
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Select date and time"
            className={cn(
              'relative z-10 w-full max-w-lg',
              'bg-card border-[3px] border-b-0 border-border rounded-t-lg',
              'animate-in slide-in-from-bottom duration-300 ease-out'
            )}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b-2 border-border bg-secondary">
              <button
                type="button"
                onClick={handleClear}
                className="text-sm font-bold text-muted-foreground hover:text-foreground transition-colors"
              >
                Clear
              </button>
              <span className="text-sm font-extrabold">
                {mode === 'time'
                  ? '🕐 Select Time'
                  : mode === 'date'
                    ? '📅 Select Date'
                    : '📅 Select Date & Time'}
              </span>
              <button
                type="button"
                onClick={handleConfirm}
                className="text-sm font-bold text-primary hover:text-primary/80 transition-colors"
              >
                Done
              </button>
            </div>

            {/* Picker inputs */}
            <div className="p-6 space-y-4">
              {/* Date picker */}
              {(mode === 'date' || mode === 'datetime') && (
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                    Date
                  </label>
                  <div className="relative">
                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <input
                      type="date"
                      value={tempDate}
                      min={minDate ? format(minDate, 'yyyy-MM-dd') : undefined}
                      max={maxDate ? format(maxDate, 'yyyy-MM-dd') : undefined}
                      onChange={(e) => setTempDate(e.target.value)}
                      className={cn(
                        'w-full pl-12 pr-4 py-3 rounded-md',
                        'bg-card border-[3px] border-border',
                        'text-base text-foreground font-medium',
                        'shadow-sticker-sm',
                        'focus:outline-hidden focus:ring-2 focus:ring-primary/50'
                      )}
                    />
                  </div>
                </div>
              )}

              {/* Time picker */}
              {(mode === 'time' || mode === 'datetime') && (
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                    Time
                  </label>
                  <div className="relative">
                    <Clock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <input
                      type="time"
                      value={tempTime}
                      onChange={(e) => setTempTime(e.target.value)}
                      className={cn(
                        'w-full pl-12 pr-4 py-3 rounded-md',
                        'bg-card border-[3px] border-border',
                        'text-base text-foreground font-medium',
                        'shadow-sticker-sm',
                        'focus:outline-hidden focus:ring-2 focus:ring-primary/50'
                      )}
                    />
                  </div>
                </div>
              )}

              {/* Preview */}
              {tempDate && (
                <div className="pt-2 text-center">
                  <span className="inline-block px-4 py-2 bg-primary/10 rounded-md text-sm font-bold text-foreground">
                    {mode === 'date' &&
                      format(new Date(`${tempDate}T12:00:00`), 'EEEE, MMMM d, yyyy')}
                    {mode === 'time' &&
                      tempTime &&
                      format(new Date(`2024-01-01T${tempTime}:00`), 'h:mm a')}
                    {mode === 'datetime' &&
                      tempTime &&
                      format(
                        new Date(`${tempDate}T${tempTime}:00`),
                        "EEEE, MMMM d, yyyy 'at' h:mm a"
                      )}
                  </span>
                </div>
              )}
            </div>

            {/* Safe area spacer */}
            <div className="h-[env(safe-area-inset-bottom)]" />
          </div>
        </div>
      )}
    </>
  )
}
