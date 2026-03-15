'use client'

import { Bell, BellOff, AlertCircle, Loader2, Send, Mail } from 'lucide-react'
import { cn } from '@/lib/utils'
import { IOSToggleSwitch } from '@/components/ui/IOSToggleSwitch'

// --- Push Notifications Section ---

interface PushNotificationsSectionProps {
  pushSupported: boolean
  pushPermission: NotificationPermission | 'default'
  pushSubscribed: boolean
  pushLoading: boolean
  notificationsEnabled: boolean
  onToggleNotifications: (enabled: boolean) => void
  onPushSubscribe: () => void
  onPushUnsubscribe: () => void
  onTestNotification: () => void
}

// eslint-disable-next-line max-lines-per-function -- component JSX rendering, extraction would fragment UI
export function PushNotificationsSection({
  pushSupported,
  pushPermission,
  pushSubscribed,
  pushLoading,
  notificationsEnabled,
  onToggleNotifications,
  onPushSubscribe,
  onPushUnsubscribe,
  onTestNotification,
}: PushNotificationsSectionProps) {
  return (
    <div className="p-6 rounded-md border-[3px] border-border bg-card shadow-sticker mb-6">
      <h2 className="text-sm font-extrabold uppercase tracking-wider text-foreground mb-4">
        🔔 Notifications
      </h2>
      <p className="text-sm text-muted-foreground mb-4">
        Get notified when your scheduled posts are due.
      </p>

      {!pushSupported ? (
        <div className="flex items-center gap-2 p-4 rounded-md bg-muted/50 text-muted-foreground border-2 border-border">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <div>
            <p className="font-bold">Not supported</p>
            <p className="text-sm opacity-80">
              Push notifications are not supported in this browser.
            </p>
          </div>
        </div>
      ) : pushPermission === 'denied' ? (
        <div className="p-4 rounded-md bg-destructive/10 text-destructive border-2 border-destructive/30">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <p className="font-bold">Notifications blocked</p>
          </div>
          <p className="text-sm opacity-80 mt-2">
            You previously blocked notifications. To re-enable them:
          </p>
          <ol className="text-sm opacity-80 mt-1 ml-4 list-decimal space-y-0.5">
            <li>Click the lock/tune icon in your browser&apos;s address bar</li>
            <li>Find &quot;Notifications&quot; and change it to &quot;Allow&quot;</li>
            <li>Reload this page</li>
          </ol>
        </div>
      ) : !pushSubscribed ? (
        <button
          onClick={onPushSubscribe}
          disabled={pushLoading}
          className={cn(
            'flex items-center gap-2 px-4 py-3 rounded-md w-full',
            'bg-primary text-primary-foreground font-bold text-sm',
            'border-[3px] border-border',
            'shadow-sticker-sm',
            'hover:-translate-y-px hover:shadow-sticker',
            'transition-all',
            'disabled:opacity-60 disabled:cursor-not-allowed'
          )}
        >
          {pushLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Bell className="w-4 h-4" />
          )}
          Enable Push Notifications
        </button>
      ) : (
        <PushNotificationsEnabled
          notificationsEnabled={notificationsEnabled}
          pushLoading={pushLoading}
          onToggleNotifications={onToggleNotifications}
          onPushUnsubscribe={onPushUnsubscribe}
          onTestNotification={onTestNotification}
        />
      )}
    </div>
  )
}

