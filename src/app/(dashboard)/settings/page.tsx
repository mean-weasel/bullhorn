'use client'
/* eslint-disable max-lines -- large page component with extracted sub-components */

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { Check, AlertCircle, Key } from 'lucide-react'
import { useTheme } from '@/lib/theme'
import { useNotificationStore } from '@/lib/notifications'
import { usePushNotifications } from '@/hooks/usePushNotifications'
import { useAnalyticsStore, useAnalyticsConnections } from '@/lib/analyticsStore'
import {
  useSocialAccountsStore,
  useSocialAccounts,
  useSocialAccountsLoading,
} from '@/lib/socialAccounts'
import { ConnectAnalyticsModal } from '@/components/analytics/ConnectAnalyticsModal'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { ApiKeyManager } from '@/components/ui/ApiKeyManager'
import { ThemeSection, AnalyticsSection, AboutSection } from './SettingsSections'
import { ConnectedAccountsSection } from './ConnectedAccountsSection'
import { DataManagementSection } from './DataManagementSection'
import { PlanSection } from './PlanSection'
import { BiometricSection } from './BiometricSection'
import {
  PushNotificationsSection,
  EmailNotificationsSection,
  EmailPreferences,
} from './NotificationSections'

// eslint-disable-next-line max-lines-per-function
export default function SettingsPage() {
  const searchParams = useSearchParams()
  const { theme, setTheme } = useTheme()
  const { enabled: notificationsEnabled, setEnabled: setNotificationsEnabled } =
    useNotificationStore()
  const [success, setSuccess] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Email notification preferences state
  const [emailPrefs, setEmailPrefs] = useState<EmailPreferences | null>(null)
  const [emailPrefsLoading, setEmailPrefsLoading] = useState(true)
  const [emailPrefsSaving, setEmailPrefsSaving] = useState(false)

  // Analytics state
  const [showConnectModal, setShowConnectModal] = useState(false)
  const [pendingConnectionId, setPendingConnectionId] = useState<string | undefined>(undefined)
  const [connectionToDelete, setConnectionToDelete] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // Social accounts state
  const [accountToDisconnect, setAccountToDisconnect] = useState<string | null>(null)

  const {
    isSupported: pushSupported,
    permission: pushPermission,
    subscribed: pushSubscribed,
    loading: pushLoading,
    subscribe: pushSubscribe,
    unsubscribe: pushUnsubscribe,
    sendTestNotification,
  } = usePushNotifications()

  const { fetchConnections, deleteConnection, loading: analyticsLoading } = useAnalyticsStore()
  const connections = useAnalyticsConnections()

  const { fetchAccounts, deleteAccount } = useSocialAccountsStore()
  const socialAccounts = useSocialAccounts()
  const socialAccountsLoading = useSocialAccountsLoading()

  useEffect(() => {
    fetchConnections()
    fetchAccounts()
  }, [fetchConnections, fetchAccounts])

  // Fetch email notification preferences on mount
  const fetchEmailPrefs = useCallback(async () => {
    try {
      setEmailPrefsLoading(true)
      const res = await fetch('/api/notification-preferences')
      if (!res.ok) throw new Error('Failed to fetch')
      const data = await res.json()
      setEmailPrefs(data.preferences)
    } catch (err) {
      console.error('Failed to load email preferences:', err)
    } finally {
      setEmailPrefsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchEmailPrefs()
  }, [fetchEmailPrefs])

  const handleEmailPrefToggle = async (key: keyof EmailPreferences, value: boolean) => {
    if (!emailPrefs) return

    // Optimistic update
    const previous = { ...emailPrefs }
    setEmailPrefs({ ...emailPrefs, [key]: value })
    setEmailPrefsSaving(true)

    try {
      const res = await fetch('/api/notification-preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: value }),
      })
      if (!res.ok) throw new Error('Failed to save')
      const data = await res.json()
      setEmailPrefs(data.preferences)
    } catch (err) {
      // Roll back on failure
      setEmailPrefs(previous)
      setError('Failed to save notification preference')
      console.error('Failed to update email preference:', err)
    } finally {
      setEmailPrefsSaving(false)
    }
  }

  // Handle OAuth callback params
  useEffect(() => {
    const analyticsAuth = searchParams.get('analytics_auth')
    const connectionId = searchParams.get('connection_id')
    const connectedPlatform = searchParams.get('connected')
    const errorParam = searchParams.get('error')

    if (analyticsAuth === 'success' && connectionId) {
      setPendingConnectionId(connectionId)
      setShowConnectModal(true)
      window.history.replaceState({}, '', '/settings')
    } else if (connectedPlatform) {
      const names: Record<string, string> = {
        twitter: 'Twitter/X',
        linkedin: 'LinkedIn',
        reddit: 'Reddit',
      }
      setSuccess(`${names[connectedPlatform] || connectedPlatform} connected successfully!`)
      fetchAccounts()
      setTimeout(() => setSuccess(null), 3000)
      window.history.replaceState({}, '', '/settings')
    } else if (errorParam) {
      const errorMessages: Record<string, string> = {
        unauthorized: 'Please sign in to connect Google Analytics',
        oauth_denied: 'Google Analytics access was denied',
        missing_code: 'OAuth callback missing authorization code',
        not_configured: 'Google Analytics integration is not configured',
        token_exchange_failed: 'Failed to exchange authorization code',
        missing_tokens: 'Failed to receive access tokens',
        callback_failed: 'OAuth callback failed',
      }
      setError(errorMessages[errorParam] || 'Connection failed')
      window.history.replaceState({}, '', '/settings')
    }
  }, [searchParams, fetchAccounts])

  const handleToggleNotifications = (enabled: boolean) => {
    setNotificationsEnabled(enabled)
  }

  const handlePushSubscribe = async () => {
    const ok = await pushSubscribe()
    if (ok) {
      setNotificationsEnabled(true)
      setSuccess('Push notifications enabled!')
      setTimeout(() => setSuccess(null), 3000)
    }
  }

  const handlePushUnsubscribe = async () => {
    const ok = await pushUnsubscribe()
    if (ok) {
      setSuccess('Push notifications disabled')
      setTimeout(() => setSuccess(null), 3000)
    }
  }

  const handleTestNotification = async () => {
    await sendTestNotification()
  }

  const handleConnectAnalytics = () => {
    setPendingConnectionId(undefined)
    setShowConnectModal(true)
  }

  const handleConnectSuccess = () => {
    setPendingConnectionId(undefined)
    fetchConnections()
    setSuccess('Google Analytics connected successfully!')
    setTimeout(() => setSuccess(null), 3000)
  }

  const handleDeleteConnection = async () => {
    if (!connectionToDelete) return

    setIsDeleting(true)
    try {
      await deleteConnection(connectionToDelete)
      setSuccess('Analytics connection removed')
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      setError((err as Error).message || 'Failed to remove connection')
    } finally {
      setIsDeleting(false)
      setConnectionToDelete(null)
    }
  }

  const handleDisconnectAccount = async () => {
    if (!accountToDisconnect) return
    try {
      await deleteAccount(accountToDisconnect)
      setSuccess('Account disconnected')
      setTimeout(() => setSuccess(null), 3000)
    } catch {
      setError('Failed to disconnect account')
    } finally {
      setAccountToDisconnect(null)
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-4 md:p-8 animate-fade-in">
      <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight mb-2">⚙️ Settings</h1>
      <p className="text-muted-foreground mb-2">Configure your preferences.</p>
      <div className="h-1 w-20 gradient-bar mb-8 rounded-full" />

      {/* Status messages */}
      {success && (
        <div className="flex items-center gap-2 p-4 rounded-md bg-sticker-green/10 text-sticker-green border-2 border-sticker-green/30 mb-6 animate-slide-up font-bold">
          <Check className="w-4 h-4" />
          {success}
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 p-4 rounded-md bg-destructive/10 text-destructive border-2 border-destructive/30 mb-6 animate-slide-up font-medium">
          <AlertCircle className="w-4 h-4" />
          {error}
          <button
            onClick={() => setError(null)}
            className="ml-auto text-sm font-bold hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Plan & Usage */}
      <PlanSection />

      {/* Theme */}
      <ThemeSection theme={theme} setTheme={setTheme} />

      {/* Biometric Lock (iOS only) */}
      <BiometricSection />

      {/* Notifications */}
      <PushNotificationsSection
        pushSupported={pushSupported}
        pushPermission={pushPermission}
        pushSubscribed={pushSubscribed}
        pushLoading={pushLoading}
        notificationsEnabled={notificationsEnabled}
        onToggleNotifications={handleToggleNotifications}
        onPushSubscribe={handlePushSubscribe}
        onPushUnsubscribe={handlePushUnsubscribe}
        onTestNotification={handleTestNotification}
      />

      {/* Email Notifications */}
      <EmailNotificationsSection
        emailPrefs={emailPrefs}
        emailPrefsLoading={emailPrefsLoading}
        emailPrefsSaving={emailPrefsSaving}
        onToggle={handleEmailPrefToggle}
        onRetry={fetchEmailPrefs}
      />

      {/* Analytics */}
      <AnalyticsSection
        connections={connections}
        analyticsLoading={analyticsLoading}
        onConnect={handleConnectAnalytics}
        onDeleteConnection={(id) => setConnectionToDelete(id)}
      />

      {/* Connected Social Accounts */}
      <ConnectedAccountsSection
        accounts={socialAccounts}
        loading={socialAccountsLoading}
        onConnect={() => {}}
        onDisconnect={(id) => setAccountToDisconnect(id)}
      />

      {/* API Keys */}
      <div className="p-6 rounded-md border-[3px] border-border bg-card shadow-sticker mb-6">
        <h2 className="text-sm font-extrabold uppercase tracking-wider text-foreground mb-4">
          <Key className="w-4 h-4 inline-block mr-1 -mt-0.5" /> API Keys
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          Create API keys for the Bullhorn MCP server or external integrations.{' '}
          <a href="/docs/mcp" className="text-primary font-semibold hover:underline">
            Learn how to set up the MCP server &rarr;
          </a>
        </p>
        <ApiKeyManager />
      </div>

      {/* Data Management */}
      <DataManagementSection />

      {/* About */}
      <AboutSection />

      {/* Connect Analytics Modal */}
      <ConnectAnalyticsModal
        open={showConnectModal}
        onClose={() => {
          setShowConnectModal(false)
          setPendingConnectionId(undefined)
        }}
        pendingConnectionId={pendingConnectionId}
        onSuccess={handleConnectSuccess}
      />

      {/* Delete Analytics Connection Dialog */}
      <ConfirmDialog
        open={!!connectionToDelete}
        onConfirm={handleDeleteConnection}
        onCancel={() => setConnectionToDelete(null)}
        title="Remove Analytics Connection"
        description="Are you sure you want to remove this Google Analytics connection? You can reconnect it later."
        confirmText={isDeleting ? 'Removing...' : 'Remove'}
        variant="danger"
      />

      {/* Disconnect Social Account Dialog */}
      <ConfirmDialog
        open={!!accountToDisconnect}
        onConfirm={handleDisconnectAccount}
        onCancel={() => setAccountToDisconnect(null)}
        title="Disconnect Account"
        description="Are you sure you want to disconnect this social media account? You can reconnect it later."
        confirmText="Disconnect"
        variant="danger"
      />
    </div>
  )
}
