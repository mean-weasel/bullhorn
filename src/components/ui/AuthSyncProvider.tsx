'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'

export function AuthSyncProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        toast('You have been signed out', { icon: '\uD83D\uDC4B' })
        router.push('/login')
      }
    })
    return () => subscription.unsubscribe()
  }, [router])

  return <>{children}</>
}
