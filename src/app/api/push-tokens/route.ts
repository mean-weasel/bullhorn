import { requireSessionAuth, parseJsonBody } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const postSchema = z.object({
  token: z.string().min(1).max(500),
  platform: z.enum(['ios', 'web']).default('ios'),
})

const deleteSchema = z.object({
  token: z.string().min(1).max(500),
})

export async function POST(request: Request) {
  try {
    const { userId } = await requireSessionAuth()
    const supabase = await createClient()
    const jsonResult = await parseJsonBody(request)
    if ('error' in jsonResult) return jsonResult.error
    const parsed = postSchema.safeParse(jsonResult.data)

    if (!parsed.success) {
      return Response.json(
        { error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { error } = await supabase.from('push_device_tokens').upsert(
      {
        user_id: userId,
        token: parsed.data.token,
        platform: parsed.data.platform,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,token' }
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

export async function DELETE(request: Request) {
  try {
    const { userId } = await requireSessionAuth()
    const supabase = await createClient()
    const jsonResult = await parseJsonBody(request)
    if ('error' in jsonResult) return jsonResult.error
    const parsed = deleteSchema.safeParse(jsonResult.data)

    if (!parsed.success) {
      return Response.json(
        { error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { error } = await supabase
      .from('push_device_tokens')
      .delete()
      .eq('user_id', userId)
      .eq('token', parsed.data.token)

    if (error) throw error

    return Response.json({ success: true })
  } catch (error) {
    if ((error as Error).message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
