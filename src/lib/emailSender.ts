import { Resend } from 'resend'

const RESEND_API_KEY = process.env.RESEND_API_KEY || ''
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'Bullhorn <notifications@bullhorn.to>'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://bullhorn.to'

interface ReadyPost {
  id: string
  platform: string
  preview: string
}

/**
 * Send an email notification when a post becomes ready.
 * Silently no-ops if RESEND_API_KEY is not configured.
 */
export async function sendPostReadyEmail(userEmail: string, post: ReadyPost): Promise<boolean> {
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

/**
 * Send a single digest email when multiple posts become ready for the same user.
 * Falls back to sendPostReadyEmail for single-post batches.
 */
export async function sendPostsReadyEmail(userEmail: string, posts: ReadyPost[]): Promise<boolean> {
  if (posts.length === 0) return false
  if (posts.length === 1) return sendPostReadyEmail(userEmail, posts[0])

  if (!RESEND_API_KEY) {
    console.warn('[email] RESEND_API_KEY not configured, skipping email')
    return false
  }

  const resend = new Resend(RESEND_API_KEY)

  const postListHtml = posts
    .map((p) => {
      const truncated = p.preview.length > 80 ? p.preview.slice(0, 80) + '...' : p.preview
      const editUrl = `${APP_URL}/edit/${p.id}`
      return `
        <li style="margin: 0 0 12px;">
          <strong>${p.platform}</strong>: ${truncated || '(no preview)'}
          <br><a href="${editUrl}" style="color: #ce9a08; font-size: 13px;">Open post</a>
        </li>`
    })
    .join('')

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: userEmail,
      subject: `${posts.length} posts ready to publish`,
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #ce9a08; margin: 0 0 16px;">Posts Ready to Publish</h2>
          <p style="color: #333; margin: 0 0 12px;">
            You have <strong>${posts.length} posts</strong> ready:
          </p>
          <ul style="padding-left: 20px; color: #555;">${postListHtml}</ul>
          <a href="${APP_URL}/posts?status=ready" style="display: inline-block; background: #ce9a08; color: #fff; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: bold;">
            View All Ready Posts
          </a>
          <p style="color: #999; font-size: 12px; margin: 24px 0 0;">
            Sent by <a href="${APP_URL}" style="color: #ce9a08;">Bullhorn</a>
          </p>
        </div>
      `,
    })
    return true
  } catch (err) {
    console.error('[email] Failed to send digest:', err)
    return false
  }
}

const FEATURE_LABELS: Record<string, string> = {
  auto_publish: 'Auto-Publishing',
}

/**
 * Send a waitlist confirmation email.
 * Silently no-ops if RESEND_API_KEY is not configured.
 */
export async function sendWaitlistConfirmation(
  userEmail: string,
  feature: string
): Promise<boolean> {
  if (!RESEND_API_KEY) {
    console.warn('[email] RESEND_API_KEY not configured, skipping waitlist email')
    return false
  }

  const resend = new Resend(RESEND_API_KEY)
  const featureLabel = FEATURE_LABELS[feature] || feature

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: userEmail,
      subject: `You're on the ${featureLabel} waitlist!`,
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #ce9a08; margin: 0 0 16px;">You're on the list!</h2>
          <p style="color: #333; margin: 0 0 12px;">
            Thanks for your interest in <strong>${featureLabel}</strong> on Bullhorn.
          </p>
          <p style="color: #333; margin: 0 0 12px;">
            We'll notify you as soon as it's available. In the meantime, keep scheduling
            your posts — we'll let you know when they can go out automatically.
          </p>
          <p style="color: #999; font-size: 12px; margin: 24px 0 0;">
            Sent by <a href="${APP_URL}" style="color: #ce9a08;">Bullhorn</a>
          </p>
        </div>
      `,
    })
    return true
  } catch (err) {
    console.error('[email] Failed to send waitlist confirmation:', err)
    return false
  }
}
