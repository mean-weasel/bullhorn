import { sign, createPrivateKey } from 'crypto'
import http2 from 'http2'
import { createClient as createSupabaseJsClient } from '@supabase/supabase-js'

const APNS_KEY_ID = process.env.APNS_KEY_ID || ''
const APNS_TEAM_ID = process.env.APNS_TEAM_ID || ''
const APNS_AUTH_KEY = process.env.APNS_AUTH_KEY || '' // Base64-encoded .p8 file contents
const APNS_BUNDLE_ID = process.env.APNS_BUNDLE_ID || 'to.bullhorn.app'
const APNS_ORIGIN =
  process.env.APNS_ENVIRONMENT === 'production'
    ? 'https://api.push.apple.com'
    : 'https://api.sandbox.push.apple.com'

// Cache JWT token for 50 minutes (APNs tokens valid for 60 min)
let cachedToken: string | null = null
let tokenTimestamp = 0
const TOKEN_TTL_MS = 50 * 60 * 1000

function base64url(input: string | Buffer): string {
  const buf = typeof input === 'string' ? Buffer.from(input) : input
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function createApnsJwt(): string | null {
  if (!APNS_KEY_ID || !APNS_AUTH_KEY || !APNS_TEAM_ID) return null

  const header = base64url(JSON.stringify({ alg: 'ES256', kid: APNS_KEY_ID }))
  const now = Math.floor(Date.now() / 1000)
  const claims = base64url(JSON.stringify({ iss: APNS_TEAM_ID, iat: now }))
  const signingInput = `${header}.${claims}`

  const pem = Buffer.from(APNS_AUTH_KEY, 'base64').toString('utf8')
  const key = createPrivateKey(pem)
  const signature = sign('sha256', Buffer.from(signingInput), {
    key,
    dsaEncoding: 'ieee-p1363',
  })

  return `${signingInput}.${base64url(signature)}`
}

function getApnsToken(): string | null {
  const now = Date.now()
  if (cachedToken && now - tokenTimestamp < TOKEN_TTL_MS) {
    return cachedToken
  }

  cachedToken = createApnsJwt()
  tokenTimestamp = now
  return cachedToken
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

interface ApnsPayload {
  title: string
  body: string
  url?: string
}

/**
 * Send a single push via HTTP/2 on an existing session.
 * Resolves with the APNS status, response body, and apns-id header.
 */
function sendOneApns(
  client: http2.ClientHttp2Session,
  deviceToken: string,
  jwtToken: string,
  body: string
): Promise<{ status: number; body: string; apnsId?: string }> {
  return new Promise((resolve, reject) => {
    const req = client.request({
      ':method': 'POST',
      ':path': `/3/device/${deviceToken}`,
      authorization: `bearer ${jwtToken}`,
      'apns-topic': APNS_BUNDLE_ID,
      'apns-push-type': 'alert',
      'apns-priority': '10',
      'content-type': 'application/json',
    })

    let data = ''
    let status = 0
    let apnsId: string | undefined

    req.on('response', (headers) => {
      status = (headers[':status'] as number) || 0
      apnsId = headers['apns-id'] as string | undefined
    })

    req.on('data', (chunk: Buffer) => {
      data += chunk.toString()
    })

    req.on('end', () => {
      resolve({ status, body: data, apnsId })
    })

    req.on('error', reject)

    req.end(body)
  })
}

/**
 * Send APNs push notification to all iOS device tokens for a user.
 * Uses HTTP/2 as required by APNS. Reuses a single connection for all devices.
 * Silently no-ops if APNs keys are not configured.
 * Cleans up invalid tokens (410 Gone).
 */
export async function sendApnsToUser(userId: string, payload: ApnsPayload): Promise<number> {
  const token = getApnsToken()
  if (!token) {
    console.warn('[apns] APNs keys not configured, skipping native push')
    return 0
  }

  const supabase = createServiceClient()

  const { data: devices, error } = await supabase
    .from('push_device_tokens')
    .select('id, token, platform')
    .eq('user_id', userId)
    .eq('platform', 'ios')

  if (error || !devices?.length) {
    return 0
  }

  const body = JSON.stringify({
    aps: {
      alert: { title: payload.title, body: payload.body },
      sound: 'default',
      badge: 1,
    },
    url: payload.url,
  })

  const client = http2.connect(APNS_ORIGIN)
  let sent = 0

  try {
    for (const device of devices) {
      try {
        const res = await sendOneApns(client, device.token, token, body)

        if (res.status === 200) {
          sent++
          console.log(`[apns] Sent to device ${device.id} (apns-id: ${res.apnsId})`)
        } else if (res.status === 410 || res.status === 404) {
          await supabase.from('push_device_tokens').delete().eq('id', device.id)
          console.log(`[apns] Removed invalid device token ${device.id}`)
        } else {
          console.error(`[apns] Failed to send to device ${device.id}: ${res.status} ${res.body}`)
        }
      } catch (err) {
        console.error(`[apns] Failed to send to device ${device.id}:`, err)
      }
    }
  } finally {
    client.close()
  }

  return sent
}
