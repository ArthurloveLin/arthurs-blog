'use client'

import { createContext, use, useState, ReactNode } from 'react'
import useSWR from 'swr'
import { getOrCreateGuestId } from '@/lib/guest'

export type UserRole = 'guest' | 'user' | 'admin'

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
  identity: string
  loading: boolean
  isAuthenticated: boolean
  isAdmin: boolean
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
  const user = role === 'guest' ? null : { email, displayName }
  const identity = displayName ?? email ?? guestId
  const value: AuthContextValue = {
    role,
    user,
    email,
    displayName,
    guestId,
    identity,
    loading: isLoading && !data,
    isAuthenticated: role !== 'guest',
    isAdmin: role === 'admin',
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}
