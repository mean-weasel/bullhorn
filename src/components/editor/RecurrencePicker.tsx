'use client'

import { useState, useMemo } from 'react'
import { cn } from '@/lib/utils'

interface RecurrencePickerProps {
  value: string | null
  onChange: (rule: string | null) => void
  scheduledAt?: string | null
  className?: string
}

/** RRULE BYDAY abbreviations indexed by JS Date.getDay() (0=Sun .. 6=Sat) */
const BYDAY = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'] as const

/** Human-readable day names indexed the same way */
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

type PresetKey = 'none' | 'daily' | 'weekly' | 'monthly' | 'custom'

function ruleToPreset(rule: string | null): PresetKey {
  if (!rule) return 'none'
  if (rule === 'FREQ=DAILY') return 'daily'
  if (rule.startsWith('FREQ=WEEKLY;BYDAY=')) return 'weekly'
  if (rule.startsWith('FREQ=MONTHLY;BYMONTHDAY=')) return 'monthly'
  return 'custom'
}

export default function RecurrencePicker({
  value,
  onChange,
  scheduledAt,
  className,
}: RecurrencePickerProps) {
  const [customInput, setCustomInput] = useState(value ?? '')
  const activePreset = ruleToPreset(value)

  const scheduledDate = useMemo(() => {
    if (!scheduledAt) return null
    const d = new Date(scheduledAt)
    return isNaN(d.getTime()) ? null : d
  }, [scheduledAt])

  const weeklyLabel = useMemo(() => {
    if (scheduledDate) {
      return `Weekly (${DAY_NAMES[scheduledDate.getDay()]})`
    }
    return `Weekly (${DAY_NAMES[new Date().getDay()]})`
  }, [scheduledDate])

  const monthlyLabel = useMemo(() => {
    if (scheduledDate) {
      return `Monthly (day ${scheduledDate.getDate()})`
    }
    return `Monthly (day ${new Date().getDate()})`
  }, [scheduledDate])

  function handlePresetChange(preset: PresetKey) {
    switch (preset) {
      case 'none':
        onChange(null)
        break
      case 'daily':
        onChange('FREQ=DAILY')
        break
      case 'weekly': {
        const day = scheduledDate ?? new Date()
        onChange(`FREQ=WEEKLY;BYDAY=${BYDAY[day.getDay()]}`)
        break
      }
      case 'monthly': {
        const day = scheduledDate ?? new Date()
        onChange(`FREQ=MONTHLY;BYMONTHDAY=${day.getDate()}`)
        break
      }
      case 'custom':
        // Switch to custom mode but don't fire onChange yet
        setCustomInput(value ?? '')
        onChange(value)
        break
    }
  }

  function handleCustomSubmit() {
    const trimmed = customInput.trim()
    onChange(trimmed || null)
  }

  const inputClass = cn(
    'w-full rounded-md bg-background px-3 py-2 text-sm',
    'border-[3px] border-border shadow-sticker-sm',
    'focus:outline-hidden focus:ring-2 focus:ring-primary/50'
  )

  return (
    <div className={cn('space-y-2', className)}>
      <label htmlFor="recurrence-select" className="block text-sm font-bold text-foreground">
        Repeat
      </label>

      <select
        id="recurrence-select"
        value={activePreset}
        onChange={(e) => handlePresetChange(e.target.value as PresetKey)}
        className={inputClass}
      >
        <option value="none">None</option>
        <option value="daily">Daily</option>
        <option value="weekly">{weeklyLabel}</option>
        <option value="monthly">{monthlyLabel}</option>
        <option value="custom">Custom...</option>
      </select>

      {activePreset === 'custom' && (
        <div className="flex gap-2">
          <input
            type="text"
            value={customInput}
            onChange={(e) => setCustomInput(e.target.value)}
            onBlur={handleCustomSubmit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCustomSubmit()
            }}
            placeholder="FREQ=WEEKLY;BYDAY=MO,WE,FR"
            className={cn(inputClass, 'flex-1')}
          />
        </div>
      )}
    </div>
  )
}
