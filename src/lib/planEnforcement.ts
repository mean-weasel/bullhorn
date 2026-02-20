import { createClient } from '@/lib/supabase/server'
import { PLAN_LIMITS, type PlanType, type ResourceType } from './limits'

const TABLE_MAP: Record<
  Exclude<ResourceType, 'storageBytes'>,
  { table: string; countCol: string }
> = {
  posts: { table: 'posts', countCol: 'user_id' },
  campaigns: { table: 'campaigns', countCol: 'user_id' },
  projects: { table: 'projects', countCol: 'user_id' },
  blogDrafts: { table: 'blog_drafts', countCol: 'user_id' },
  launchPosts: { table: 'launch_posts', countCol: 'user_id' },
}

export async function getUserPlan(userId: string): Promise<PlanType> {
  const supabase = await createClient()
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('plan')
    .eq('id', userId)
    .single()
  return (profile?.plan as PlanType) || 'free'
}

export async function enforceResourceLimit(
  userId: string,
  resource: Exclude<ResourceType, 'storageBytes'>,
  preloadedPlan?: PlanType
): Promise<{ allowed: boolean; current: number; limit: number; plan: PlanType }> {
  const supabase = await createClient()

  let plan: PlanType
  if (preloadedPlan) {
    plan = preloadedPlan
  } else {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('plan')
      .eq('id', userId)
      .single()
    plan = (profile?.plan as PlanType) || 'free'
  }

  const limit = PLAN_LIMITS[plan][resource]
  const { table, countCol } = TABLE_MAP[resource]

  const { count } = await supabase
    .from(table)
    .select('*', { count: 'exact', head: true })
    .eq(countCol, userId)

  const current = count || 0
  return { allowed: current < limit, current, limit, plan }
}

export async function enforceStorageLimit(
  userId: string,
  additionalBytes: number
): Promise<{
  allowed: boolean
  currentBytes: number
  limitBytes: number
  plan: PlanType
}> {
  const supabase = await createClient()

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('plan, storage_used_bytes')
    .eq('id', userId)
    .single()

  const plan = (profile?.plan as PlanType) || 'free'
  const currentBytes = profile?.storage_used_bytes || 0
  const limitBytes = PLAN_LIMITS[plan].storageBytes

  return {
    allowed: currentBytes + additionalBytes <= limitBytes,
    currentBytes,
    limitBytes,
    plan,
  }
}
