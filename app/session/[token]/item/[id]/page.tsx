import { notFound } from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabase-admin'
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
      id,
      session_id,
      image_url,
      decision,
      price,
      notes,
      category,
      rank,
      ocr_status,
      ocr_provider,
      ocr_data,
      sessions(template_config),
      ratings(score, author, scores, appearance_score, practicality_score, value_score)
    `)
    .eq('id', id)
    .single()

  if (error || !item) notFound()

  const sessionData = item.sessions as { template_config?: unknown } | null
  const templateConfig = sessionData?.template_config as import('@/lib/templates').TemplateConfig | undefined
  const itemRefreshKey = [
    item.id,
    item.decision ?? '',
    item.price ?? '',
    item.notes ?? '',
    item.category ?? '',
    item.ocr_status ?? '',
    item.ocr_processed_at ?? '',
  ].join(':')

  return (
    <main className="min-h-screen bg-background">
      <RealtimeSync sessionId={item.session_id} />
      <ActivityBanner sessionId={item.session_id} />
      <ItemDetail
        key={itemRefreshKey}
        item={item as Parameters<typeof ItemDetail>[0]['item']}
        token={token}
        templateConfig={templateConfig}
      />
    </main>
  )
}
