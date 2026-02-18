import { describe, it, expect, vi, beforeEach } from 'vitest'
import { trackMilestone, getMilestoneCount } from './appReview'

vi.mock('./capacitor', () => ({
  isNativePlatform: vi.fn(() => false),
}))

// Mock localStorage since jsdom may not fully support it
const store: Record<string, string> = {}
const localStorageMock = {
  getItem: vi.fn((key: string) => store[key] ?? null),
  setItem: vi.fn((key: string, value: string) => {
    store[key] = value
  }),
  removeItem: vi.fn((key: string) => {
    delete store[key]
  }),
  clear: vi.fn(() => {
    Object.keys(store).forEach((key) => delete store[key])
  }),
  get length() {
    return Object.keys(store).length
  },
  key: vi.fn((index: number) => Object.keys(store)[index] ?? null),
}

Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true })

describe('appReview', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.keys(store).forEach((key) => delete store[key])
  })

  describe('getMilestoneCount', () => {
    it('returns 0 when no milestone stored', () => {
      expect(getMilestoneCount()).toBe(0)
    })

    it('returns stored count', () => {
      store['bullhorn-review-milestone'] = '10'
      expect(getMilestoneCount()).toBe(10)
    })
  })

  describe('trackMilestone', () => {
    it('increments the milestone count', async () => {
      await trackMilestone()
      expect(getMilestoneCount()).toBe(1)

      await trackMilestone()
      expect(getMilestoneCount()).toBe(2)
    })

    it('does not throw on web at milestone boundaries', async () => {
      // Set count to 4 so the next call hits milestone 5
      store['bullhorn-review-milestone'] = '4'
      await expect(trackMilestone()).resolves.toBeUndefined()
      expect(getMilestoneCount()).toBe(5)
    })

    it('respects cooldown period', async () => {
      // Simulate recent prompt
      store['bullhorn-review-milestone'] = '14'
      store['bullhorn-review-last-prompt'] = String(Date.now())

      await trackMilestone() // hits 15 but cooldown active
      expect(getMilestoneCount()).toBe(15)
    })
  })
})
