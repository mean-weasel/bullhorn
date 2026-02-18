import { isNativePlatform } from './capacitor'

interface ShareOptions {
  title?: string
  text?: string
  url?: string
}

export function isShareAvailable(): boolean {
  if (isNativePlatform()) return true
  return typeof navigator !== 'undefined' && !!navigator.share
}

export async function shareContent(options: ShareOptions): Promise<boolean> {
  if (isNativePlatform()) {
    try {
      const { Share } = await import('@capacitor/share')
      await Share.share({
        title: options.title,
        text: options.text,
        url: options.url,
        dialogTitle: options.title,
      })
      return true
    } catch (err) {
      // User cancelled or share failed
      console.error('[Share] Failed:', err)
      return false
    }
  }

  // Web fallback
  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share({
        title: options.title,
        text: options.text,
        url: options.url,
      })
      return true
    } catch {
      return false
    }
  }

  return false
}
