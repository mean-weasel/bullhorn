/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Background layers
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',

        // Card / elevated surfaces
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },

        // Popover / dropdown
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },

        // Primary action color (Yellow)
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },

        // Secondary
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },

        // Muted text/backgrounds
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },

        // Accents
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },

        // Destructive actions
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },

        // Borders
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',

        // Sticker bomb color palette
        sticker: {
          yellow: '#fbbf24',
          pink: '#ec4899',
          purple: '#8b5cf6',
          green: '#22c55e',
          blue: '#0ea5e9',
          orange: '#f97316',
          black: '#1f2937',
        },

        // Platform colors with soft backgrounds
        twitter: {
          DEFAULT: '#1DA1F2',
          soft: '#e8f6fe',
          border: '#1DA1F2',
        },
        linkedin: {
          DEFAULT: '#0A66C2',
          soft: '#e6f0f9',
          border: '#0A66C2',
        },
        reddit: {
          DEFAULT: '#FF4500',
          soft: '#fff0eb',
          border: '#FF4500',
        },
      },
      borderRadius: {
        lg: '16px',
        md: '12px',
        sm: '10px',
        pill: '50px',
      },
      fontFamily: {
        sans: ['Nunito', 'system-ui', 'sans-serif'],
        display: ['Nunito', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'SF Mono', 'monospace'],
      },
      boxShadow: {
        'sticker': '4px 4px 0 hsl(var(--border))',
        'sticker-sm': '3px 3px 0 hsl(var(--border))',
        'sticker-hover': '2px 2px 0 hsl(var(--border))',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'slide-up': {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in': {
          '0%': { opacity: '0', transform: 'translateX(-10px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'bounce-in': {
          '0%': { opacity: '0', transform: 'scale(0.9)' },
          '50%': { transform: 'scale(1.02)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.2s ease-out',
        'slide-up': 'slide-up 0.3s ease-out',
        'slide-in': 'slide-in 0.3s ease-out',
        'bounce-in': 'bounce-in 0.3s ease-out',
      },
    },
  },
  plugins: [],
}
