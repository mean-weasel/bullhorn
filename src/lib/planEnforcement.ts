import { createClient } from '@/lib/supabase/server'
import { PLAN_LIMITS, type PlanType, type ResourceType } from './limits'

/**
 * Check if a Supabase error is a plan limit violation from the DB trigger.
 * The trigger raises ERRCODE 'check_violation' (SQLSTATE 23514) with a
 * message like "Plan limit reached: 50 posts (limit 50)".
 */
export function isPlanLimitError(error: { code?: string; message?: string }): boolean {
  return error.code === '23514' && (error.message?.includes('Plan limit reached') ?? false)
}

/** Resources that use the generic count-based enforcement via TABLE_MAP */
export type GenericResource = Exclude<
  ResourceType,
  'storageBytes' | 'apiKeys' | 'socialAccountsPerProvider'
>

const TABLE_MAP: Record<GenericResource, { table: string; countCol: string }> = {
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
  resource: GenericResource,
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

export async function enforceSocialAccountLimit(
  userId: string,
  provider: string
): Promise<{ allowed: boolean; current: number; limit: number; plan: PlanType }> {
  const supabase = await createClient()
  const plan = await getUserPlan(userId)
  const limit = PLAN_LIMITS[plan].socialAccountsPerProvider

  const { count } = await supabase
    .from('social_accounts')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('provider', provider)

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
