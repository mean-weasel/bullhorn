import { requireAuth, parseJsonBody } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const { userId } = await requireAuth()
    const supabase = await createClient()
    const jsonResult = await parseJsonBody(request)
    if ('error' in jsonResult) return jsonResult.error
    const { token, platform = 'ios' } = jsonResult.data as Record<string, unknown>

    if (!token || typeof token !== 'string') {
      return Response.json({ error: 'Token is required' }, { status: 400 })
    }

    const { error } = await supabase.from('push_device_tokens').upsert(
      {
        user_id: userId,
        token,
        platform,
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
    const { userId } = await requireAuth()
    const supabase = await createClient()
    const jsonResult = await parseJsonBody(request)
    if ('error' in jsonResult) return jsonResult.error
    const { token } = jsonResult.data as Record<string, unknown>

    if (!token || typeof token !== 'string') {
      return Response.json({ error: 'Token is required' }, { status: 400 })
    }

    const { error } = await supabase
      .from('push_device_tokens')
      .delete()
      .eq('user_id', userId)
      .eq('token', token)

    if (error) throw error

    return Response.json({ success: true })
  } catch (error) {
    if ((error as Error).message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
