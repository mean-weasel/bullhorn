import { isNativePlatform } from './capacitor'

export async function copyToClipboard(text: string): Promise<boolean> {
  if (isNativePlatform()) {
    try {
      const { Clipboard } = await import('@capacitor/clipboard')
      await Clipboard.write({ string: text })
      // Trigger haptic feedback on successful copy
      try {
        const { Haptics, ImpactStyle } = await import('@capacitor/haptics')
        await Haptics.impact({ style: ImpactStyle.Light })
      } catch {
        // Haptics not critical
      }
      return true
    } catch (err) {
      console.error('[Clipboard] Failed to copy:', err)
      return false
    }
  }

  // Web fallback
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    // Textarea fallback for older browsers
    try {
      const textarea = document.createElement('textarea')
      textarea.value = text
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      return true
    } catch {
      return false
    }
  }
}
