'use client'

import { useState, useEffect, useCallback } from 'react'
import { Key, Plus, Copy, Check, Trash2, Loader2, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { copyToClipboard } from '@/lib/nativeClipboard'

interface ApiKey {
  id: string
  name: string
  keyPrefix: string
  scopes: string[]
  expiresAt: string | null
  lastUsedAt: string | null
  revokedAt: string | null
  createdAt: string
}

// eslint-disable-next-line max-lines-per-function
export function ApiKeyManager() {
  const [keys, setKeys] = useState<ApiKey[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Create modal state
  const [showCreate, setShowCreate] = useState(false)
  const [newKeyName, setNewKeyName] = useState('')
  const [creating, setCreating] = useState(false)
  const [createdRawKey, setCreatedRawKey] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  // Revoke state
  const [keyToRevoke, setKeyToRevoke] = useState<string | null>(null)
  const [revoking, setRevoking] = useState(false)

  const fetchKeys = useCallback(async () => {
    try {
      const res = await fetch('/api/api-keys')
      if (!res.ok) throw new Error('Failed to fetch API keys')
      const data = await res.json()
      setKeys(data.apiKeys)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchKeys()
  }, [fetchKeys])

  const handleCreate = async () => {
    if (!newKeyName.trim()) return
    setCreating(true)
    setError(null)
    try {
      const res = await fetch('/api/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newKeyName.trim() }),
      })
      if (!res.ok) throw new Error('Failed to create API key')
      const data = await res.json()
      setCreatedRawKey(data.apiKey.rawKey)
      setNewKeyName('')
      fetchKeys()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setCreating(false)
    }
  }

  const handleRevoke = async () => {
    if (!keyToRevoke) return
    setRevoking(true)
    try {
      const res = await fetch(`/api/api-keys/${keyToRevoke}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to revoke API key')
      fetchKeys()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setRevoking(false)
      setKeyToRevoke(null)
    }
  }

  const handleCopy = async (text: string) => {
    await copyToClipboard(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const activeKeys = keys.filter((k) => !k.revokedAt)
  const revokedKeys = keys.filter((k) => k.revokedAt)

  return (
    <>
      {/* Create key UI */}
      {showCreate && !createdRawKey && (
        <div className="mb-4 p-4 rounded-md border-2 border-dashed border-border bg-secondary/30">
          <label htmlFor="api-key-name" className="text-sm font-bold block mb-2">
            Key name
          </label>
          <div className="flex gap-2">
            <input
              id="api-key-name"
              type="text"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              placeholder="e.g. MCP Server"
              className={cn(
                'flex-1 px-3 py-2 rounded-md text-sm',
                'border-[3px] border-border bg-card',
                'shadow-sticker-sm',
                'focus:outline-hidden focus:ring-2 focus:ring-primary/50'
              )}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            />
            <button
              onClick={handleCreate}
              disabled={creating || !newKeyName.trim()}
              className={cn(
                'px-4 py-2 rounded-md text-sm font-bold',
                'bg-sticker-green text-white',
                'border-[3px] border-border shadow-sticker-sm',
                'hover:-translate-y-px hover:shadow-sticker',
                'disabled:opacity-50 disabled:pointer-events-none',
                'transition-all'
              )}
            >
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create'}
            </button>
            <button
              onClick={() => {
                setShowCreate(false)
                setNewKeyName('')
              }}
              className="px-3 py-2 rounded-md text-sm font-bold border-2 border-border text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Show raw key after creation */}
      {createdRawKey && (
        <div className="mb-4 p-4 rounded-md border-2 border-sticker-green/50 bg-sticker-green/5">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="w-4 h-4 text-sticker-green" />
            <span className="text-sm font-bold text-sticker-green">
              Copy your API key now — it won&apos;t be shown again
            </span>
          </div>
          <div className="flex gap-2">
            <code className="flex-1 px-3 py-2 rounded-md text-sm bg-card border-2 border-border font-mono break-all">
              {createdRawKey}
            </code>
            <button
              onClick={() => handleCopy(createdRawKey)}
              className={cn(
                'px-3 py-2 rounded-md border-2 border-border',
                'hover:bg-secondary transition-colors'
              )}
              title="Copy to clipboard"
            >
              {copied ? (
                <Check className="w-4 h-4 text-sticker-green" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </button>
          </div>
          <button
            onClick={() => {
              setCreatedRawKey(null)
              setShowCreate(false)
            }}
            className="mt-3 text-sm font-bold text-muted-foreground hover:text-foreground transition-colors"
          >
            Done
          </button>
        </div>
      )}

      {/* Key list */}
      {loading ? (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="text-sm text-destructive font-medium">{error}</div>
      ) : activeKeys.length > 0 ? (
        <div className="space-y-2">
          {activeKeys.map((key) => (
            <div
              key={key.id}
              className="flex items-center justify-between p-3 rounded-md border-2 border-border bg-card"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center border border-primary/30 shrink-0">
                  <Key className="w-4 h-4 text-primary" />
                </div>
                <div className="min-w-0">
                  <div className="font-bold text-sm truncate">{key.name}</div>
                  <div className="text-xs text-muted-foreground font-mono">
                    {key.keyPrefix}...
                    {key.lastUsedAt && (
                      <span className="ml-2">
                        Last used {new Date(key.lastUsedAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setKeyToRevoke(key.id)}
                className={cn(
                  'p-2 rounded-md shrink-0',
                  'text-muted-foreground hover:text-destructive',
                  'hover:bg-destructive/10 border-2 border-transparent hover:border-destructive/30 transition-all'
                )}
                title="Revoke key"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          No API keys yet. Create one to use with the Bullhorn MCP server or external integrations.
        </p>
      )}

      {/* Revoked keys (collapsed) */}
      {revokedKeys.length > 0 && (
        <div className="mt-3 text-xs text-muted-foreground">
          {revokedKeys.length} revoked key{revokedKeys.length > 1 ? 's' : ''}
        </div>
      )}

      {/* Create button */}
      {!showCreate && !createdRawKey && (
        <button
          onClick={() => setShowCreate(true)}
          className={cn(
            'flex items-center gap-2 px-4 py-2.5 rounded-md w-full mt-3',
            'border-2 border-dashed border-border',
            'text-muted-foreground hover:text-foreground font-medium',
            'hover:border-primary/50 transition-all'
          )}
        >
          <Plus className="w-4 h-4" />
          Create API key
        </button>
      )}

      {/* Revoke confirmation */}
      <ConfirmDialog
        open={!!keyToRevoke}
        onConfirm={handleRevoke}
        onCancel={() => setKeyToRevoke(null)}
        title="Revoke API Key"
        description="Are you sure you want to revoke this API key? Any integrations using it will immediately lose access."
        confirmText={revoking ? 'Revoking...' : 'Revoke'}
        variant="danger"
      />
    </>
  )
}
