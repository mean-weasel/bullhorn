import { describe, it, expect } from 'vitest'
import { parseJsonBody } from './auth'

describe('parseJsonBody (1/2)', () => {
  it('returns parsed data for valid JSON', async () => {
    const body = JSON.stringify({ name: 'test', value: 42 })
    const request = new Request('http://localhost', {
      method: 'POST',
      body,
      headers: { 'Content-Type': 'application/json' },
    })
    const result = await parseJsonBody(request)
    expect(result).toEqual({ data: { name: 'test', value: 42 } })
  })

  it('returns 400 Response for invalid JSON', async () => {
    const request = new Request('http://localhost', {
      method: 'POST',
      body: 'not json{{{',
      headers: { 'Content-Type': 'application/json' },
    })
    const result = await parseJsonBody(request)
    expect('error' in result).toBe(true)
    if ('error' in result) {
      expect(result.error.status).toBe(400)
      const body = await result.error.json()
      expect(body.error).toBe('Invalid JSON body')
    }
  })

  it('returns 400 Response for empty body', async () => {
    const request = new Request('http://localhost', {
      method: 'POST',
      body: '',
      headers: { 'Content-Type': 'application/json' },
    })
    const result = await parseJsonBody(request)
    expect('error' in result).toBe(true)
    if ('error' in result) {
      expect(result.error.status).toBe(400)
    }
  })
})

describe('parseJsonBody (2/2)', () => {
  it('works with generic type parameter', async () => {
    interface TestBody {
      name: string
    }
    const request = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ name: 'typed' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const result = await parseJsonBody<TestBody>(request)
    expect('data' in result).toBe(true)
    if ('data' in result) {
      expect(result.data.name).toBe('typed')
    }
  })
})
