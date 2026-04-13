import { notFound } from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabase'
import ItemDetail from '@/components/ItemDetail'
import ActivityBanner from '@/components/ActivityBanner'
import RealtimeSync from '@/components/RealtimeSync'


export default async function ItemPage({
  params,
}: {
  params: Promise<{ token: string; id: string }>
}) {
  const { token, id } = await params

  // async-defer-await: getUserRole/getCurrentUser results were unused; removed
  // ItemDetail reads auth via useAuth() client-side context instead
  const { data: item, error } = await supabaseAdmin
    .from('items')
    .select(`
      *,
      sessions(template_config),
      ratings(score, author, scores, appearance_score, practicality_score, value_score),
      comments(id, author, content, created_at, updated_at, parent_id)
    `)
    .eq('id', id)
    .single()

  if (error || !item) notFound()

  const sessionData = item.sessions as { template_config?: unknown } | null
  const templateConfig = sessionData?.template_config as import('@/lib/templates').TemplateConfig | undefined

  return (
    <main className="min-h-screen bg-background">
      <RealtimeSync sessionId={item.session_id} />
      <ActivityBanner sessionId={item.session_id} />
      <ItemDetail
        item={item as Parameters<typeof ItemDetail>[0]['item']}
        token={token}
        templateConfig={templateConfig}
      />
    </main>
  )
}
