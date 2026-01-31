import type { CapacitorConfig } from '@capacitor/cli'

// Use production URL by default, override with CAPACITOR_SERVER_URL for development
const serverUrl = process.env.CAPACITOR_SERVER_URL || 'https://bullhorn.to'

const config: CapacitorConfig = {
  appId: 'to.bullhorn.app',
  appName: 'Bullhorn',
  webDir: 'public', // Minimal webDir for assets, actual content loads from server
  server: {
    url: serverUrl,
    cleartext: serverUrl.startsWith('http://'), // Allow cleartext for localhost dev
  },
  ios: {
    contentInset: 'automatic',
    preferredContentMode: 'mobile',
    scheme: 'Bullhorn',
    allowsLinkPreview: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#1a1a1a',
      showSpinner: false,
    },
    StatusBar: {
      style: 'dark',
      backgroundColor: '#1a1a1a',
    },
    Keyboard: {
      resize: 'body',
      resizeOnFullScreen: true,
    },
  },
}

export default config
