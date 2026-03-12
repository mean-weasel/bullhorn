'use client'

import { Sun, Moon, Monitor, BarChart3, Plus, Trash2, Loader2 } from 'lucide-react'
import { Theme } from '@/lib/theme'
import { cn } from '@/lib/utils'

// --- Theme Section ---

const THEME_OPTIONS: { value: Theme; label: string; icon: typeof Sun; emoji: string }[] = [
  { value: 'light', label: 'Light', icon: Sun, emoji: '☀️' },
  { value: 'dark', label: 'Dark', icon: Moon, emoji: '🌙' },
  { value: 'system', label: 'System', icon: Monitor, emoji: '💻' },
]

interface ThemeSectionProps {
  theme: Theme
  setTheme: (theme: Theme) => void
}

export function ThemeSection({ theme, setTheme }: ThemeSectionProps) {
  return (
    <div className="p-6 rounded-md border-[3px] border-border bg-card shadow-sticker mb-6">
      <h2 className="text-sm font-extrabold uppercase tracking-wider text-foreground mb-4">
        🎨 Appearance
      </h2>
      <p className="text-sm text-muted-foreground mb-4">Choose your preferred color scheme.</p>
      <div className="flex gap-2">
        {THEME_OPTIONS.map((option) => {
          const isActive = theme === option.value
          return (
            <button
              key={option.value}
              onClick={() => setTheme(option.value)}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-md',
                'text-sm font-bold transition-all',
                'border-[3px]',
                isActive
                  ? 'border-border bg-primary text-primary-foreground shadow-sticker-sm'
                  : 'border-border bg-card text-muted-foreground hover:text-foreground hover:bg-secondary shadow-sticker-hover'
              )}
            >
              <span>{option.emoji}</span>
              {option.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// --- Analytics Section ---

interface AnalyticsConnection {
  id: string
  propertyId: string
  propertyName?: string
  syncStatus?: string
}

interface AnalyticsSectionProps {
  connections: AnalyticsConnection[]
  analyticsLoading: boolean
  onConnect: () => void
  onDeleteConnection: (id: string) => void
}

export function AnalyticsSection({
  connections,
  analyticsLoading,
  onConnect,
  onDeleteConnection,
}: AnalyticsSectionProps) {
  return (
    <div className="p-6 rounded-md border-[3px] border-border bg-card shadow-sticker mb-6">
      <h2 className="text-sm font-extrabold uppercase tracking-wider text-foreground mb-4">
        📊 Analytics
      </h2>
      <p className="text-sm text-muted-foreground mb-4">
        Connect Google Analytics to view website metrics in your dashboard.
      </p>

      {analyticsLoading && connections.length === 0 ? (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : connections.length > 0 ? (
        <div className="space-y-3">
          {connections.map((connection) => (
            <div
              key={connection.id}
              className="flex items-center justify-between p-3 rounded-md border-2 border-border bg-card"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-md bg-sticker-blue/10 flex items-center justify-center border-2 border-sticker-blue/30">
                  <BarChart3 className="w-5 h-5 text-sticker-blue" />
                </div>
                <div>
                  <div className="font-bold">
                    {connection.propertyName || `Property ${connection.propertyId}`}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    ID: {connection.propertyId}
                    {connection.syncStatus === 'error' && (
                      <span className="ml-2 text-destructive font-bold">Sync error</span>
                    )}
                    {connection.syncStatus === 'success' && (
                      <span className="ml-2 text-sticker-green font-bold">Connected</span>
                    )}
                  </div>
                </div>
              </div>
              <button
                onClick={() => onDeleteConnection(connection.id)}
                className={cn(
                  'p-2 rounded-md',
                  'text-muted-foreground hover:text-destructive',
                  'hover:bg-destructive/10 border-2 border-transparent hover:border-destructive/30 transition-all'
                )}
                title="Remove connection"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}

          <button
            onClick={onConnect}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 rounded-md w-full',
              'border-2 border-dashed border-border',
              'text-muted-foreground hover:text-foreground font-medium',
              'hover:border-primary/50 transition-all'
            )}
          >
            <Plus className="w-4 h-4" />
            Add another property
          </button>
        </div>
      ) : (
        <button
          onClick={onConnect}
          className={cn(
            'flex items-center gap-2 px-4 py-3 rounded-md w-full',
            'bg-sticker-blue text-white font-bold text-sm',
            'border-[3px] border-border',
            'shadow-sticker-sm',
            'hover:-translate-y-px hover:shadow-sticker',
            'transition-all'
          )}
        >
          <BarChart3 className="w-4 h-4" />
          Connect Google Analytics
        </button>
      )}
    </div>
  )
}

// --- About Section ---

export function AboutSection() {
  return (
    <div className="p-6 rounded-md border-[3px] border-border bg-card shadow-sticker">
      <h2 className="text-sm font-extrabold uppercase tracking-wider text-foreground mb-4">
        ℹ️ About
      </h2>
      <ul className="space-y-3 text-sm text-muted-foreground">
        <li className="flex items-start gap-3">
          <span className="w-6 h-6 rounded-md bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 border border-primary/30">
            1
          </span>
          <span>Create and organize your social media post ideas.</span>
        </li>
        <li className="flex items-start gap-3">
          <span className="w-6 h-6 rounded-md bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 border border-primary/30">
            2
          </span>
          <span>Schedule posts and get reminded when they&apos;re due.</span>
        </li>
        <li className="flex items-start gap-3">
          <span className="w-6 h-6 rounded-md bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 border border-primary/30">
            3
          </span>
          <span>Your data is securely stored and encrypted in the cloud.</span>
        </li>
      </ul>
      <div className="mt-4 pt-4 border-t border-border flex gap-4 text-xs text-muted-foreground">
        <a href="/terms" className="hover:text-primary font-bold">
          Terms of Service
        </a>
        <a href="/privacy" className="hover:text-primary font-bold">
          Privacy Policy
        </a>
      </div>
    </div>
  )
}
