import { isNativePlatform } from './capacitor'

const MILESTONE_KEY = 'bullhorn-review-milestone'
const LAST_PROMPT_KEY = 'bullhorn-review-last-prompt'
const MILESTONES = [5, 15, 50]
const COOLDOWN_MS = 90 * 24 * 60 * 60 * 1000 // 90 days

export function getMilestoneCount(): number {
  if (typeof localStorage === 'undefined') return 0
  return parseInt(localStorage.getItem(MILESTONE_KEY) || '0', 10)
}

function setMilestoneCount(count: number): void {
  localStorage.setItem(MILESTONE_KEY, String(count))
}

function getLastPromptTime(): number {
  if (typeof localStorage === 'undefined') return 0
  return parseInt(localStorage.getItem(LAST_PROMPT_KEY) || '0', 10)
}

function setLastPromptTime(time: number): void {
  localStorage.setItem(LAST_PROMPT_KEY, String(time))
}

function shouldPrompt(count: number): boolean {
  if (!MILESTONES.includes(count)) return false
  const lastPrompt = getLastPromptTime()
  if (lastPrompt === 0) return true
  return Date.now() - lastPrompt >= COOLDOWN_MS
}

export async function trackMilestone(): Promise<void> {
  const count = getMilestoneCount() + 1
  setMilestoneCount(count)

  if (!shouldPrompt(count)) return
  if (!isNativePlatform()) return

  try {
    const { InAppReview } = await import('@capacitor-community/in-app-review')
    await InAppReview.requestReview()
    setLastPromptTime(Date.now())
  } catch (err) {
    console.error('[AppReview] Failed to request review:', err)
  }
}
