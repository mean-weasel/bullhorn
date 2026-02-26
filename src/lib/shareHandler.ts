import { App } from '@capacitor/app'

type Router = { push: (url: string) => void }

export function initShareHandler(router: Router) {
  App.addListener('appUrlOpen', (event) => {
    const url = new URL(event.url)

    // Handle OAuth callback universal links (e.g. https://bullhorn.to/auth/callback?code=...)
    if (
      (url.protocol === 'https:' || url.protocol === 'http:') &&
      url.pathname.startsWith('/auth/callback')
    ) {
      // Navigate the WKWebView to the callback URL so the server can exchange the auth code
      window.location.href = url.href
      return
    }

    // Handle share extension deep links (bullhorn://share?text=...&url=...)
    if (url.protocol === 'bullhorn:' && url.hostname === 'share') {
      const text = url.searchParams.get('text') || ''
      const sharedUrl = url.searchParams.get('url') || ''
      const params = new URLSearchParams()
      if (text) params.set('text', text)
      if (sharedUrl) params.set('url', sharedUrl)
      router.push(`/new?${params.toString()}`)
    }
  })
}
