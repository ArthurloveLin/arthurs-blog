import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabase'
import { getUserRole } from '@/lib/auth'
import ImageGrid from '@/components/ImageGrid'
import UploadZone from '@/components/UploadZone'
import SortControl from '@/components/SortControl'
import FinalListToggle from '@/components/FinalListToggle'
import SessionHeader from '@/components/SessionHeader'
import RealtimeSync from '@/components/RealtimeSync'
import ActivityBanner from '@/components/ActivityBanner'
import TournamentEntry from '@/components/TournamentEntry'

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
  rank: number | null
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

  // getUserRole 与 session 查询互相独立，并行发起
  const [role, { data: session, error: sessionError }] = await Promise.all([
    getUserRole(),
    supabaseAdmin.from('sessions').select('*').eq('token', token).single(),
  ])
  const isAdmin = role === 'admin'

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
  const pendingCount = items.filter((i) => i.decision === 'pending').length
  const totalBuyPrice = items
    .filter((i) => i.decision === 'buy' && i.price !== null)
    .reduce((sum, i) => sum + (i.price ?? 0), 0)

  return (
    <main className="min-h-screen bg-background">
      <RealtimeSync sessionId={session.id} />
      <ActivityBanner sessionId={session.id} />
      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Header */}
        <SessionHeader session={session} isAdmin={isAdmin} />

        {/* Stats bar */}
        {items.length > 0 && (
          <div className="flex items-center gap-3 bg-card border border-border rounded-2xl px-4 py-3 shadow-sm mb-4 text-sm">
            <div className="flex-1 flex items-center gap-4 flex-wrap">
              <span className="text-muted-foreground">共 <span className="font-semibold text-foreground">{items.length}</span> 件</span>
              <span className="text-green-600 dark:text-green-400">已选 <span className="font-semibold">{buyCount}</span> 件</span>
              <span className="text-muted-foreground">待定 <span className="font-medium">{pendingCount}</span> 件</span>
              {totalBuyPrice > 0 && (
                <span className="text-primary font-semibold">已选 ¥{totalBuyPrice}</span>
              )}
            </div>
            {session.budget && (
              <span className={`text-xs shrink-0 font-medium ${
                totalBuyPrice > session.budget ? 'text-destructive' : 'text-muted-foreground'
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
            <Suspense fallback={<div className="h-10 animate-pulse bg-muted rounded-xl" />}>
              <FinalListToggle current={view} />
            </Suspense>
          </div>
        )}

        {/* Upload Zone — admin only, only in all view */}
        {isAdmin && !isFinalView && (
          <div className="mb-6">
            <UploadZone sessionToken={token} />
          </div>
        )}

        {/* Sort Control */}
        {sortedItems.length > 1 && (
          <div className="mb-4">
            <Suspense fallback={<div className="h-10 animate-pulse bg-muted rounded-xl" />}>
              <SortControl current={sort} />
            </Suspense>
          </div>
        )}

        {/* Final list heading */}
        {isFinalView && (
          <div className="mb-4 flex items-center gap-2">
            <div>
              <h2 className="text-base font-semibold text-foreground">最终清单</h2>
              <span className="text-xs text-muted-foreground">共 {sortedItems.length} 件</span>
            </div>
            {totalBuyPrice > 0 && (
              <span className="ml-auto text-sm font-bold text-primary mr-2">合计 ¥{totalBuyPrice}</span>
            )}
            <TournamentEntry items={sortedItems} />
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
