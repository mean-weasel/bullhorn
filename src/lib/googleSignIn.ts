import { SocialLogin } from '@capgo/capacitor-social-login'
import type { SupabaseClient } from '@supabase/supabase-js'

let initialized = false

async function ensureInitialized() {
  if (initialized) return
  await SocialLogin.initialize({
    google: {
      webClientId: process.env.NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID || '',
      iOSClientId: process.env.NEXT_PUBLIC_GOOGLE_IOS_CLIENT_ID || '',
      mode: 'online',
    },
  })
  initialized = true
}

export async function nativeGoogleSignIn(
  supabase: SupabaseClient
): Promise<{ success: boolean; error?: string }> {
  try {
    await ensureInitialized()

    const response = await SocialLogin.login({
      provider: 'google',
      options: {
        scopes: ['email', 'profile'],
      },
    })

    const result = response.result

    if (result.responseType !== 'online') {
      return { success: false, error: 'Google returned offline response' }
    }

    if (!result.idToken) {
      return {
        success: false,
        error: 'Google did not return an ID token. Check webClientId config.',
      }
    }

    const { error } = await supabase.auth.signInWithIdToken({
      provider: 'google',
      token: result.idToken,
    })

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Google Sign-In failed'
    return { success: false, error: message }
  }
}
