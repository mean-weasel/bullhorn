import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const APNS_KEY_ID = Deno.env.get('APNS_KEY_ID')!
const APNS_TEAM_ID = Deno.env.get('APNS_TEAM_ID')!
const APNS_PRIVATE_KEY = Deno.env.get('APNS_PRIVATE_KEY')!
const APNS_BUNDLE_ID = Deno.env.get('APNS_BUNDLE_ID') || 'to.bullhorn.app'
const APNS_HOST = 'https://api.push.apple.com'

async function createJWT(): Promise<string> {
  const header = btoa(JSON.stringify({ alg: 'ES256', kid: APNS_KEY_ID }))
  const now = Math.floor(Date.now() / 1000)
  const payload = btoa(JSON.stringify({ iss: APNS_TEAM_ID, iat: now }))

  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToArrayBuffer(APNS_PRIVATE_KEY),
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  )

  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    new TextEncoder().encode(`${header}.${payload}`)
  )

  const sig = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

  return `${header}.${payload}.${sig}`
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const base64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\s/g, '')
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes.buffer
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  // Authenticate the caller via Supabase JWT
  const authHeader = req.headers.get('authorization')
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  const token = authHeader.replace('Bearer ', '')
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(token)

  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { userId, title, body, url } = await req.json()

  if (!userId || !title || !body) {
    return new Response(JSON.stringify({ error: 'userId, title, and body are required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Only allow sending push notifications to your own devices
  if (userId !== user.id) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { data: tokens, error } = await supabase
    .from('push_device_tokens')
    .select('token')
    .eq('user_id', userId)

  if (error) {
    console.error('Database error fetching push tokens:', error.message)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (!tokens || tokens.length === 0) {
    return new Response(JSON.stringify({ sent: 0 }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const jwt = await createJWT()
  let sent = 0

  for (const { token } of tokens) {
    const apnsPayload = {
      aps: {
        alert: { title, body },
        sound: 'default',
        badge: 1,
      },
      url: url || undefined,
    }

    const response = await fetch(`${APNS_HOST}/3/device/${token}`, {
      method: 'POST',
      headers: {
        authorization: `bearer ${jwt}`,
        'apns-topic': APNS_BUNDLE_ID,
        'apns-push-type': 'alert',
        'apns-priority': '10',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(apnsPayload),
    })

    if (response.ok) {
      sent++
    } else {
      const err = await response.text()
      console.error(`APNs error for token ${token.slice(0, 8)}...: ${err}`)
    }
  }

  return new Response(JSON.stringify({ sent, total: tokens.length }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
