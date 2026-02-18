import { isNativePlatform } from './capacitor'

const SESSION_KEY = 'supabase_session'

interface KeychainPlugin {
  set(options: { key: string; value: string }): Promise<void>
  get(options: { key: string }): Promise<{ value: string | null }>
  remove(options: { key: string }): Promise<void>
}

async function getKeychainPlugin(): Promise<KeychainPlugin | null> {
  if (!isNativePlatform()) return null
  try {
    const { registerPlugin } = await import('@capacitor/core')
    return registerPlugin<KeychainPlugin>('Keychain')
  } catch {
    return null
  }
}

export async function saveSessionToKeychain(
  accessToken: string,
  refreshToken: string
): Promise<void> {
  const plugin = await getKeychainPlugin()
  if (!plugin) return
  const payload = JSON.stringify({ accessToken, refreshToken })
  await plugin.set({ key: SESSION_KEY, value: payload })
}

export async function getSessionFromKeychain(): Promise<{
  accessToken: string
  refreshToken: string
} | null> {
  const plugin = await getKeychainPlugin()
  if (!plugin) return null
  const result = await plugin.get({ key: SESSION_KEY })
  if (!result.value) return null
  try {
    return JSON.parse(result.value)
  } catch {
    return null
  }
}

export async function clearSessionFromKeychain(): Promise<void> {
  const plugin = await getKeychainPlugin()
  if (!plugin) return
  await plugin.remove({ key: SESSION_KEY })
}
