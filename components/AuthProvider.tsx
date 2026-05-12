'use client'

import { createContext, use, useEffect, useState, ReactNode } from 'react'
import { getGuestDisplayName, getGuestIdentityAliases, getOrCreateGuestId } from '@/lib/guest'
import { createClient } from '@/lib/supabase-client'

export type UserRole = 'guest' | 'user' | 'admin'

export interface AuthState {
  role: UserRole
  email: string | null
  display_name: string | null
}

export const GUEST_AUTH_STATE: AuthState = {
  role: 'guest',
  email: null,
  display_name: null,
}

interface AuthUser {
  email: string | null
  displayName: string | null
}

interface AuthContextValue {
  role: UserRole
  user: AuthUser | null
  email: string | null
  displayName: string | null
  guestId: string
  guestDisplayName: string
  identityAliases: string[]
  identity: string
  publicIdentity: string
  loading: boolean
  isAuthenticated: boolean
  isAdmin: boolean
  refreshAuth: () => Promise<void>
  syncAuth: (nextState: AuthState) => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth() {
  const context = use(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export function useAuthIdentity() {
  return useAuth().identity
}

interface AuthProviderProps {
  children: ReactNode
  initialData?: AuthState
}

export default function AuthProvider({ children, initialData }: AuthProviderProps) {
  const [authState, setAuthState] = useState<AuthState>(initialData ?? GUEST_AUTH_STATE)
  const [loading, setLoading] = useState(!initialData)

  const [guestId] = useState(() =>
    typeof window === 'undefined' ? '' : getOrCreateGuestId()
  )

  useEffect(() => {
    const supabase = createClient()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'INITIAL_SESSION') {
        if (!initialData) {
          if (session?.user) {
            const data = await fetch('/api/me').then(r => r.json())
            setAuthState(data)
          }
          setLoading(false)
        }
        return
      }

      if (event === 'SIGNED_OUT') {
        setAuthState(GUEST_AUTH_STATE)
        return
      }

      // SIGNED_IN | TOKEN_REFRESHED | USER_UPDATED
      if (session?.user) {
        const data = await fetch('/api/me').then(r => r.json())
        setAuthState(data)
      }
    })

    return () => subscription.unsubscribe()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const refreshAuth = async () => {
    const data = await fetch('/api/me').then(r => r.json())
    setAuthState(data)
  }

  const syncAuth = (nextState: AuthState) => {
    setAuthState(nextState)
  }

  const role = authState.role
  const displayName = authState.display_name ?? null
  const email = authState.email ?? null
  const guestDisplayName = guestId ? getGuestDisplayName(guestId) : ''
  const identityAliases = role === 'guest' ? getGuestIdentityAliases(guestId) : [displayName ?? email ?? ''].filter(Boolean)
  const user = role === 'guest' ? null : { email, displayName }
  const identity = displayName ?? email ?? guestId
  const publicIdentity = displayName ?? email ?? guestDisplayName
  const value: AuthContextValue = {
    role,
    user,
    email,
    displayName,
    guestId,
    guestDisplayName,
    identityAliases,
    identity,
    publicIdentity,
    loading,
    isAuthenticated: role !== 'guest',
    isAdmin: role === 'admin',
    refreshAuth,
    syncAuth,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}
