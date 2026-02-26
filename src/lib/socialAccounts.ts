import { create } from 'zustand'
import { dedup } from './requestDedup'
import type { SocialAccount, SocialProvider } from './utils'

// Re-export types for consumer convenience
export type { SocialAccount, SocialProvider } from './utils'

// API URL - use relative path for Next.js API routes
const API_BASE = '/api/social-accounts'

interface SocialAccountsState {
  accounts: SocialAccount[]
  loading: boolean
  error: string | null
  initialized: boolean
}

interface SocialAccountsActions {
  fetchAccounts: () => Promise<void>
  deleteAccount: (id: string) => Promise<void>
  getAccountsByProvider: (provider: SocialProvider) => SocialAccount[]
  getActiveAccount: (provider: SocialProvider) => SocialAccount | undefined
  reset: () => void
}

const initialState: SocialAccountsState = {
  accounts: [],
  loading: false,
  error: null,
  initialized: false,
}

export const useSocialAccountsStore = create<SocialAccountsState & SocialAccountsActions>()(
  (set, get) => ({
    ...initialState,

    fetchAccounts: async () => {
      return dedup('social-accounts', async () => {
        set({ loading: true, error: null })
        try {
          const res = await fetch(API_BASE)
          if (!res.ok) throw new Error('Failed to fetch social accounts')
          const data = await res.json()
          const accounts = (data.accounts || []) as SocialAccount[]
          set({
            accounts,
            loading: false,
            initialized: true,
          })
        } catch (error) {
          set({ error: (error as Error).message, loading: false })
        }
      })
    },

    deleteAccount: async (id) => {
      // Optimistic removal
      const previousAccounts = get().accounts
      set((state) => ({
        accounts: state.accounts.filter((a) => a.id !== id),
        loading: true,
        error: null,
      }))
      try {
        const res = await fetch(`${API_BASE}/${id}`, {
          method: 'DELETE',
        })
        if (!res.ok) {
          const errorData = await res.json()
          throw new Error(errorData.error || 'Failed to delete social account')
        }
        set({ loading: false })
      } catch (error) {
        // Rollback on failure
        set({
          accounts: previousAccounts,
          error: (error as Error).message,
          loading: false,
        })
        throw error
      }
    },

    getAccountsByProvider: (provider) => get().accounts.filter((a) => a.provider === provider),

    getActiveAccount: (provider) =>
      get().accounts.find((a) => a.provider === provider && a.status === 'active'),

    reset: () => {
      set(initialState)
    },
  })
)

// Selector hooks for common queries
export const useSocialAccounts = () => useSocialAccountsStore((state) => state.accounts)
export const useSocialAccountsLoading = () => useSocialAccountsStore((state) => state.loading)
export const useSocialAccountsError = () => useSocialAccountsStore((state) => state.error)
export const useSocialAccountsInitialized = () =>
  useSocialAccountsStore((state) => state.initialized)
