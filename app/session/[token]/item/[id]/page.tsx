import { notFound } from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabase'
import ItemDetail from '@/components/ItemDetail'

export default async function ItemPage({
  params,
}: {
  params: Promise<{ token: string; id: string }>
}) {
  const { token, id } = await params

  const { data: item, error } = await supabaseAdmin
    .from('items')
    .select(`id, image_url, decision, price, notes, ratings(score, author, appearance_score, practicality_score, value_score), comments(id, author, content, created_at, parent_id)`)
    .eq('id', id)
    .single()

  if (error || !item) notFound()

  return <ItemDetail item={item} token={token} />
}
