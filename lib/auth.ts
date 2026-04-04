import { createClient } from '@/lib/supabase-server'

export type UserRole = 'guest' | 'user' | 'admin'

export async function getCurrentUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function getUserRole(): Promise<UserRole> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return 'guest'

  const { data } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .single()

  if (data?.role === 'admin') return 'admin'
  return 'user'
}

export async function isAdminRequest(): Promise<boolean> {
  const role = await getUserRole()
  return role === 'admin'
}
