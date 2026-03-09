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
    allowNavigation: ['*.supabase.co'],
  },
  ios: {
    contentInset: 'automatic',
    preferredContentMode: 'mobile',
    scheme: 'Bullhorn',
    allowsLinkPreview: false,
    appendUserAgent: 'BullhornCapacitor',
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
    SocialLogin: {
      google: {
        iOSClientId: process.env.GOOGLE_IOS_CLIENT_ID || '',
        webClientId: process.env.GOOGLE_WEB_CLIENT_ID || '',
      },
    },
    LocalNotifications: {
      smallIcon: 'ic_stat_icon_config_sample',
      iconColor: '#ce9a08',
    },
  },
}

export default config
