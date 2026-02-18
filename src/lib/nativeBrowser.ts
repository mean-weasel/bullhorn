import { isNativePlatform } from './capacitor'

export async function openInBrowser(url: string): Promise<void> {
  if (isNativePlatform()) {
    try {
      const { Browser } = await import('@capacitor/browser')
      await Browser.open({ url })
      return
    } catch (err) {
      console.error('[Browser] Failed to open:', err)
    }
  }

  window.open(url, '_blank', 'noopener,noreferrer')
}
