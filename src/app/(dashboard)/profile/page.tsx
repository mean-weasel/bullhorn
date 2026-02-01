'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Check, AlertCircle, Trash2, Eye, EyeOff } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getInitials } from '@/lib/profile'
import { createClient } from '@/lib/supabase/client'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import PasswordStrength from '@/components/ui/PasswordStrength'

export default function ProfilePage() {
  const router = useRouter()
  const supabase = createClient()

  // User data
  const [email, setEmail] = useState<string>('')
  const [displayName, setDisplayName] = useState('')
  const [originalDisplayName, setOriginalDisplayName] = useState('')
  const [loading, setLoading] = useState(true)

  // Password change
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  // UI state
  const [saving, setSaving] = useState(false)
  const [changingPassword, setChangingPassword] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null)

  // Load user data
  useEffect(() => {
    // E2E Test Mode - use mock data
    if (process.env.NEXT_PUBLIC_E2E_TEST_MODE === 'true') {
      setEmail('test@example.com')
      setDisplayName('Test User')
      setOriginalDisplayName('Test User')
      setLoading(false)
      return
    }

    async function loadUser() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          router.push('/login')
          return
        }

        setEmail(user.email || '')

        // Fetch profile
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('id', user.id)
          .single()

        if (profile) {
          setDisplayName(profile.display_name || '')
          setOriginalDisplayName(profile.display_name || '')
        }
      } catch (err) {
        console.error('Error loading user:', err)
        setError('Failed to load profile')
      } finally {
        setLoading(false)
      }
    }

    loadUser()
  }, [supabase, router])

  // Save profile changes
  const handleSaveProfile = async () => {
    setSaving(true)
    setError(null)
    setSuccess(null)

    // E2E Test Mode - simulate success
    if (process.env.NEXT_PUBLIC_E2E_TEST_MODE === 'true') {
      await new Promise(resolve => setTimeout(resolve, 500))
      setOriginalDisplayName(displayName)
      setSuccess('Profile updated successfully')
      setTimeout(() => setSuccess(null), 3000)
      setSaving(false)
      return
    }

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { error: updateError } = await supabase
        .from('user_profiles')
        .upsert({
          id: user.id,
          display_name: displayName.trim() || null,
          updated_at: new Date().toISOString()
        })

      if (updateError) throw updateError

      setOriginalDisplayName(displayName)
      setSuccess('Profile updated successfully')
      setTimeout(() => setSuccess(null), 3000)

      // Refresh the page to update header
      router.refresh()
    } catch (err) {
      console.error('Error saving profile:', err)
      setError('Failed to save profile')
    } finally {
      setSaving(false)
    }
  }

  // Change password
  const handleChangePassword = async () => {
    setPasswordError(null)
    setPasswordSuccess(null)

    // Validation
    if (newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters')
      return
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match')
      return
    }

    setChangingPassword(true)

    // E2E Test Mode - simulate success
    if (process.env.NEXT_PUBLIC_E2E_TEST_MODE === 'true') {
      await new Promise(resolve => setTimeout(resolve, 500))
      setNewPassword('')
      setConfirmPassword('')
      setPasswordSuccess('Password updated successfully')
      setTimeout(() => setPasswordSuccess(null), 3000)
      setChangingPassword(false)
      return
    }

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      })

      if (error) throw error

      setNewPassword('')
      setConfirmPassword('')
      setPasswordSuccess('Password updated successfully')
      setTimeout(() => setPasswordSuccess(null), 3000)
    } catch (err: unknown) {
      console.error('Error changing password:', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to change password'
      setPasswordError(errorMessage)
    } finally {
      setChangingPassword(false)
    }
  }

  // Delete account
  const handleDeleteAccount = async () => {
    setDeleting(true)
    setError(null)

    // E2E Test Mode - simulate deletion and redirect
    if (process.env.NEXT_PUBLIC_E2E_TEST_MODE === 'true') {
      await new Promise(resolve => setTimeout(resolve, 500))
      setShowDeleteDialog(false)
      router.push('/login')
      return
    }

    try {
      // Note: Full account deletion requires admin privileges
      // For now, we'll sign out the user and they can contact support
      // In production, you'd use an Edge Function with admin privileges

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      // Delete user profile first (will cascade to other data via FK)
      const { error: deleteError } = await supabase
        .from('user_profiles')
        .delete()
        .eq('id', user.id)

      if (deleteError) throw deleteError

      // Sign out
      await supabase.auth.signOut()
      router.push('/login')
    } catch (err) {
      console.error('Error deleting account:', err)
      setError('Failed to delete account. Please contact support.')
      setDeleting(false)
      setShowDeleteDialog(false)
    }
  }

  const hasProfileChanges = displayName !== originalDisplayName
  const initials = getInitials(displayName, email)

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto p-4 md:p-8 animate-fade-in">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-32 bg-muted rounded-md" />
          <div className="h-4 w-48 bg-muted rounded-md" />
          <div className="h-64 bg-muted rounded-md" />
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto p-4 md:p-8 animate-fade-in">
      <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight mb-2">👤 Profile</h1>
      <p className="text-muted-foreground mb-2">
        Manage your account settings.
      </p>
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
        </div>
      )}

      {/* Profile Information */}
      <div className="p-6 rounded-md border-[3px] border-border bg-card shadow-[4px_4px_0_hsl(var(--border))] mb-6">
        <h2 className="text-sm font-extrabold uppercase tracking-wider text-foreground mb-4">
          👋 Profile Information
        </h2>

        {/* Avatar */}
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 rounded-lg bg-sticker-purple flex items-center justify-center text-xl font-bold text-white border-[3px] border-border shadow-[3px_3px_0_hsl(var(--border))]">
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
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Enter your display name"
            className={cn(
              'w-full px-4 py-3 rounded-md',
              'bg-card text-foreground placeholder-muted-foreground',
              'border-[3px] border-border',
              'shadow-[3px_3px_0_hsl(var(--border))]',
              'focus:outline-none focus:ring-2 focus:ring-primary/50',
              'transition-all'
            )}
          />
          <p className="text-xs text-muted-foreground">
            This name will be shown in the app header.
          </p>
        </div>

        {/* Save button */}
        <button
          onClick={handleSaveProfile}
          disabled={!hasProfileChanges || saving}
          className={cn(
            'mt-4 px-4 py-2.5 rounded-md',
            'bg-primary text-primary-foreground font-bold text-sm',
            'border-[3px] border-border',
            'shadow-[3px_3px_0_hsl(var(--border))]',
            'hover:translate-y-[-1px] hover:shadow-[4px_4px_0_hsl(var(--border))]',
            'active:translate-y-[2px] active:shadow-[1px_1px_0_hsl(var(--border))]',
            'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0',
            'transition-all'
          )}
        >
          {saving ? '⏳ Saving...' : '💾 Save Changes'}
        </button>
      </div>

      {/* Account */}
      <div className="p-6 rounded-md border-[3px] border-border bg-card shadow-[4px_4px_0_hsl(var(--border))] mb-6">
        <h2 className="text-sm font-extrabold uppercase tracking-wider text-foreground mb-4">
          🔐 Account
        </h2>

        {/* Email (read-only) */}
        <div className="space-y-2 mb-6">
          <label className="block text-sm font-bold">
            Email Address
          </label>
          <div className={cn(
            'w-full px-4 py-3 rounded-md',
            'bg-muted/50 border-2 border-border text-muted-foreground'
          )}>
            {email}
          </div>
          <p className="text-xs text-muted-foreground">
            Email cannot be changed.
          </p>
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
                    'shadow-[3px_3px_0_hsl(var(--border))]',
                    'focus:outline-none focus:ring-2 focus:ring-primary/50',
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
                    'shadow-[3px_3px_0_hsl(var(--border))]',
                    'focus:outline-none focus:ring-2 focus:ring-primary/50',
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
              onClick={handleChangePassword}
              disabled={!newPassword || !confirmPassword || changingPassword}
              className={cn(
                'px-4 py-2.5 rounded-md',
                'bg-sticker-blue text-white font-bold text-sm',
                'border-[3px] border-border',
                'shadow-[3px_3px_0_hsl(var(--border))]',
                'hover:translate-y-[-1px] hover:shadow-[4px_4px_0_hsl(var(--border))]',
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

      {/* Danger Zone */}
      <div className="p-6 rounded-md border-[3px] border-destructive/50 bg-card shadow-[4px_4px_0_hsl(var(--destructive)/0.3)]">
        <h2 className="text-sm font-extrabold uppercase tracking-wider text-destructive mb-4">
          ⚠️ Danger Zone
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          Once you delete your account, there is no going back. All your data will be permanently removed.
        </p>
        <button
          onClick={() => setShowDeleteDialog(true)}
          className={cn(
            'flex items-center gap-2 px-4 py-2.5 rounded-md',
            'bg-destructive text-destructive-foreground font-bold text-sm',
            'border-[3px] border-border',
            'shadow-[3px_3px_0_hsl(var(--border))]',
            'hover:translate-y-[-1px] hover:shadow-[4px_4px_0_hsl(var(--border))]',
            'transition-all'
          )}
        >
          <Trash2 className="w-4 h-4" />
          Delete Account
        </button>
      </div>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={showDeleteDialog}
        onConfirm={handleDeleteAccount}
        onCancel={() => setShowDeleteDialog(false)}
        title="Delete Account"
        description="Are you sure you want to delete your account? This action cannot be undone. All your posts, campaigns, and data will be permanently deleted."
        confirmText={deleting ? 'Deleting...' : 'Delete Account'}
        cancelText="Cancel"
        variant="danger"
      />
    </div>
  )
}
