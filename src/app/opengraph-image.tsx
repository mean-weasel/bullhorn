import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'Bullhorn — Social Media Post Scheduler'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function Image() {
  return new ImageResponse(
    <div
      style={{
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'sans-serif',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 120,
          height: 120,
          borderRadius: 24,
          background: '#ce9a08',
          border: '4px solid #2a2a4a',
          fontSize: 64,
          marginBottom: 32,
        }}
      >
        📢
      </div>
      <div
        style={{
          fontSize: 64,
          fontWeight: 900,
          color: 'white',
          letterSpacing: -2,
          marginBottom: 16,
        }}
      >
        Bullhorn
      </div>
      <div
        style={{
          fontSize: 28,
          color: '#a0a0b8',
          maxWidth: 600,
          textAlign: 'center',
        }}
      >
        Schedule and manage social media posts for Twitter, LinkedIn, and Reddit
      </div>
    </div>,
    { ...size }
  )
}
