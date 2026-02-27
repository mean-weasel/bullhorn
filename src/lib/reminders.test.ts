import { describe, it, expect } from 'vitest'
import { expandUpcomingReminders, Reminder } from './reminders'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a minimal Reminder for testing */
function makeReminder(overrides: Partial<Reminder> = {}): Reminder {
  return {
    id: 'r-1',
    title: 'Test reminder',
    remindAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days ahead
    isCompleted: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

// Fixed "now" for deterministic tests — a Wednesday
const NOW = new Date('2026-03-04T12:00:00.000Z')

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('reminder recurrence expansion', () => {
  it('expands a recurring reminder into multiple instances', () => {
    const weekly = makeReminder({
      id: 'weekly-1',
      title: 'Weekly standup',
      recurrenceRule: 'FREQ=WEEKLY',
      remindAt: NOW.toISOString(),
    })

    const results = expandUpcomingReminders([weekly], NOW, 50)

    // FREQ=WEEKLY over 30 days should produce ~4 instances
    expect(results.length).toBeGreaterThanOrEqual(3)
    expect(results.length).toBeLessThanOrEqual(5)

    // Each virtual instance should have a composite id
    for (const r of results) {
      expect(r.id).toMatch(/^weekly-1-/)
      expect(r.title).toBe('Weekly standup')
    }

    // Should be sorted ascending
    for (let i = 1; i < results.length; i++) {
      expect(new Date(results[i].remindAt).getTime()).toBeGreaterThanOrEqual(
        new Date(results[i - 1].remindAt).getTime()
      )
    }
  })

  it('does not expand one-time reminders', () => {
    const oneTime = makeReminder({
      id: 'once-1',
      title: 'One-time task',
      remindAt: new Date(NOW.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString(),
    })

    const results = expandUpcomingReminders([oneTime], NOW, 10)

    expect(results).toHaveLength(1)
    expect(results[0].id).toBe('once-1') // original id, not composite
    expect(results[0].title).toBe('One-time task')
  })

  it('does not expand completed reminders', () => {
    const completed = makeReminder({
      id: 'done-1',
      title: 'Completed weekly',
      recurrenceRule: 'FREQ=WEEKLY',
      isCompleted: true,
    })

    const results = expandUpcomingReminders([completed], NOW, 10)

    expect(results).toHaveLength(0)
  })

  it('filters out past one-time reminders', () => {
    const past = makeReminder({
      id: 'past-1',
      remindAt: new Date(NOW.getTime() - 24 * 60 * 60 * 1000).toISOString(), // yesterday
    })

    const results = expandUpcomingReminders([past], NOW, 10)

    expect(results).toHaveLength(0)
  })

  it('merges recurring and one-time reminders sorted by date', () => {
    const oneTime = makeReminder({
      id: 'once-1',
      title: 'One-time',
      remindAt: new Date(NOW.getTime() + 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days
    })

    const daily = makeReminder({
      id: 'daily-1',
      title: 'Daily check',
      recurrenceRule: 'FREQ=DAILY',
      remindAt: NOW.toISOString(),
    })

    const results = expandUpcomingReminders([oneTime, daily], NOW, 10)

    // Daily over 30 days produces many instances, plus 1 one-time — capped at 10
    expect(results).toHaveLength(10)

    // All results should be sorted by remindAt ascending
    for (let i = 1; i < results.length; i++) {
      expect(new Date(results[i].remindAt).getTime()).toBeGreaterThanOrEqual(
        new Date(results[i - 1].remindAt).getTime()
      )
    }

    // The one-time reminder should appear somewhere in the list
    const oneTimeInstance = results.find((r) => r.id === 'once-1')
    expect(oneTimeInstance).toBeDefined()
  })

  it('applies the limit parameter', () => {
    const daily = makeReminder({
      id: 'daily-1',
      recurrenceRule: 'FREQ=DAILY',
      remindAt: NOW.toISOString(),
    })

    const results3 = expandUpcomingReminders([daily], NOW, 3)
    expect(results3).toHaveLength(3)

    const results1 = expandUpcomingReminders([daily], NOW, 1)
    expect(results1).toHaveLength(1)
  })

  it('generates unique ids for each virtual instance', () => {
    const weekly = makeReminder({
      id: 'weekly-1',
      recurrenceRule: 'FREQ=WEEKLY',
      remindAt: NOW.toISOString(),
    })

    const results = expandUpcomingReminders([weekly], NOW, 10)
    const ids = results.map((r) => r.id)
    const uniqueIds = new Set(ids)

    expect(uniqueIds.size).toBe(ids.length)
  })

  it('preserves source reminder fields on virtual instances', () => {
    const weekly = makeReminder({
      id: 'weekly-1',
      title: 'Team sync',
      description: 'Weekly team sync meeting',
      recurrenceRule: 'FREQ=WEEKLY',
      sourceEventId: 'event-abc',
      campaignId: 'camp-1',
      remindAt: NOW.toISOString(),
    })

    const results = expandUpcomingReminders([weekly], NOW, 3)

    for (const r of results) {
      expect(r.title).toBe('Team sync')
      expect(r.description).toBe('Weekly team sync meeting')
      expect(r.sourceEventId).toBe('event-abc')
      expect(r.campaignId).toBe('camp-1')
      expect(r.recurrenceRule).toBe('FREQ=WEEKLY')
    }
  })
})
