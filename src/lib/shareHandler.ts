import { App } from '@capacitor/app'

type Router = { push: (url: string) => void }

export function initShareHandler(router: Router) {
  App.addListener('appUrlOpen', (event) => {
    const url = new URL(event.url)

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
