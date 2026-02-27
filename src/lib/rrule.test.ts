import { describe, it, expect } from 'vitest'
import { expandRecurrenceRule, getNextOccurrence, getOccurrencesInRange } from './rrule'

describe('expandRecurrenceRule', () => {
  it('expands a weekly Saturday rule', () => {
    const results = expandRecurrenceRule(
      'FREQ=WEEKLY;BYDAY=SA',
      new Date('2026-03-01T00:00:00Z'),
      5
    )
    expect(results).toHaveLength(5)
    results.forEach((d) => expect(d.getUTCDay()).toBe(6))
  })

  it('expands a daily rule', () => {
    const results = expandRecurrenceRule('FREQ=DAILY', new Date('2026-03-01T00:00:00Z'), 3)
    expect(results).toHaveLength(3)
    expect(results[1].getTime() - results[0].getTime()).toBe(86400000)
  })

  it('returns empty array for invalid rule', () => {
    const results = expandRecurrenceRule('INVALID', new Date(), 5)
    expect(results).toEqual([])
  })
})

describe('getNextOccurrence', () => {
  it('returns the next Saturday for weekly Saturday rule', () => {
    const next = getNextOccurrence('FREQ=WEEKLY;BYDAY=SA', new Date('2026-03-04T00:00:00Z'))
    expect(next).not.toBeNull()
    expect(next!.getUTCDay()).toBe(6)
    expect(next!.getTime()).toBeGreaterThan(new Date('2026-03-04T00:00:00Z').getTime())
  })

  it('returns null for invalid rule', () => {
    expect(getNextOccurrence('INVALID', new Date())).toBeNull()
  })
})

describe('getOccurrencesInRange', () => {
  it('returns occurrences within a date range', () => {
    const results = getOccurrencesInRange(
      'FREQ=WEEKLY;BYDAY=SA',
      new Date('2026-03-01T00:00:00Z'),
      new Date('2026-03-31T23:59:59Z')
    )
    expect(results.length).toBeGreaterThanOrEqual(4)
    expect(results.length).toBeLessThanOrEqual(5)
    results.forEach((d) => {
      expect(d.getTime()).toBeGreaterThanOrEqual(new Date('2026-03-01T00:00:00Z').getTime())
      expect(d.getTime()).toBeLessThanOrEqual(new Date('2026-03-31T23:59:59Z').getTime())
    })
  })

  it('handles multi-day rules (TU,WE,TH)', () => {
    const results = getOccurrencesInRange(
      'FREQ=WEEKLY;BYDAY=TU,WE,TH',
      new Date('2026-03-01T00:00:00Z'),
      new Date('2026-03-07T23:59:59Z')
    )
    expect(results.length).toBe(3)
  })
})
