'use client'

import { createContext, use, useEffect, useRef, useState, ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import useSWR from 'swr'
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

const fetcher = (url: string): Promise<AuthState | null> =>
  fetch(url, { cache: 'no-store' }).then((response) => (response.ok ? response.json() : null))

interface AuthProviderProps {
  children: ReactNode
  initialData?: AuthState
}

export default function AuthProvider({ children, initialData }: AuthProviderProps) {
  const pathname = usePathname()
  const [guestId] = useState(() =>
    typeof window === 'undefined' ? '' : getOrCreateGuestId()
  )
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_supabase] = useState(() => 
    typeof window === 'undefined' ? null : createClient()
  )
  const previousPathnameRef = useRef(pathname)

  const { data, isLoading, mutate } = useSWR<AuthState | null>('/api/me', fetcher, {
    fallbackData: initialData,
    revalidateOnFocus: false,
    dedupingInterval: 0,
  })

  useEffect(() => {
    if (previousPathnameRef.current === pathname) {
      return
    }

    previousPathnameRef.current = pathname
    void mutate()
  }, [pathname, mutate])

  const refreshAuth = async () => {
    await mutate()
  }

  const syncAuth = (nextState: AuthState) => {
    void mutate(nextState, { revalidate: false })
  }

  const role = (data?.role as UserRole) ?? 'guest'
  const displayName = data?.display_name ?? null
  const email = data?.email ?? null
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
    loading: isLoading && !data,
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
