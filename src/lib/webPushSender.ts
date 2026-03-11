import webPush from 'web-push'
import { createClient as createSupabaseJsClient } from '@supabase/supabase-js'

// Configure VAPID (called once at module level)
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ''
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || ''
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:hello@bullhorn.to'

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webPush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)
}

function createServiceClient() {
  return createSupabaseJsClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      global: {
        fetch: (url, options) => fetch(url, { ...options, cache: 'no-store' }),
      },
    }
  )
}

interface PushPayload {
  title: string
  body: string
  url?: string
}

/**
 * Send Web Push notification to all subscriptions for a user.
 * Silently no-ops if VAPID keys are not configured.
 * Cleans up invalid subscriptions (410 Gone).
 */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<number> {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.warn('[web-push] VAPID keys not configured, skipping push')
    return 0
  }

  const supabase = createServiceClient()

  const { data: subscriptions, error } = await supabase
    .from('web_push_subscriptions')
    .select('id, endpoint, keys_p256dh, keys_auth')
    .eq('user_id', userId)

  if (error || !subscriptions?.length) {
    return 0
  }

  let sent = 0

  for (const sub of subscriptions) {
    const pushSubscription = {
      endpoint: sub.endpoint,
      keys: {
        p256dh: sub.keys_p256dh,
        auth: sub.keys_auth,
      },
    }

    try {
      await webPush.sendNotification(pushSubscription, JSON.stringify(payload))
      sent++
    } catch (err) {
      const statusCode = (err as { statusCode?: number }).statusCode
      if (statusCode === 410 || statusCode === 404) {
        // Subscription expired or invalid — clean up
        await supabase.from('web_push_subscriptions').delete().eq('id', sub.id)
        console.log(`[web-push] Removed expired subscription ${sub.id}`)
      } else {
        console.error(`[web-push] Failed to send to ${sub.endpoint}:`, err)
      }
    }
  }

  return sent
}
