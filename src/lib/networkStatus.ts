import { isNativePlatform } from './capacitor'

export interface NetworkState {
  connected: boolean
  connectionType: string
}

export async function getNetworkStatus(): Promise<NetworkState> {
  if (isNativePlatform()) {
    try {
      const { Network } = await import('@capacitor/network')
      const status = await Network.getStatus()
      return { connected: status.connected, connectionType: status.connectionType }
    } catch (err) {
      console.error('[Network] Failed to get status:', err)
    }
  }

  return {
    connected: typeof navigator !== 'undefined' ? navigator.onLine : true,
    connectionType: 'unknown',
  }
}

export function onNetworkStatusChange(callback: (status: NetworkState) => void): () => void {
  if (isNativePlatform()) {
    let listenerHandle: { remove: () => void } | null = null

    import('@capacitor/network')
      .then(({ Network }) => {
        Network.addListener('networkStatusChange', (status) => {
          callback({ connected: status.connected, connectionType: status.connectionType })
        }).then((handle) => {
          listenerHandle = handle
        })
      })
      .catch((err) => {
        console.error('[Network] Failed to add listener:', err)
      })

    return () => {
      listenerHandle?.remove()
    }
  }

  // Web fallback
  const onOnline = () => callback({ connected: true, connectionType: 'unknown' })
  const onOffline = () => callback({ connected: false, connectionType: 'none' })

  window.addEventListener('online', onOnline)
  window.addEventListener('offline', onOffline)

  return () => {
    window.removeEventListener('online', onOnline)
    window.removeEventListener('offline', onOffline)
  }
}
