'use client'

import { IOSDateTimePicker } from '@/components/ui/IOSDateTimePicker'

interface SchedulePickerProps {
  scheduledAt: string | null
  onScheduleChange: (isoString: string | null) => void
  className?: string
}

export const SchedulePicker = ({
  scheduledAt,
  onScheduleChange,
  className,
}: SchedulePickerProps) => {
  const handleDateChange = (date: Date | null) => {
    if (date) {
      // Clamp to current time if the selected datetime is in the past
      const now = new Date()
      onScheduleChange(date < now ? now.toISOString() : date.toISOString())
    } else {
      onScheduleChange(null)
    }
  }

  return (
    <div className={className}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            Schedule Date
          </label>
          <IOSDateTimePicker
            value={scheduledAt ? new Date(scheduledAt) : null}
            onChange={handleDateChange}
            mode="date"
            placeholder="Select date"
            minDate={new Date()}
            data-testid="main-schedule-date"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            Time
          </label>
          <IOSDateTimePicker
            value={scheduledAt ? new Date(scheduledAt) : null}
            onChange={handleDateChange}
            mode="time"
            minDate={new Date()}
            placeholder="Select time"
            data-testid="main-schedule-time"
          />
        </div>
      </div>
    </div>
  )
}
