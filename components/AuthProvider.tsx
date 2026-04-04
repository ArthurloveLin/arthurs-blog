'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
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

export default function AuthProvider({ children }: { children: ReactNode }) {
  const [email, setEmail] = useState<string | null>(null)
  const [displayName, setDisplayName] = useState<string | null>(null)
  const [role, setRole] = useState<UserRole>('guest')
  const [guestId, setGuestId] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setGuestId(getOrCreateGuestId())
  }, [])

  useEffect(() => {
    async function fetchMe() {
      try {
        const res = await fetch('/api/me')
        if (!res.ok) return
        const data = await res.json()
        setRole((data.role as UserRole) ?? 'guest')
        setEmail(data.email ?? null)
        setDisplayName(data.display_name ?? null)
      } catch {
        // 网络失败时保持 guest
      } finally {
        setLoading(false)
      }
    }

    fetchMe()
  }, [])

  return (
    <AuthContext.Provider value={{ email, displayName, role, guestId, isAdmin: role === 'admin', loading }}>
      {children}
    </AuthContext.Provider>
  )
}
