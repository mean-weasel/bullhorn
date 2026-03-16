import { describe, it, expect, vi, beforeEach } from 'vitest'

let mockSend: ReturnType<typeof vi.fn>

vi.mock('resend', () => {
  mockSend = vi.fn().mockResolvedValue({ id: 'email-1' })
  return {
    Resend: vi.fn().mockImplementation(function () {
      return { emails: { send: mockSend } }
    }),
  }
})

let sendWaitlistConfirmation: typeof import('./emailSender').sendWaitlistConfirmation

beforeEach(async () => {
  vi.clearAllMocks()
  vi.unstubAllEnvs()
  vi.stubEnv('RESEND_API_KEY', 'test-key')
  vi.resetModules()
  const mod = await import('./emailSender')
  sendWaitlistConfirmation = mod.sendWaitlistConfirmation
})

describe('sendWaitlistConfirmation', () => {
  it('sends a confirmation email with feature name', async () => {
    const result = await sendWaitlistConfirmation('user@example.com', 'auto_publish')
    expect(result).toBe(true)
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'user@example.com',
        subject: expect.stringContaining('waitlist'),
      })
    )
  })

  it('returns false when RESEND_API_KEY is not set', async () => {
    vi.stubEnv('RESEND_API_KEY', '')
    vi.resetModules()

    const mod = await import('./emailSender')
    const result = await mod.sendWaitlistConfirmation('user@example.com', 'auto_publish')
    expect(result).toBe(false)
  })
})