// eslint-disable-next-line max-lines-per-function -- component JSX rendering, extraction would fragment UI
function PushNotificationsEnabled({
  notificationsEnabled,
  pushLoading,
  onToggleNotifications,
  onPushUnsubscribe,
  onTestNotification,
}: {
  notificationsEnabled: boolean
  pushLoading: boolean
  onToggleNotifications: (enabled: boolean) => void
  onPushUnsubscribe: () => void
  onTestNotification: () => void
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-sticker-green font-bold">
        <Bell className="w-4 h-4" />
        Push notifications enabled
      </div>
      <div className="flex items-center gap-3 px-4 py-3 rounded-md border-2 border-border bg-card">
        {notificationsEnabled ? (
          <Bell className="w-5 h-5 text-primary shrink-0" />
        ) : (
          <BellOff className="w-5 h-5 text-muted-foreground shrink-0" />
        )}
        <IOSToggleSwitch
          checked={notificationsEnabled}
          onChange={onToggleNotifications}
          label="Post reminders"
          description="Notify when scheduled posts are due"
        />
      </div>
      <div className="flex gap-2">
        <button
          onClick={onTestNotification}
          className={cn(
            'flex items-center gap-2 px-3 py-2 rounded-md',
            'text-sm font-bold',
            'border-[3px] border-border bg-card',
            'shadow-sticker-hover',
            'hover:-translate-y-px hover:shadow-sticker-sm',
            'transition-all'
          )}
        >
          <Send className="w-3.5 h-3.5" />
          Send test notification
        </button>
        <button
          onClick={onPushUnsubscribe}
          disabled={pushLoading}
          className={cn(
            'flex items-center gap-2 px-3 py-2 rounded-md',
            'text-sm font-medium text-muted-foreground',
            'border-2 border-border bg-card',
            'hover:text-destructive hover:border-destructive/30 hover:bg-destructive/5',
            'transition-all',
            'disabled:opacity-60 disabled:cursor-not-allowed'
          )}
        >
          {pushLoading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <BellOff className="w-3.5 h-3.5" />
          )}
          Unsubscribe
        </button>
      </div>
    </div>
  )
}

// --- Email Notifications Section ---

export interface EmailPreferences {
  emailPostPublished: boolean
  emailPostFailed: boolean
  emailWeeklyDigest: boolean
  emailCampaignReminder: boolean
  pushEnabled: boolean
}

interface EmailNotificationsSectionProps {
  emailPrefs: EmailPreferences | null
  emailPrefsLoading: boolean
  emailPrefsSaving: boolean
  onToggle: (key: keyof EmailPreferences, value: boolean) => void
  onRetry?: () => void
}

// eslint-disable-next-line max-lines-per-function -- component JSX rendering, extraction would fragment UI
export function EmailNotificationsSection({
  emailPrefs,
  emailPrefsLoading,
  emailPrefsSaving,
  onToggle,
  onRetry,
}: EmailNotificationsSectionProps) {
  return (
    <div className="p-6 rounded-md border-[3px] border-border bg-card shadow-sticker mb-6">
      <h2 className="text-sm font-extrabold uppercase tracking-wider text-foreground mb-4">
        <Mail className="w-4 h-4 inline-block mr-1 -mt-0.5" /> Email Notifications
      </h2>
      <p className="text-sm text-muted-foreground mb-2">
        Choose which email notifications you&apos;d like to receive.
      </p>
      <p className="text-xs text-muted-foreground mb-4 italic">
        Email notifications coming soon. Your preferences are saved and will take effect when email
        delivery is enabled.
      </p>

      {emailPrefsLoading ? (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : emailPrefs ? (
        <div className="space-y-1 opacity-50 pointer-events-none">
          {(
            [
              {
                key: 'emailPostPublished' as const,
                label: 'Post published',
                desc: 'Get notified when a scheduled post is published',
              },
              {
                key: 'emailPostFailed' as const,
                label: 'Post failed',
                desc: 'Get notified when a post fails to publish',
              },
              {
                key: 'emailWeeklyDigest' as const,
                label: 'Weekly digest',
                desc: 'Receive a weekly summary of your post activity',
              },
              {
                key: 'emailCampaignReminder' as const,
                label: 'Campaign reminders',
                desc: 'Get reminded about upcoming campaign deadlines',
              },
            ] as const
          ).map((item) => (
            <div
              key={item.key}
              className={cn(
                'flex items-center gap-3 px-4 py-3 rounded-md border-2 border-border bg-card',
                emailPrefsSaving && 'opacity-70 pointer-events-none'
              )}
            >
              <IOSToggleSwitch
                checked={emailPrefs[item.key]}
                onChange={(val) => onToggle(item.key, val)}
                label={item.label}
                description={item.desc}
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="flex items-center gap-2 p-4 rounded-md bg-muted/50 text-muted-foreground border-2 border-border">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <div className="flex-1">
            <p className="text-sm">Failed to load email preferences.</p>
            {onRetry && (
              <button
                onClick={onRetry}
                className="text-sm font-medium text-primary hover:underline mt-1"
              >
                Try again
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
