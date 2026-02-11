import { Capacitor } from '@capacitor/core'

export function isNativePlatform(): boolean {
  return Capacitor.isNativePlatform()
}

export function isIOS(): boolean {
  return Capacitor.getPlatform() === 'ios'
}

export function getPlatform(): string {
  return Capacitor.getPlatform()
}
