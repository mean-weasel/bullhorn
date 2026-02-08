import { describe, it, expect, vi, beforeEach } from 'vitest'
import { dedup, createDedupKey, clearInFlightRequests } from './requestDedup'

beforeEach(() => {
  clearInFlightRequests()
})

// ---------------------------------------------------------------------------
// dedup
// ---------------------------------------------------------------------------

describe('dedup', () => {
  it('executes the function and returns its result', async () => {
    const fn = vi.fn().mockResolvedValue('result')
    const result = await dedup('test-key', fn)
    expect(result).toBe('result')
    expect(fn).toHaveBeenCalledOnce()
  })

  it('deduplicates concurrent calls with the same key', async () => {
    let resolvePromise: (value: string) => void
    const fn = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          resolvePromise = resolve
        })
    )

    // Start two concurrent calls with the same key
    const promise1 = dedup('same-key', fn)
    const promise2 = dedup('same-key', fn)

    // Function should have been called only once
    expect(fn).toHaveBeenCalledOnce()

    // Function should not have been called a second time
    // (the dedup wraps via .finally, so promise references may differ,
    //  but the underlying fn is only invoked once)

    // Resolve and verify both get the same result
    resolvePromise!('shared-result')
    const [result1, result2] = await Promise.all([promise1, promise2])
    expect(result1).toBe('shared-result')
    expect(result2).toBe('shared-result')
  })

  it('allows different keys to execute independently', async () => {
    const fn1 = vi.fn().mockResolvedValue('result-1')
    const fn2 = vi.fn().mockResolvedValue('result-2')

    const [result1, result2] = await Promise.all([dedup('key-a', fn1), dedup('key-b', fn2)])

    expect(fn1).toHaveBeenCalledOnce()
    expect(fn2).toHaveBeenCalledOnce()
    expect(result1).toBe('result-1')
    expect(result2).toBe('result-2')
  })

  it('allows re-execution after the first call resolves', async () => {
    let callCount = 0
    const fn = vi.fn(async () => {
      callCount++
      return `call-${callCount}`
    })

    const result1 = await dedup('reuse-key', fn)
    expect(result1).toBe('call-1')

    // After the first promise resolved, calling again should execute again
    const result2 = await dedup('reuse-key', fn)
    expect(result2).toBe('call-2')
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('cleans up after a rejected promise', async () => {
    const fnFail = vi.fn().mockRejectedValue(new Error('boom'))
    const fnSuccess = vi.fn().mockResolvedValue('recovered')

    // First call fails
    await expect(dedup('error-key', fnFail)).rejects.toThrow('boom')

    // Same key should be available again after failure
    const result = await dedup('error-key', fnSuccess)
    expect(result).toBe('recovered')
    expect(fnSuccess).toHaveBeenCalledOnce()
  })

  it('propagates errors to all concurrent callers', async () => {
    let rejectPromise: (error: Error) => void
    const fn = vi.fn(
      () =>
        new Promise<string>((_, reject) => {
          rejectPromise = reject
        })
    )

    const promise1 = dedup('error-shared', fn)
    const promise2 = dedup('error-shared', fn)

    rejectPromise!(new Error('shared failure'))

    await expect(promise1).rejects.toThrow('shared failure')
    await expect(promise2).rejects.toThrow('shared failure')
    expect(fn).toHaveBeenCalledOnce()
  })
})

// ---------------------------------------------------------------------------
// createDedupKey
// ---------------------------------------------------------------------------

describe('createDedupKey', () => {
  it('returns the base key when no params are provided', () => {
    expect(createDedupKey('fetchProjects')).toBe('fetchProjects')
  })

  it('returns the base key when params is undefined', () => {
    expect(createDedupKey('fetchPosts', undefined)).toBe('fetchPosts')
  })

  it('returns the base key when params is empty', () => {
    expect(createDedupKey('fetchPosts', {})).toBe('fetchPosts')
  })

  it('appends sorted params to the base key', () => {
    const key = createDedupKey('fetchPosts', { status: 'draft', campaignId: 'camp-001' })
    // Params should be sorted alphabetically: campaignId before status
    expect(key).toBe('fetchPosts?campaignId=camp-001&status=draft')
  })

  it('filters out undefined param values', () => {
    const key = createDedupKey('fetchPosts', {
      status: 'draft',
      campaignId: undefined,
    })
    expect(key).toBe('fetchPosts?status=draft')
  })

  it('returns the base key when all param values are undefined', () => {
    const key = createDedupKey('fetchPosts', {
      a: undefined,
      b: undefined,
    })
    expect(key).toBe('fetchPosts')
  })

  it('generates consistent keys regardless of param insertion order', () => {
    const key1 = createDedupKey('fetch', { z: '1', a: '2', m: '3' })
    const key2 = createDedupKey('fetch', { a: '2', m: '3', z: '1' })
    expect(key1).toBe(key2)
  })

  it('handles numeric and boolean param values', () => {
    const key = createDedupKey('fetch', { page: 2, active: true })
    expect(key).toBe('fetch?active=true&page=2')
  })
})

// ---------------------------------------------------------------------------
// clearInFlightRequests
// ---------------------------------------------------------------------------

describe('clearInFlightRequests', () => {
  it('allows previously deduped keys to re-execute', async () => {
    let resolvePromise: (value: string) => void
    const fn = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          resolvePromise = resolve
        })
    )

    // Start a request but do not resolve it
    const promise1 = dedup('stale-key', fn)

    // Clear all in-flight
    clearInFlightRequests()

    // A new call with the same key should execute the function again
    const fn2 = vi.fn().mockResolvedValue('fresh')
    const result = await dedup('stale-key', fn2)
    expect(result).toBe('fresh')
    expect(fn2).toHaveBeenCalledOnce()

    // Resolve the original to avoid dangling promise
    resolvePromise!('old')
    await promise1
  })
})
