import { requireAuth, parseJsonBody } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const subscriptionSchema = z.object({
  endpoint: z.string().url().max(2048),
  keys: z.object({
    p256dh: z.string().min(1).max(256),
    auth: z.string().min(1).max(256),
  }),
})

const deleteSubscriptionSchema = z.object({
  endpoint: z.string().url().max(2048),
})

// POST - Save web push subscription
export async function POST(request: Request) {
  try {
    const { userId } = await requireAuth()
    const supabase = await createClient()
    const jsonResult = await parseJsonBody(request)
    if ('error' in jsonResult) return jsonResult.error

    const parsed = subscriptionSchema.safeParse(jsonResult.data)
    if (!parsed.success) {
      return Response.json(
        { error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { error } = await supabase.from('web_push_subscriptions').upsert(
      {
        user_id: userId,
        endpoint: parsed.data.endpoint,
        keys_p256dh: parsed.data.keys.p256dh,
        keys_auth: parsed.data.keys.auth,
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

    const parsed = deleteSubscriptionSchema.safeParse(jsonResult.data)
    if (!parsed.success) {
      return Response.json(
        { error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { error } = await supabase
      .from('web_push_subscriptions')
      .delete()
      .eq('user_id', userId)
      .eq('endpoint', parsed.data.endpoint)

    if (error) throw error

    return Response.json({ success: true })
  } catch (error) {
    if ((error as Error).message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
