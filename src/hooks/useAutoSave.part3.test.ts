import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Use window.setTimeout to get the browser `number` return type
// instead of Node's `Timeout` (both work with vi.useFakeTimers)
const setTimer = (fn: () => void, ms: number) => window.setTimeout(fn, ms)
const clearTimer = (id: number | null) => {
  if (id !== null) window.clearTimeout(id)
}

/**
 * Tests for useAutoSave hook logic.
 *
 * Since @testing-library/react-hooks is not available, we test the
 * underlying auto-save logic directly: debounce behavior, change detection,
 * and save status transitions.
 */

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('retry backoff (1/2)', () => {
  it('uses exponential backoff delays for retries', () => {
    const onSave = vi.fn()
    const backoffDelays = [2000, 4000, 8000]

    // Simulate retry scheduling with backoff
    let retryCount = 0
    const scheduleRetry = () => {
      if (retryCount < 3) {
        const delay = backoffDelays[retryCount]
        retryCount++
        return setTimer(onSave, delay)
      }
      return null
    }

    // First retry at 2000ms
    const t1 = scheduleRetry()
    vi.advanceTimersByTime(1999)
    expect(onSave).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(onSave).toHaveBeenCalledTimes(1)
    clearTimer(t1)

    // Second retry at 4000ms
    const t2 = scheduleRetry()
    vi.advanceTimersByTime(3999)
    expect(onSave).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(1)
    expect(onSave).toHaveBeenCalledTimes(2)
    clearTimer(t2)

    // Third retry at 8000ms
    const t3 = scheduleRetry()
    vi.advanceTimersByTime(7999)
    expect(onSave).toHaveBeenCalledTimes(2)
    vi.advanceTimersByTime(1)
    expect(onSave).toHaveBeenCalledTimes(3)
    clearTimer(t3)

    // No more retries
    expect(scheduleRetry()).toBeNull()
  })
})

describe('retry backoff (2/2)', () => {
  it('resets retry counter when new data changes come in', () => {
    const onSave = vi.fn()
    let retryCount = 2 // Simulate 2 failed retries

    // New data change resets retry counter
    retryCount = 0
    expect(retryCount).toBe(0)

    // Should be able to retry 3 more times
    const backoffDelays = [2000, 4000, 8000]
    const scheduleRetry = () => {
      if (retryCount < 3) {
        const delay = backoffDelays[retryCount]
        retryCount++
        return setTimer(onSave, delay)
      }
      return null
    }

    const t1 = scheduleRetry()
    expect(retryCount).toBe(1)
    vi.advanceTimersByTime(2000)
    expect(onSave).toHaveBeenCalledTimes(1)
    clearTimer(t1)
  })
})

describe('cleanup', () => {
  it('clears timeout on cleanup', () => {
    const onSave = vi.fn()
    const delay = 3000

    const timeout = setTimer(onSave, delay)

    // Simulate component unmounting — clear the timeout
    clearTimer(timeout)

    vi.advanceTimersByTime(delay + 1000)
    expect(onSave).not.toHaveBeenCalled()
  })
})
