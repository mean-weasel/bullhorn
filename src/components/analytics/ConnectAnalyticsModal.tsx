'use client'

import { useState, useEffect } from 'react'
import { BarChart3, ExternalLink, Check, Loader2 } from 'lucide-react'
import { useAnalyticsStore } from '@/lib/analyticsStore'
import { cn } from '@/lib/utils'
import {
  ResponsiveDialog,
  ResponsiveDialogDescription,
  ResponsiveDialogActions,
  ResponsiveDialogButton,
} from '@/components/ui/ResponsiveDialog'

interface GA4Property {
  propertyId: string
  displayName: string
  accountName: string
  timeZone?: string
  currencyCode?: string
}

interface ConnectAnalyticsModalProps {
  open: boolean
  onClose: () => void
  pendingConnectionId?: string
  onSuccess?: () => void
}

type Step = 'connect' | 'select-property' | 'success'

// eslint-disable-next-line max-lines-per-function
export function ConnectAnalyticsModal({
  open,
  onClose,
  pendingConnectionId,
  onSuccess,
}: ConnectAnalyticsModalProps) {
  const [step, setStep] = useState<Step>('connect')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [properties, setProperties] = useState<GA4Property[]>([])
  const [selectedProperty, setSelectedProperty] = useState<GA4Property | null>(null)

  const { updateConnection } = useAnalyticsStore()

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setError(null)
      if (pendingConnectionId) {
        // Fetch properties for the pending connection
        setStep('select-property')
        fetchPendingConnection(pendingConnectionId)
      } else {
        setStep('connect')
      }
    }
  }, [open, pendingConnectionId])

  const fetchPendingConnection = async (connectionId: string) => {
    setIsLoading(true)
    setError(null)

    try {
      await fetchProperties(connectionId)
    } catch (err) {
      setError((err as Error).message || 'Failed to load authentication data')
      setIsLoading(false)
    }
  }

  const handleConnect = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/analytics/auth/url')
      if (!res.ok) {
        throw new Error('Failed to get OAuth URL')
      }
      const data = await res.json()

      // Redirect to Google OAuth
      window.location.href = data.url
    } catch (err) {
      setError((err as Error).message || 'Failed to connect')
      setIsLoading(false)
    }
  }

  const fetchProperties = async (connectionId: string) => {
    setIsLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/analytics/properties?connectionId=${connectionId}`)

      if (!res.ok) {
        throw new Error('Failed to fetch properties')
      }

      const data = await res.json()
      setProperties(data.properties || [])

      if (data.properties?.length === 0) {
        setError('No Google Analytics 4 properties found for your account.')
      }
    } catch (err) {
      setError((err as Error).message || 'Failed to fetch properties')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSelectProperty = async () => {
    if (!selectedProperty || !pendingConnectionId) return

    setIsLoading(true)
    setError(null)

    try {
      // Update the pending connection with the selected property
      await updateConnection(pendingConnectionId, {
        propertyId: selectedProperty.propertyId,
        propertyName: selectedProperty.displayName,
        syncStatus: 'pending',
      })

      setStep('success')
      setTimeout(() => {
        onSuccess?.()
        onClose()
      }, 1500)
    } catch (err) {
      setError((err as Error).message || 'Failed to create connection')
      setIsLoading(false)
    }
  }

  const handleClose = () => {
    setStep('connect')
    setProperties([])
    setSelectedProperty(null)
    setError(null)
    onClose()
  }

  const iconWrapper = (
    <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center">
      <BarChart3 className="w-6 h-6 text-blue-500" />
    </div>
  )

  return (
    <ResponsiveDialog
      open={open}
      onClose={handleClose}
      title={
        step === 'success'
          ? 'Connected!'
          : step === 'select-property'
            ? 'Select Property'
            : 'Connect Google Analytics'
      }
      titleId="connect-analytics-title"
      icon={iconWrapper}
    >
      {step === 'connect' && (
        <>
          <ResponsiveDialogDescription>
            Connect your Google Analytics 4 property to view website metrics directly in your
            dashboard.
          </ResponsiveDialogDescription>

          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-muted/50 text-sm text-muted-foreground">
              <p className="mb-2">You&apos;ll be asked to:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Sign in with your Google account</li>
                <li>Grant read-only access to Analytics data</li>
                <li>Select a GA4 property to connect</li>
              </ul>
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                {error}
              </div>
            )}

            <ResponsiveDialogActions>
              <ResponsiveDialogButton onClick={handleClose} variant="secondary">
                Cancel
              </ResponsiveDialogButton>
              <ResponsiveDialogButton
                onClick={handleConnect}
                variant="primary"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Connect with Google
                  </>
                )}
              </ResponsiveDialogButton>
            </ResponsiveDialogActions>
          </div>
        </>
      )}

      {step === 'select-property' && (
        <>
          <ResponsiveDialogDescription>
            Select a Google Analytics 4 property to connect.
          </ResponsiveDialogDescription>

          <div className="space-y-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                <span className="ml-2 text-muted-foreground">Loading properties...</span>
              </div>
            ) : properties.length > 0 ? (
              <div className="max-h-64 overflow-y-auto space-y-2">
                {properties.map((property) => (
                  <button
                    key={property.propertyId}
                    onClick={() => setSelectedProperty(property)}
                    className={cn(
                      'w-full p-3 rounded-lg border text-left transition-all',
                      selectedProperty?.propertyId === property.propertyId
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    )}
                  >
                    <div className="font-medium">{property.displayName}</div>
                    <div className="text-sm text-muted-foreground">
                      {property.accountName} &middot; ID: {property.propertyId}
                    </div>
                    {property.timeZone && (
                      <div className="text-xs text-muted-foreground mt-1">
                        Timezone: {property.timeZone}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-muted-foreground">No properties found</div>
            )}

            {error && (
              <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                {error}
              </div>
            )}

            <ResponsiveDialogActions>
              <ResponsiveDialogButton onClick={handleClose} variant="secondary">
                Cancel
              </ResponsiveDialogButton>
              <ResponsiveDialogButton
                onClick={handleSelectProperty}
                variant="primary"
                disabled={!selectedProperty || isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  'Connect Property'
                )}
              </ResponsiveDialogButton>
            </ResponsiveDialogActions>
          </div>
        </>
      )}

      {step === 'success' && (
        <div className="py-8 text-center">
          <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4">
            <Check className="w-8 h-8 text-green-500" />
          </div>
          <p className="text-lg font-medium mb-2">Successfully Connected!</p>
          <p className="text-muted-foreground">Your Google Analytics property is now connected.</p>
        </div>
      )}
    </ResponsiveDialog>
  )
}
