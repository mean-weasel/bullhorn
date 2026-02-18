import { isNativePlatform } from './capacitor'

interface NativeConfirmOptions {
  title: string
  message: string
  okButtonTitle?: string
  cancelButtonTitle?: string
}

export function isNativeDialogAvailable(): boolean {
  return isNativePlatform()
}

/**
 * Show a native confirm dialog on iOS. Returns true/false based on user choice,
 * or null if not on a native platform (caller should fall through to web dialog).
 */
export async function showNativeConfirm(options: NativeConfirmOptions): Promise<boolean | null> {
  if (!isNativePlatform()) return null

  try {
    const { Dialog } = await import('@capacitor/dialog')
    const { value } = await Dialog.confirm({
      title: options.title,
      message: options.message,
      okButtonTitle: options.okButtonTitle || 'OK',
      cancelButtonTitle: options.cancelButtonTitle || 'Cancel',
    })
    return value
  } catch (err) {
    console.error('[Dialog] Failed to show confirm:', err)
    return null
  }
}
