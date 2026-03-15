import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { requireSessionAuth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

interface RouteContext {
  params: Promise<{ id: string }>
}

// DELETE /api/social-accounts/[id] — Disconnect a social account
export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    let userId: string
    try {
      const auth = await requireSessionAuth()
      userId = auth.userId
    } catch {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await context.params
    const supabase = await createClient()

    const { error } = await supabase
      .from('social_accounts')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting social account:', error)
    return NextResponse.json({ error: 'Failed to delete social account' }, { status: 500 })
  }
}
