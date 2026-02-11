const CAPACITOR_UA_MARKER = 'BullhornCapacitor'

export function isNativePlatform(): boolean {
  if (typeof navigator === 'undefined') return false
  return navigator.userAgent.includes(CAPACITOR_UA_MARKER)
}

export function isIOS(): boolean {
  return isNativePlatform()
}

export function getPlatform(): string {
  if (isNativePlatform()) return 'ios'
  return 'web'
}
