import { describe, it, expect, afterEach } from 'vitest'
import { isSelfHosted } from './selfHosted'

describe('isSelfHosted', () => {
  afterEach(() => {
    delete process.env.SELF_HOSTED
  })

  it('returns true when SELF_HOSTED=true', () => {
    process.env.SELF_HOSTED = 'true'
    expect(isSelfHosted()).toBe(true)
  })

  it('returns false when SELF_HOSTED is not set', () => {
    delete process.env.SELF_HOSTED
    expect(isSelfHosted()).toBe(false)
  })

  it('returns false when SELF_HOSTED is any other value', () => {
    process.env.SELF_HOSTED = 'yes'
    expect(isSelfHosted()).toBe(false)
  })
})
