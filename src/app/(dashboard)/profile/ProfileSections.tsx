'use client'

import { useState } from 'react'
import { Check, AlertCircle, Trash2, Eye, EyeOff } from 'lucide-react'
import { cn } from '@/lib/utils'
import PasswordStrength from '@/components/ui/PasswordStrength'

// --- Profile Information Section ---

interface ProfileInfoSectionProps {
  initials: string
  displayName: string
  email: string
  hasProfileChanges: boolean
  saving: boolean
  onDisplayNameChange: (name: string) => void
  onSave: () => void
}

// eslint-disable-next-line max-lines-per-function -- component JSX rendering, extraction would fragment UI
export function ProfileInfoSection({
  initials,
  displayName,
  email,
  hasProfileChanges,
  saving,
  onDisplayNameChange,
  onSave,
}: ProfileInfoSectionProps) {
  return (
    <div className="p-6 rounded-md border-[3px] border-border bg-card shadow-sticker mb-6">
      <h2 className="text-sm font-extrabold uppercase tracking-wider text-foreground mb-4">
        👋 Profile Information
      </h2>

      {/* Avatar */}
      <div className="flex items-center gap-4 mb-6">
        <div className="w-16 h-16 rounded-lg bg-sticker-purple flex items-center justify-center text-xl font-bold text-white border-[3px] border-border shadow-sticker-sm">
          {initials}
        </div>
        <div>
          <p className="text-sm font-bold">{displayName || 'No display name set'}</p>
          <p className="text-xs text-muted-foreground">{email}</p>
        </div>
      </div>

      {/* Display Name */}
      <div className="space-y-2">
        <label htmlFor="displayName" className="block text-sm font-bold">
          Display Name
        </label>
        <input
          id="displayName"
          type="text"
          value={displayName}
          onChange={(e) => onDisplayNameChange(e.target.value)}
          placeholder="Enter your display name"
          maxLength={100}
          className={cn(
            'w-full px-4 py-3 rounded-md',
            'bg-card text-foreground placeholder-muted-foreground',
            'border-[3px] border-border',
            'shadow-sticker-sm',
            'focus:outline-hidden focus:ring-2 focus:ring-primary/50',
            'transition-all'
          )}
        />
        <p className="text-xs text-muted-foreground">This name will be shown in the app header.</p>
      </div>

      {/* Save button */}
      <button
        onClick={onSave}
        disabled={!hasProfileChanges || saving}
        className={cn(
          'mt-4 px-4 py-2.5 rounded-md',
          'bg-primary text-primary-foreground font-bold text-sm',
          'border-[3px] border-border',
          'shadow-sticker-sm',
          'hover:-translate-y-px hover:shadow-sticker',
          'active:translate-y-[2px] active:shadow-[1px_1px_0_hsl(var(--border))]',
          'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0',
          'transition-all'
        )}
      >
        {saving ? '⏳ Saving...' : '💾 Save Changes'}
      </button>
    </div>
  )
}

// --- Account & Password Section ---

interface AccountSectionProps {
  email: string
  changingPassword: boolean
  onChangePassword: (newPassword: string) => void
}

