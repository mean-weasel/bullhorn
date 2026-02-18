import { isNativePlatform } from './capacitor'

export async function hapticSuccess(): Promise<void> {
  if (!isNativePlatform()) return
  const { Haptics, NotificationType } = await import('@capacitor/haptics')
  await Haptics.notification({ type: NotificationType.Success })
}

export async function hapticWarning(): Promise<void> {
  if (!isNativePlatform()) return
  const { Haptics, NotificationType } = await import('@capacitor/haptics')
  await Haptics.notification({ type: NotificationType.Warning })
}

export async function hapticLight(): Promise<void> {
  if (!isNativePlatform()) return
  const { Haptics, ImpactStyle } = await import('@capacitor/haptics')
  await Haptics.impact({ style: ImpactStyle.Light })
}
