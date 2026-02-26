'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Check, AlertCircle } from 'lucide-react'
import { getInitials } from '@/lib/profile'
import { createClient } from '@/lib/supabase/client'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { ProfileInfoSection, AccountSection, DangerZoneSection } from './ProfileSections'

export default function ProfilePage() {
  const router = useRouter()
  const supabase = createClient()

  // User data
  const [email, setEmail] = useState<string>('')
  const [displayName, setDisplayName] = useState('')
  const [originalDisplayName, setOriginalDisplayName] = useState('')
  const [loading, setLoading] = useState(true)

  // UI state
  const [saving, setSaving] = useState(false)
  const [changingPassword, setChangingPassword] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

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
        const {
          data: { user },
        } = await supabase.auth.getUser()
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
      await new Promise((resolve) => setTimeout(resolve, 500))
      setOriginalDisplayName(displayName)
      setSuccess('Profile updated successfully')
      setTimeout(() => setSuccess(null), 3000)
      setSaving(false)
      return
    }

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { error: updateError } = await supabase.from('user_profiles').upsert({
        id: user.id,
        display_name: displayName.trim() || null,
        updated_at: new Date().toISOString(),
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
  const handleChangePassword = async (newPassword: string) => {
    setChangingPassword(true)

    // E2E Test Mode - simulate success
    if (process.env.NEXT_PUBLIC_E2E_TEST_MODE === 'true') {
      await new Promise((resolve) => setTimeout(resolve, 500))
      setChangingPassword(false)
      return
    }

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      })

      if (error) throw error
    } catch (err: unknown) {
      console.error('Error changing password:', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to change password'
      setError(errorMessage)
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
      await new Promise((resolve) => setTimeout(resolve, 500))
      setShowDeleteDialog(false)
      router.push('/login')
      return
    }

    try {
      const res = await fetch('/api/account/delete', { method: 'POST' })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete account')
      }

      // Sign out locally and redirect
      await supabase.auth.signOut()
      router.push('/login')
    } catch (err) {
      console.error('Error deleting account:', err)
      setError((err as Error).message || 'Failed to delete account. Please contact support.')
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
      <p className="text-muted-foreground mb-2">Manage your account settings.</p>
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
      <ProfileInfoSection
        initials={initials}
        displayName={displayName}
        email={email}
        hasProfileChanges={hasProfileChanges}
        saving={saving}
        onDisplayNameChange={setDisplayName}
        onSave={handleSaveProfile}
      />

      {/* Account */}
      <AccountSection
        email={email}
        changingPassword={changingPassword}
        onChangePassword={handleChangePassword}
      />

      {/* Danger Zone */}
      <DangerZoneSection onDeleteClick={() => setShowDeleteDialog(true)} />

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
