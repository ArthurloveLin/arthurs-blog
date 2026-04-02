import Link from 'next/link'
import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabase'
import ImageGrid from '@/components/ImageGrid'
import UploadZone from '@/components/UploadZone'
import SortControl from '@/components/SortControl'
import FinalListToggle from '@/components/FinalListToggle'
import RealtimeSync from '@/components/RealtimeSync'

interface Item {
  id: string
  image_url: string
  decision: 'buy' | 'skip' | 'pending'
  price: number | null
  position: number
  category: string | null
  created_at: string
  avgScore: number | null
  arthurScore: number | null
  graceScore: number | null
  commentCount: number
  ratings: { score: number; author: string }[]
  comments: { id: string }[]
}

export default async function SessionPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>
  searchParams: Promise<{ sort?: string; view?: string }>
}) {
  const { token } = await params
  const { sort = 'time', view = 'all' } = await searchParams

  const { data: session, error: sessionError } = await supabaseAdmin
    .from('sessions')
    .select('*')
    .eq('token', token)
    .single()

  if (sessionError || !session) notFound()

  const { data: rawItems } = await supabaseAdmin
    .from('items')
    .select(`*, ratings(score, author), comments(id)`)
    .eq('session_id', session.id)
    .order('created_at', { ascending: true })

  const items: Item[] = (rawItems ?? []).map((item) => {
    const ratings = (item.ratings as { score: number; author: string }[]) ?? []
    const scores = ratings.map((r) => r.score)
    const avgScore = scores.length > 0
      ? scores.reduce((a, b) => a + b, 0) / scores.length
      : null
    const arthurScore = ratings.find((r) => r.author === 'Arthur')?.score ?? null
    const graceScore = ratings.find((r) => r.author === 'Grace')?.score ?? null
    return {
      ...item,
      avgScore,
      arthurScore,
      graceScore,
      commentCount: (item.comments as unknown[])?.length ?? 0,
    }
  })

  const isFinalView = view === 'final'
  const displayItems = isFinalView ? items.filter((i) => i.decision === 'buy') : items

  const sortedItems = [...displayItems].sort((a, b) => {
    switch (sort) {
      case 'rating':
        if (a.avgScore === null && b.avgScore === null) return 0
        if (a.avgScore === null) return 1
        if (b.avgScore === null) return -1
        return b.avgScore - a.avgScore
      case 'arthur':
        if (a.arthurScore === null && b.arthurScore === null) return 0
        if (a.arthurScore === null) return 1
        if (b.arthurScore === null) return -1
        return b.arthurScore - a.arthurScore
      case 'grace':
        if (a.graceScore === null && b.graceScore === null) return 0
        if (a.graceScore === null) return 1
        if (b.graceScore === null) return -1
        return b.graceScore - a.graceScore
      case 'price':
        if (a.price === null && b.price === null) return 0
        if (a.price === null) return 1
        if (b.price === null) return -1
        return a.price - b.price
      case 'position':
        return a.position - b.position
      default:
        return 0 // already ordered by created_at from DB
    }
  })

  const buyCount = items.filter((i) => i.decision === 'buy').length
  const totalBuyPrice = items
    .filter((i) => i.decision === 'buy' && i.price !== null)
    .reduce((sum, i) => sum + (i.price ?? 0), 0)

  return (
    <main className="min-h-screen bg-gray-50">
      <RealtimeSync sessionId={session.id} />
      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-start gap-3 mb-6">
          <Link href="/wardrobe" className="text-gray-400 hover:text-gray-600 mt-1">
            ←
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-gray-800 truncate">
              {session.title || '选衣会话'}
            </h1>
            {session.note && (
              <p className="text-sm text-gray-500 mt-0.5">{session.note}</p>
            )}
          </div>
        </div>

        {/* Stats bar */}
        {items.length > 0 && (
          <div className="flex items-center gap-3 bg-white rounded-2xl px-4 py-3 shadow-sm mb-4 text-sm">
            <div className="flex-1 flex items-center gap-4 flex-wrap">
              <span className="text-gray-500">共 <span className="font-semibold text-gray-800">{items.length}</span> 件</span>
              <span className="text-green-600">已选 <span className="font-semibold">{buyCount}</span> 件</span>
              <span className="text-gray-400">待定 <span className="font-medium">{items.filter((i) => i.decision === 'pending').length}</span> 件</span>
              {totalBuyPrice > 0 && (
                <span className="text-pink-500 font-semibold">已选 ¥{totalBuyPrice}</span>
              )}
            </div>
            {session.budget && (
              <span className={`text-xs shrink-0 font-medium ${
                totalBuyPrice > session.budget ? 'text-red-500' : 'text-gray-400'
              }`}>
                预算 ¥{session.budget}
                {totalBuyPrice > session.budget && ' ⚠️超'}
              </span>
            )}
          </div>
        )}

        {/* View Toggle */}
        {items.length > 0 && (
          <div className="mb-4">
            <Suspense>
              <FinalListToggle current={view} />
            </Suspense>
          </div>
        )}

        {/* Upload Zone — only in all view */}
        {!isFinalView && (
          <div className="mb-6">
            <UploadZone sessionToken={token} />
          </div>
        )}

        {/* Sort Control */}
        {sortedItems.length > 1 && (
          <div className="mb-4">
            <Suspense>
              <SortControl current={sort} />
            </Suspense>
          </div>
        )}

        {/* Final list heading */}
        {isFinalView && (
          <div className="mb-4 flex items-center gap-2">
            <h2 className="text-base font-semibold text-gray-700">最终清单</h2>
            <span className="text-xs text-gray-400">共 {sortedItems.length} 件</span>
            {totalBuyPrice > 0 && (
              <span className="ml-auto text-sm font-bold text-pink-500">合计 ¥{totalBuyPrice}</span>
            )}
          </div>
        )}

        {/* Image Grid */}
        <ImageGrid
          items={sortedItems}
          sessionToken={token}
          draggable={sort === 'position'}
        />
      </div>
    </main>
  )
}
