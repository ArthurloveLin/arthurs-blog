'use client'

import { useAuth } from './AuthProvider'
import { ReactNode } from 'react'

export default function AdminOnly({ children }: { children: ReactNode }) {
  const { isAdmin } = useAuth()
  if (!isAdmin) return null
  return <>{children}</>
}
