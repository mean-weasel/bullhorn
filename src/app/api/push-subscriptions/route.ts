import { requireAuth, parseJsonBody } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// POST - Save web push subscription
export async function POST(request: Request) {
  try {
    const { userId } = await requireAuth()
    const supabase = await createClient()
    const jsonResult = await parseJsonBody(request)
    if ('error' in jsonResult) return jsonResult.error
    const { endpoint, keys } = jsonResult.data as {
      endpoint?: string
      keys?: { p256dh?: string; auth?: string }
    }

    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return Response.json({ error: 'Invalid subscription data' }, { status: 400 })
    }

    const { error } = await supabase.from('web_push_subscriptions').upsert(
      {
        user_id: userId,
        endpoint,
        keys_p256dh: keys.p256dh,
        keys_auth: keys.auth,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,endpoint' }
    )

    if (error) throw error

    return Response.json({ success: true })
  } catch (error) {
    if ((error as Error).message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE - Remove web push subscription
export async function DELETE(request: Request) {
  try {
    const { userId } = await requireAuth()
    const supabase = await createClient()
    const jsonResult = await parseJsonBody(request)
    if ('error' in jsonResult) return jsonResult.error
    const { endpoint } = jsonResult.data as { endpoint?: string }

    if (!endpoint) {
      return Response.json({ error: 'Endpoint is required' }, { status: 400 })
    }

    const { error } = await supabase
      .from('web_push_subscriptions')
      .delete()
      .eq('user_id', userId)
      .eq('endpoint', endpoint)

    if (error) throw error

    return Response.json({ success: true })
  } catch (error) {
    if ((error as Error).message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
