'use client'

import { useEffect } from 'react'
import { cn } from '@/lib/utils'
import type { SocialAccount } from '@/lib/socialAccounts'

interface AccountSelectorProps {
  accounts: SocialAccount[]
  selectedAccountId: string | undefined
  onSelect: (accountId: string) => void
  platform: string
}

export function AccountSelector({
  accounts,
  selectedAccountId,
  onSelect,
  platform: _platform,
}: AccountSelectorProps) {
  // Auto-select if there is exactly one account
  useEffect(() => {
    if (accounts.length === 1 && !selectedAccountId) {
      onSelect(accounts[0].id)
    }
  }, [accounts, selectedAccountId, onSelect])

  // Don't render for 0 or 1 accounts
  if (accounts.length <= 1) {
    return null
  }

  return (
    <div className="p-3 rounded-md border-2 border-border bg-card">
      <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 block">
        Publish as
      </label>
      <div className="flex gap-2 flex-wrap">
        {accounts.map((account) => (
          <button
            key={account.id}
            onClick={() => onSelect(account.id)}
            className={cn(
              'flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium',
              'transition-all border-2',
              selectedAccountId === account.id
                ? 'border-primary bg-primary/10 text-foreground'
                : 'border-border hover:border-primary/50 text-muted-foreground'
            )}
          >
            {account.avatarUrl && (
              <img src={account.avatarUrl} alt="" className="w-5 h-5 rounded-full" />
            )}
            <span>@{account.username || account.displayName || 'Unknown'}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
