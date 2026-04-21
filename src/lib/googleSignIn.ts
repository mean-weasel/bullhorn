import type { SupabaseClient } from '@supabase/supabase-js'

let initPromise: Promise<Awaited<ReturnType<typeof loadSocialLogin>>> | null = null

async function loadSocialLogin() {
  try {
    const { SocialLogin } = await import('@capgo/capacitor-social-login')
    return SocialLogin
  } catch {
    throw new Error('Google Sign-In is unavailable. Please update the app and try again.')
  }
}

async function ensureInitialized() {
  if (!initPromise) {
    initPromise = (async () => {
      const SocialLogin = await loadSocialLogin()
      await SocialLogin.initialize({
        google: {
          webClientId: process.env.NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID || '',
          iOSClientId: process.env.NEXT_PUBLIC_GOOGLE_IOS_CLIENT_ID || '',
          mode: 'online',
        },
      })
      return SocialLogin
    })()
  }
  return initPromise
}

export async function nativeGoogleSignIn(
  supabase: SupabaseClient
): Promise<{ success: boolean; error?: string }> {
  try {
    const SocialLogin = await ensureInitialized()

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
