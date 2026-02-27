import { rrulestr } from 'rrule'

/**
 * Expand a recurrence rule into N future occurrences from a start date.
 */
export function expandRecurrenceRule(rule: string, after: Date, count: number): Date[] {
  try {
    const rrule = rrulestr(`RRULE:${rule}`, { dtstart: after })
    return rrule.all((_, i) => i < count)
  } catch {
    return []
  }
}

/**
 * Get the next occurrence of a recurrence rule after a given date.
 */
export function getNextOccurrence(rule: string, after: Date): Date | null {
  try {
    const rrule = rrulestr(`RRULE:${rule}`, { dtstart: after })
    const next = rrule.after(after, false)
    return next
  } catch {
    return null
  }
}

/**
 * Get all occurrences of a recurrence rule within a date range.
 */
export function getOccurrencesInRange(rule: string, start: Date, end: Date): Date[] {
  try {
    const rrule = rrulestr(`RRULE:${rule}`, { dtstart: start })
    return rrule.between(start, end, true)
  } catch {
    return []
  }
}