// eslint-disable-next-line max-lines-per-function
export function AccountSection({ email, changingPassword, onChangePassword }: AccountSectionProps) {
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null)

  const handleSubmit = () => {
    setPasswordError(null)
    setPasswordSuccess(null)

    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters')
      return
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match')
      return
    }

    onChangePassword(newPassword)
    setNewPassword('')
    setConfirmPassword('')
    setPasswordSuccess('Password updated successfully')
    setTimeout(() => setPasswordSuccess(null), 3000)
  }

  return (
    <div className="p-6 rounded-md border-[3px] border-border bg-card shadow-sticker mb-6">
      <h2 className="text-sm font-extrabold uppercase tracking-wider text-foreground mb-4">
        🔐 Account
      </h2>

      {/* Email (read-only) */}
      <div className="space-y-2 mb-6">
        <label className="block text-sm font-bold">Email Address</label>
        <div
          className={cn(
            'w-full px-4 py-3 rounded-md',
            'bg-muted/50 border-2 border-border text-muted-foreground'
          )}
        >
          {email}
        </div>
        <p className="text-xs text-muted-foreground">Email cannot be changed.</p>
      </div>

      {/* Password Change */}
      <div className="border-t-2 border-border pt-6">
        <h3 className="text-sm font-bold mb-4">🔑 Change Password</h3>

        {passwordSuccess && (
          <div className="flex items-center gap-2 p-4 rounded-md bg-sticker-green/10 text-sticker-green border-2 border-sticker-green/30 mb-4 animate-slide-up font-bold">
            <Check className="w-4 h-4" />
            {passwordSuccess}
          </div>
        )}

        {passwordError && (
          <div className="flex items-center gap-2 p-4 rounded-md bg-destructive/10 text-destructive border-2 border-destructive/30 mb-4 animate-slide-up font-medium">
            <AlertCircle className="w-4 h-4" />
            {passwordError}
          </div>
        )}

        <div className="space-y-4">
          {/* New Password */}
          <div className="space-y-2">
            <label htmlFor="newPassword" className="block text-sm font-bold">
              New Password
            </label>
            <div className="relative">
              <input
                id="newPassword"
                type={showNewPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
                className={cn(
                  'w-full px-4 py-3 pr-10 rounded-md',
                  'bg-card text-foreground placeholder-muted-foreground',
                  'border-[3px] border-border',
                  'shadow-sticker-sm',
                  'focus:outline-hidden focus:ring-2 focus:ring-primary/50',
                  'transition-all'
                )}
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
              >
                {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <PasswordStrength password={newPassword} />
          </div>

          {/* Confirm Password */}
          <div className="space-y-2">
            <label htmlFor="confirmPassword" className="block text-sm font-bold">
              Confirm New Password
            </label>
            <div className="relative">
              <input
                id="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                className={cn(
                  'w-full px-4 py-3 pr-10 rounded-md',
                  'bg-card text-foreground placeholder-muted-foreground',
                  'border-[3px] border-border',
                  'shadow-sticker-sm',
                  'focus:outline-hidden focus:ring-2 focus:ring-primary/50',
                  'transition-all'
                )}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            onClick={handleSubmit}
            disabled={!newPassword || !confirmPassword || changingPassword}
            className={cn(
              'px-4 py-2.5 rounded-md',
              'bg-sticker-blue text-white font-bold text-sm',
              'border-[3px] border-border',
              'shadow-sticker-sm',
              'hover:-translate-y-px hover:shadow-sticker',
              'active:translate-y-[2px] active:shadow-[1px_1px_0_hsl(var(--border))]',
              'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0',
              'transition-all'
            )}
          >
            {changingPassword ? '⏳ Updating...' : '🔒 Update Password'}
          </button>
        </div>
      </div>
    </div>
  )
}

// --- Danger Zone Section ---

interface DangerZoneSectionProps {
  onDeleteClick: () => void
}

export function DangerZoneSection({ onDeleteClick }: DangerZoneSectionProps) {
  return (
    <div className="p-6 rounded-md border-[3px] border-destructive/50 bg-card shadow-[4px_4px_0_hsl(var(--destructive)/0.3)]">
      <h2 className="text-sm font-extrabold uppercase tracking-wider text-destructive mb-4">
        ⚠️ Danger Zone
      </h2>
      <p className="text-sm text-muted-foreground mb-4">
        Once you delete your account, there is no going back. All your data will be permanently
        removed.
      </p>
      <button
        onClick={onDeleteClick}
        className={cn(
          'flex items-center gap-2 px-4 py-2.5 rounded-md',
          'bg-destructive text-destructive-foreground font-bold text-sm',
          'border-[3px] border-border',
          'shadow-sticker-sm',
          'hover:-translate-y-px hover:shadow-sticker',
          'transition-all'
        )}
      >
        <Trash2 className="w-4 h-4" />
        Delete Account
      </button>
    </div>
  )
}
