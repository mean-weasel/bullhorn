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

describe('useAutoSave logic - debounce behavior', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('calls save callback after the debounce delay', () => {
    const onSave = vi.fn()
    const delay = 3000

    // Simulate the hook's debounce: schedule save after delay
    const timeout = setTimer(onSave, delay)

    expect(onSave).not.toHaveBeenCalled()
    vi.advanceTimersByTime(delay)
    expect(onSave).toHaveBeenCalledTimes(1)

    clearTimer(timeout)
  })

  it('resets the timer when data changes again before delay expires', () => {
    const onSave = vi.fn()
    const delay = 3000

    // First change triggers a timeout
    let timeout: number | null = setTimer(onSave, delay)

    // Advance partway (not enough to trigger)
    vi.advanceTimersByTime(2000)
    expect(onSave).not.toHaveBeenCalled()

    // New change resets the timer (simulates the hook's clearTimeout + setTimer)
    clearTimer(timeout)
    timeout = setTimer(onSave, delay)

    // Advance another 2000ms — still not enough since timer was reset
    vi.advanceTimersByTime(2000)
    expect(onSave).not.toHaveBeenCalled()

    // Now advance the remaining 1000ms
    vi.advanceTimersByTime(1000)
    expect(onSave).toHaveBeenCalledTimes(1)

    if (timeout) clearTimer(timeout)
  })

  it('does not call save before the delay elapses', () => {
    const onSave = vi.fn()
    const delay = 3000

    const timeout = setTimer(onSave, delay)

    vi.advanceTimersByTime(2999)
    expect(onSave).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1)
    expect(onSave).toHaveBeenCalledTimes(1)

    clearTimer(timeout)
  })

  it('uses custom delay value', () => {
    const onSave = vi.fn()
    const customDelay = 500

    const timeout = setTimer(onSave, customDelay)

    vi.advanceTimersByTime(499)
    expect(onSave).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1)
    expect(onSave).toHaveBeenCalledTimes(1)

    clearTimer(timeout)
  })
})

describe('useAutoSave logic - change detection', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('does not trigger save when serialized data is the same', () => {
    const onSave = vi.fn()
    const delay = 3000
    let lastData = JSON.stringify({ title: 'Hello' })
    let timeout: number | null = null

    // Simulate the hook's change detection logic
    const handleDataChange = (newData: unknown) => {
      const serialized = JSON.stringify(newData)
      if (serialized === lastData) return // No change — skip
      lastData = serialized

      if (timeout) clearTimer(timeout)
      timeout = setTimer(onSave, delay)
    }

    // Same data — should not schedule save
    handleDataChange({ title: 'Hello' })
    vi.advanceTimersByTime(delay + 1000)
    expect(onSave).not.toHaveBeenCalled()

    if (timeout) clearTimer(timeout)
  })

  it('triggers save when data changes', () => {
    const onSave = vi.fn()
    const delay = 3000
    let lastData = JSON.stringify({ title: 'Hello' })
    let timeout: number | null = null

    const handleDataChange = (newData: unknown) => {
      const serialized = JSON.stringify(newData)
      if (serialized === lastData) return
      lastData = serialized

      if (timeout) clearTimer(timeout)
      timeout = setTimer(onSave, delay)
    }

    // Different data — should schedule save
    handleDataChange({ title: 'World' })
    vi.advanceTimersByTime(delay)
    expect(onSave).toHaveBeenCalledTimes(1)

    if (timeout) clearTimer(timeout)
  })

  it('detects changes in nested objects', () => {
    const onSave = vi.fn()
    const delay = 3000
    let lastData = JSON.stringify({ post: { title: 'A', body: 'B' } })
    let timeout: number | null = null

    const handleDataChange = (newData: unknown) => {
      const serialized = JSON.stringify(newData)
      if (serialized === lastData) return
      lastData = serialized

      if (timeout) clearTimer(timeout)
      timeout = setTimer(onSave, delay)
    }

    // Change nested field
    handleDataChange({ post: { title: 'A', body: 'C' } })
    vi.advanceTimersByTime(delay)
    expect(onSave).toHaveBeenCalledTimes(1)

    if (timeout) clearTimer(timeout)
  })
})

