import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { transformReminderFromDb, type DbReminder } from '@/lib/reminders'
import { requireSessionAuth, parseJsonBody } from '@/lib/auth'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const updateReminderSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional().nullable(),
  remindAt: z.string().datetime({ offset: true }).optional(),
  postId: z.string().uuid().optional().nullable(),
  campaignId: z.string().uuid().optional().nullable(),
  isCompleted: z.boolean().optional(),
})

// PATCH /api/reminders/[id] - Update reminder
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    let userId: string
    try {
      const auth = await requireSessionAuth()
      userId = auth.userId
    } catch {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const supabase = await createClient()
    const jsonResult = await parseJsonBody(request)
    if ('error' in jsonResult) return jsonResult.error
    const parsed = updateReminderSchema.safeParse(jsonResult.data)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const updates: Record<string, unknown> = {}
    if (parsed.data.title !== undefined) updates.title = parsed.data.title
    if (parsed.data.description !== undefined) updates.description = parsed.data.description
    if (parsed.data.remindAt !== undefined) updates.remind_at = parsed.data.remindAt
    if (parsed.data.postId !== undefined) updates.post_id = parsed.data.postId || null
    if (parsed.data.campaignId !== undefined) updates.campaign_id = parsed.data.campaignId || null
    if (parsed.data.isCompleted !== undefined) updates.is_completed = parsed.data.isCompleted

    const { data, error } = await supabase
      .from('reminders')
      .update(updates)
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Reminder not found' }, { status: 404 })
      }
      console.error('Database error:', error)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    const reminder = transformReminderFromDb(data as DbReminder)
    return NextResponse.json({ reminder })
  } catch (error) {
    console.error('Error updating reminder:', error)
    return NextResponse.json({ error: 'Failed to update reminder' }, { status: 500 })
  }
}

// DELETE /api/reminders/[id] - Delete reminder
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    let userId: string
    try {
      const auth = await requireSessionAuth()
      userId = auth.userId
    } catch {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const supabase = await createClient()

    // Verify user owns this reminder first
    const { data: reminder, error: checkError } = await supabase
      .from('reminders')
      .select('id')
      .eq('id', id)
      .eq('user_id', userId)
      .single()

    if (checkError || !reminder) {
      return NextResponse.json({ error: 'Reminder not found' }, { status: 404 })
    }

    const { error } = await supabase.from('reminders').delete().eq('id', id).eq('user_id', userId)

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting reminder:', error)
    return NextResponse.json({ error: 'Failed to delete reminder' }, { status: 500 })
  }
}
