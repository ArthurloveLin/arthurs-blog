'use client'

import { createContext, use, useState, ReactNode } from 'react'
import useSWR from 'swr'
import { getOrCreateGuestId } from '@/lib/guest'

export type UserRole = 'guest' | 'user' | 'admin'

interface AuthState {
  email: string | null
  displayName: string | null
  role: UserRole
  identity: string
  loading: boolean
  isAuthenticated: boolean
}

interface AuthPermissions {
  isAdmin: boolean
}

interface AuthMeta {
  guestId: string
}

interface AuthContextValue {
  state: AuthState
  permissions: AuthPermissions
  meta: AuthMeta
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth() {
  const context = use(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

const fetcher = (url: string) => fetch(url).then((r) => r.ok ? r.json() : null)

interface AuthProviderProps {
  children: ReactNode
  initialData?: {
    role: UserRole
    email: string | null
    display_name: string | null
  }
}

export default function AuthProvider({ children, initialData }: AuthProviderProps) {
  const [guestId] = useState(() =>
    typeof window === 'undefined' ? '' : getOrCreateGuestId()
  )

  const { data, isLoading } = useSWR('/api/me', fetcher, {
    fallbackData: initialData,
    revalidateOnFocus: false,
    dedupingInterval: 60_000,
  })

  const role = (data?.role as UserRole) ?? 'guest'
  const displayName = data?.display_name ?? null
  const email = data?.email ?? null
  const identity = displayName ?? email ?? guestId
  const value: AuthContextValue = {
    state: {
      email,
      displayName,
      role,
      identity,
      loading: isLoading && !data,
      isAuthenticated: role !== 'guest',
    },
    permissions: {
      isAdmin: role === 'admin',
    },
    meta: {
      guestId,
    },
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}