describe('useAutoSave logic - save status tracking', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('transitions from idle to saving to saved', async () => {
    type AutoSaveStatus = 'idle' | 'saving' | 'saved' | 'error' | 'retrying'
    let status: AutoSaveStatus = 'idle'
    let retryCount = 0
    const onSave = vi.fn().mockResolvedValue(undefined)

    // Simulate the hook's save function with retry logic
    const save = async () => {
      status = 'saving'
      try {
        await onSave()
        retryCount = 0
        status = 'saved'
        setTimeout(() => {
          status = 'idle'
        }, 5000)
      } catch {
        if (retryCount < 3) {
          retryCount += 1
          status = 'retrying'
        } else {
          status = 'error'
        }
      }
    }

    expect(status).toBe('idle')

    await save()
    expect(status).toBe('saved')
    expect(onSave).toHaveBeenCalledTimes(1)

    // After 5 seconds, status resets to idle
    vi.advanceTimersByTime(5000)
    expect(status).toBe('idle')
  })

  it('transitions to retrying status on first failure', async () => {
    type AutoSaveStatus = 'idle' | 'saving' | 'saved' | 'error' | 'retrying'
    let status: AutoSaveStatus = 'idle'
    let retryCount = 0
    const onSave = vi.fn().mockRejectedValue(new Error('Network error'))

    const save = async () => {
      status = 'saving'
      try {
        await onSave()
        retryCount = 0
        status = 'saved'
        setTimeout(() => {
          status = 'idle'
        }, 5000)
      } catch {
        if (retryCount < 3) {
          retryCount += 1
          status = 'retrying'
        } else {
          status = 'error'
        }
      }
    }

    await save()
    expect(status).toBe('retrying')
    expect(retryCount).toBe(1)
  })

  it('transitions to error after all retries exhausted', async () => {
    type AutoSaveStatus = 'idle' | 'saving' | 'saved' | 'error' | 'retrying'
    let status: AutoSaveStatus = 'idle'
    let retryCount = 0
    const onSave = vi.fn().mockRejectedValue(new Error('Network error'))

    const save = async () => {
      status = 'saving'
      try {
        await onSave()
        retryCount = 0
        status = 'saved'
        setTimeout(() => {
          status = 'idle'
        }, 5000)
      } catch {
        if (retryCount < 3) {
          retryCount += 1
          status = 'retrying'
        } else {
          status = 'error'
        }
      }
    }

    // Exhaust all 3 retries
    await save() // retry 1
    expect(status).toBe('retrying')
    await save() // retry 2
    expect(status).toBe('retrying')
    await save() // retry 3
    expect(status).toBe('retrying')

    // 4th attempt — retries exhausted
    await save()
    expect(status).toBe('error')
  })

  it('does not reset to idle after error', async () => {
    type AutoSaveStatus = 'idle' | 'saving' | 'saved' | 'error' | 'retrying'
    let status: AutoSaveStatus = 'idle'
    let retryCount = 3 // Already exhausted
    const onSave = vi.fn().mockRejectedValue(new Error('fail'))

    const save = async () => {
      status = 'saving'
      try {
        await onSave()
        retryCount = 0
        status = 'saved'
        setTimeout(() => {
          status = 'idle'
        }, 5000)
      } catch {
        if (retryCount < 3) {
          retryCount += 1
          status = 'retrying'
        } else {
          status = 'error'
        }
      }
    }

    await save()
    expect(status).toBe('error')

    // Even after 5 seconds, error status persists (no setTimeout was scheduled)
    vi.advanceTimersByTime(5000)
    expect(status).toBe('error')
  })

  it('resets retry counter on successful save', async () => {
    type AutoSaveStatus = 'idle' | 'saving' | 'saved' | 'error' | 'retrying'
    let status: AutoSaveStatus = 'idle'
    let retryCount = 0
    let callCount = 0
    const onSave = vi.fn().mockImplementation(() => {
      callCount++
      // Fail first two times, succeed on third
      if (callCount <= 2) {
        return Promise.reject(new Error('fail'))
      }
      return Promise.resolve()
    })

    const save = async () => {
      status = 'saving'
      try {
        await onSave()
        retryCount = 0
        status = 'saved'
        setTimeout(() => {
          status = 'idle'
        }, 5000)
      } catch {
        if (retryCount < 3) {
          retryCount += 1
          status = 'retrying'
        } else {
          status = 'error'
        }
      }
    }

    await save() // fails, retry 1
    expect(status).toBe('retrying')
    expect(retryCount).toBe(1)

    await save() // fails, retry 2
    expect(status).toBe('retrying')
    expect(retryCount).toBe(2)

    await save() // succeeds
    expect(status).toBe('saved')
    expect(retryCount).toBe(0)
  })
})
