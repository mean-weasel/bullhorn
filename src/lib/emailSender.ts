import { Resend } from 'resend'

const RESEND_API_KEY = process.env.RESEND_API_KEY || ''
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'Bullhorn <notifications@bullhorn.to>'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://bullhorn.to'

/**
 * Send an email notification when a post becomes ready.
 * Silently no-ops if RESEND_API_KEY is not configured.
 */
export async function sendPostReadyEmail(
  userEmail: string,
  post: { id: string; platform: string; preview: string }
): Promise<boolean> {
  if (!RESEND_API_KEY) {
    console.warn('[email] RESEND_API_KEY not configured, skipping email')
    return false
  }

  const resend = new Resend(RESEND_API_KEY)
  const truncated = post.preview.length > 120 ? post.preview.slice(0, 120) + '...' : post.preview
  const editUrl = `${APP_URL}/edit/${post.id}`

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: userEmail,
      subject: `Ready to publish on ${post.platform}`,
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #ce9a08; margin: 0 0 16px;">Ready to Publish</h2>
          <p style="color: #333; margin: 0 0 12px;">
            Your scheduled <strong>${post.platform}</strong> post is ready:
          </p>
          <blockquote style="border-left: 3px solid #ce9a08; padding: 8px 12px; margin: 0 0 16px; color: #555; background: #faf5eb;">
            ${truncated}
          </blockquote>
          <a href="${editUrl}" style="display: inline-block; background: #ce9a08; color: #fff; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: bold;">
            Open Post
          </a>
          <p style="color: #999; font-size: 12px; margin: 24px 0 0;">
            Sent by <a href="${APP_URL}" style="color: #ce9a08;">Bullhorn</a>
          </p>
        </div>
      `,
    })
    return true
  } catch (err) {
    console.error('[email] Failed to send:', err)
    return false
  }
}
