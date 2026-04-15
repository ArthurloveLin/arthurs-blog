import { notFound } from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabase-admin'
import ItemDetail from '@/components/ItemDetail'
import ActivityBanner from '@/components/ActivityBanner'
import RealtimeSync from '@/components/RealtimeSync'
import { attachViewerEmojiReactions } from '@/lib/comment-emojis'


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
      comments(id, author, content, created_at, updated_at, parent_id, upvotes, downvotes)
    `)
    .eq('id', id)
    .single()

  if (error || !item) notFound()

  const comments = await attachViewerEmojiReactions(
    (((item.comments as unknown[]) ?? []) as Array<{
      id: string
      author: string
      content: string
      created_at: string
      updated_at: string | null
      parent_id: string | null
      upvotes: number | null
      downvotes: number | null
    }>).map((comment) => ({
      ...comment,
      upvotes: comment.upvotes ?? 0,
      downvotes: comment.downvotes ?? 0,
      viewer_reaction: 0 as const,
    })),
  )

  const sessionData = item.sessions as { template_config?: unknown } | null
  const templateConfig = sessionData?.template_config as import('@/lib/templates').TemplateConfig | undefined
  const itemWithInteractions = { ...item, comments }
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
        item={itemWithInteractions as Parameters<typeof ItemDetail>[0]['item']}
        token={token}
        templateConfig={templateConfig}
      />
    </main>
  )
}
