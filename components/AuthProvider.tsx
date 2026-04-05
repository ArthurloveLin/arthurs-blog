'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import useSWR from 'swr'
import { getOrCreateGuestId } from '@/lib/guest'

type UserRole = 'guest' | 'user' | 'admin'

interface AuthContextValue {
  email: string | null
  displayName: string | null
  role: UserRole
  guestId: string
  isAdmin: boolean
  loading: boolean
}

const AuthContext = createContext<AuthContextValue>({
  email: null,
  displayName: null,
  role: 'guest',
  guestId: '',
  isAdmin: false,
  loading: true,
})

export function useAuth() {
  return useContext(AuthContext)
}

const fetcher = (url: string) => fetch(url).then((r) => r.ok ? r.json() : null)

export default function AuthProvider({ children }: { children: ReactNode }) {
  const [guestId, setGuestId] = useState('')
  useEffect(() => { setGuestId(getOrCreateGuestId()) }, [])

  const { data, isLoading } = useSWR('/api/me', fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60_000,
  })

  const role = (data?.role as UserRole) ?? 'guest'

  return (
    <AuthContext.Provider value={{
      email: data?.email ?? null,
      displayName: data?.display_name ?? null,
      role,
      guestId,
      isAdmin: role === 'admin',
      loading: isLoading,
    }}>
      {children}
    </AuthContext.Provider>
  )
}
