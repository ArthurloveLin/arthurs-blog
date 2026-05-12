import { cache } from 'react'
import { createClient } from '@/lib/supabase-server'

export type UserRole = 'guest' | 'user' | 'admin'

export const getCurrentUser = cache(async () => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
})

export const getUserRole = cache(async (): Promise<UserRole> => {
  const user = await getCurrentUser()

  if (!user) return 'guest'

  const supabase = await createClient()
  const { data } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .single()

  if (data?.role === 'admin') return 'admin'
  return 'user'
})

export const isAdminRequest = cache(async (): Promise<boolean> => {
  const role = await getUserRole()
  return role === 'admin'
})
