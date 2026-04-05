import { notFound } from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabase'
import ItemDetail from '@/components/ItemDetail'
import ActivityBanner from '@/components/ActivityBanner'
import RealtimeSync from '@/components/RealtimeSync'
import { getUserRole, getCurrentUser } from '@/lib/auth'

export default async function ItemPage({
  params,
}: {
  params: Promise<{ token: string; id: string }>
}) {
  const { token, id } = await params

  const [role, user, { data: item, error }] = await Promise.all([
    getUserRole(),
    getCurrentUser(),
    supabaseAdmin
      .from('items')
      .select(`id, session_id, image_url, decision, price, notes, category, rank, ratings(score, author, appearance_score, practicality_score, value_score), comments(id, author, content, created_at, parent_id)`)
      .eq('id', id)
      .single()
  ])

  if (error || !item) notFound()

  const identity = user?.user_metadata?.display_name || user?.email || null

  return (
    <main className="min-h-screen bg-background">
      <RealtimeSync sessionId={item.session_id} />
      <ActivityBanner sessionId={item.session_id} />
      <ItemDetail 
        item={item} 
        token={token} 
        isAdmin={role === 'admin'} 
        userRole={role}
        serverIdentity={identity}
      />
    </main>
  )
}
