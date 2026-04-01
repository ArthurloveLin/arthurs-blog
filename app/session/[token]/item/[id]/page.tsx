import Link from 'next/link'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabase'

export default async function ItemPage({
  params,
}: {
  params: Promise<{ token: string; id: string }>
}) {
  const { token, id } = await params

  const { data: item, error } = await supabaseAdmin
    .from('items')
    .select(`*, ratings(score, author), comments(id, author, content, created_at)`)
    .eq('id', id)
    .single()

  if (error || !item) notFound()

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-lg mx-auto px-4 py-6">
        <div className="flex items-center gap-3 mb-4">
          <Link href={`/session/${token}`} className="text-gray-400 hover:text-gray-600">
            ← 返回
          </Link>
          <h1 className="text-lg font-semibold text-gray-800">图片详情</h1>
        </div>

        <div className="relative w-full aspect-square rounded-2xl overflow-hidden bg-gray-100 shadow-sm mb-4">
          <Image
            src={item.image_url}
            alt="衣服图片"
            fill
            className="object-contain"
            sizes="(max-width: 640px) 100vw, 512px"
          />
        </div>

        <p className="text-sm text-center text-gray-400">
          评分与评论功能将在 Phase 2 完成
        </p>
      </div>
    </main>
  )
}
