import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { sendWaitlistConfirmation } from '@/lib/emailSender'

export async function POST(request: NextRequest) {
  try {
    const { userId } = await requireAuth()
    const body = await request.json().catch(() => ({}))
    const feature = body.feature || 'auto_publish'

    const supabase = await createClient()

    const { error } = await supabase
      .from('pro_waitlist')
      .upsert({ user_id: userId, email: '', feature }, { onConflict: 'user_id,feature' })

    if (error) {
      console.error('[waitlist] Insert error:', error)
      return NextResponse.json({ error: 'Failed to join waitlist' }, { status: 500 })
    }

    // Send confirmation email (best-effort)
    try {
      const { data: userData } = await supabase.auth.admin.getUserById(userId)
      if (userData?.user?.email) {
        await sendWaitlistConfirmation(userData.user.email, feature)
      }
    } catch (emailErr) {
      console.error('[waitlist] Email send failed:', emailErr)
    }

    return NextResponse.json({ joined: true })
  } catch (error) {
    if ((error as Error).message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
