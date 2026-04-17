'use client'

import { useState } from 'react'
import { Loader2, Trash2, ArrowRight } from 'lucide-react'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import type { SocialAccount, SocialProvider } from '@/lib/socialAccounts'

const PLATFORMS: { provider: SocialProvider; name: string; icon: string }[] = [
  { provider: 'twitter', name: 'Twitter / X', icon: '\uD835\uDD4F' },
  { provider: 'linkedin', name: 'LinkedIn', icon: 'in' },
  { provider: 'reddit', name: 'Reddit', icon: 'r/' },
]

const PLATFORM_STYLES: Record<SocialProvider, { bg: string; border: string; text: string }> = {
  twitter: {
    bg: 'bg-twitter/10',
    border: 'border-twitter/30',
    text: 'text-twitter',
  },
  linkedin: {
    bg: 'bg-linkedin/10',
    border: 'border-linkedin/30',
    text: 'text-linkedin',
  },
  reddit: {
    bg: 'bg-reddit/10',
    border: 'border-reddit/30',
    text: 'text-reddit',
  },
}

interface ConnectedAccountsSectionProps {
  accounts: SocialAccount[]
  loading: boolean
  onConnect: (provider: SocialProvider) => void
  onDisconnect: (id: string) => void
}

function StatusBadge({ account }: { account: SocialAccount }) {
  if (account.status === 'active') {
    return (
      <span className="flex items-center gap-1 text-xs text-sticker-green font-semibold">
        <span className="w-2 h-2 rounded-full bg-sticker-green inline-block" />
        Active
      </span>
    )
  }
  if (account.status === 'expired') {
    return (
      <span className="flex items-center gap-1 text-xs text-sticker-orange font-semibold">
        <span className="w-2 h-2 rounded-full bg-sticker-orange inline-block" />
        Expired — Reconnect
      </span>
    )
  }
  if (account.status === 'revoked') {
    return (
      <span className="flex items-center gap-1 text-xs text-destructive font-semibold">
        <span className="w-2 h-2 rounded-full bg-destructive inline-block" />
        Revoked — Reconnect
      </span>
    )
  }
  return (
    <span className="flex items-center gap-1 text-xs text-destructive font-semibold">
      <span className="w-2 h-2 rounded-full bg-destructive inline-block" />
      {account.statusError || 'Error'}
    </span>
  )
}

// eslint-disable-next-line max-lines-per-function -- component JSX rendering, extraction would fragment UI
function ConnectedAccount({
  account,
  onDisconnect,
}: {
  account: SocialAccount
  onDisconnect: (id: string) => void
}) {
  const styles = PLATFORM_STYLES[account.provider]

  return (
    <div
      className={cn(
        'flex items-center justify-between p-3 rounded-md',
        'border-2',
        styles.border,
        styles.bg
      )}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div
          className={cn(
            'w-10 h-10 rounded-full flex items-center justify-center',
            'overflow-hidden border-2 shrink-0',
            styles.border,
            'bg-card'
          )}
        >
          {account.avatarUrl ? (
            <img src={account.avatarUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className={cn('text-sm font-bold', styles.text)}>
              {account.username?.[0]?.toUpperCase() || '?'}
            </span>
          )}
        </div>
        <div className="min-w-0">
          <div className="font-bold text-sm truncate">
            @{account.username || account.providerAccountId}
            {account.displayName && (
              <span className="font-normal text-muted-foreground ml-1">
                ({account.displayName})
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground">Connected</span>
            <StatusBadge account={account} />
          </div>
          {account.lastUsedAt && (
            <div className="text-xs text-muted-foreground">
              Last used: {format(new Date(account.lastUsedAt), 'MMM d')}
            </div>
          )}
        </div>
      </div>
      <button
        onClick={() => onDisconnect(account.id)}
        className={cn(
          'p-2 rounded-md shrink-0',
          'text-muted-foreground hover:text-destructive',
          'hover:bg-destructive/10',
          'border-2 border-transparent hover:border-destructive/30',
          'transition-all'
        )}
        title="Disconnect account"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  )
}

function ConnectButton({
  platform,
  onConnect,
  connecting,
}: {
  platform: (typeof PLATFORMS)[number]
  onConnect: (provider: SocialProvider) => void
  connecting: SocialProvider | null
}) {
  const styles = PLATFORM_STYLES[platform.provider]
  const isConnecting = connecting === platform.provider

  return (
    <button
      onClick={() => onConnect(platform.provider)}
      disabled={connecting !== null}
      className={cn(
        'flex items-center justify-between w-full p-3 rounded-md',
        'border-2 border-dashed',
        styles.border,
        'text-muted-foreground hover:text-foreground font-medium',
        'hover:border-primary/50 transition-all',
        connecting !== null && 'opacity-50 cursor-not-allowed'
      )}
    >
      <div className="flex items-center gap-3">
        <div
          className={cn(
            'w-10 h-10 rounded-full flex items-center justify-center',
            'border-2',
            styles.border,
            styles.bg
          )}
        >
          <span className={cn('text-sm font-bold', styles.text)}>{platform.icon}</span>
        </div>
        <span className="text-sm font-bold">Connect {platform.name}</span>
      </div>
      {isConnecting ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <ArrowRight className="w-4 h-4" />
      )}
    </button>
  )
}

// eslint-disable-next-line max-lines-per-function -- borderline, extraction would hurt readability
export function ConnectedAccountsSection({
  accounts,
  loading,
  onConnect: _onConnect,
  onDisconnect,
}: ConnectedAccountsSectionProps) {
  const [connecting, setConnecting] = useState<SocialProvider | null>(null)

  const handleConnect = async (provider: SocialProvider) => {
    try {
      setConnecting(provider)
      const res = await fetch(`/api/social-accounts/${provider}/auth`)
      if (!res.ok) throw new Error('Failed to get auth URL')
      const data = await res.json()

      if (data.connected) {
        // Script auth completed server-side (self-hosted Reddit)
        _onConnect(provider)
        setConnecting(null)
      } else if (data.url) {
        // OAuth flow — redirect to provider
        window.location.href = data.url
      } else {
        throw new Error('Unexpected auth response')
      }
    } catch (err) {
      console.error(`Failed to connect ${provider}:`, err)
      setConnecting(null)
    }
  }

  const getAccountsForProvider = (provider: SocialProvider) => {
    return accounts.filter((a) => a.provider === provider)
  }

  return (
    <div className={cn('p-6 rounded-md border-[3px] border-border bg-card', 'shadow-sticker mb-6')}>
      <h2 className="text-sm font-extrabold uppercase tracking-wider text-foreground mb-4">
        Connected Accounts
      </h2>
      <p className="text-sm text-muted-foreground mb-4">
        Connect your social media accounts to publish posts directly.
      </p>

      {loading && accounts.length === 0 ? (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-3">
          {PLATFORMS.map((platform) => {
            const platformAccounts = getAccountsForProvider(platform.provider)

            if (platformAccounts.length > 0) {
              return platformAccounts.map((account) => (
                <ConnectedAccount key={account.id} account={account} onDisconnect={onDisconnect} />
              ))
            }

            return (
              <ConnectButton
                key={platform.provider}
                platform={platform}
                onConnect={handleConnect}
                connecting={connecting}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}
