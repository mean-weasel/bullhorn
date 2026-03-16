/* eslint-disable react-refresh/only-export-components -- Next.js OG image config exports */
import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'Bullhorn — Social Media Post Scheduler'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

// eslint-disable-next-line max-lines-per-function -- borderline, extraction would hurt readability
export default function Image() {
  return new ImageResponse(
    <div
      style={{
        background: '#0f172a',
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'sans-serif',
        position: 'relative',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 6,
          background: '#ce9a08',
        }}
      />
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 20,
          marginBottom: 24,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 80,
            height: 80,
            borderRadius: 16,
            background: '#ce9a08',
            fontSize: 44,
          }}
        >
          📢
        </div>
        <div
          style={{
            fontSize: 72,
            fontWeight: 900,
            color: '#ce9a08',
            letterSpacing: -2,
          }}
        >
          Bullhorn
        </div>
      </div>
      <div
        style={{
          fontSize: 32,
          fontWeight: 700,
          color: 'white',
          marginBottom: 12,
        }}
      >
        Social Media Post Scheduler
      </div>
      <div
        style={{
          fontSize: 22,
          color: '#94a3b8',
          maxWidth: 700,
          textAlign: 'center',
          lineHeight: 1.4,
        }}
      >
        For developers, indie hackers, and teams who ship fast
      </div>
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 6,
          background: '#ce9a08',
        }}
      />
    </div>,
    { ...size }
  )
}
