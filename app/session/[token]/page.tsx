import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getUserRole } from '@/lib/auth'
import ImageGrid from '@/components/ImageGrid'
import DraggableImageGrid from '@/components/DraggableImageGridWrapper'
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

  const templateConfig = (session as { template_config?: import('@/lib/templates').TemplateConfig }).template_config

  const { data: rawItems } = await supabaseAdmin
    .from('items')
    .select(`*, ratings(score, author, scores), comments(id)`)
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
  const tournamentItems = items.filter((i) => i.decision === 'buy')
  const totalBuyPrice = items
    .filter((i) => i.decision === 'buy' && i.price !== null)
    .reduce((sum, i) => sum + (i.price ?? 0), 0)

  const itemLabel = templateConfig?.itemLabel || '位'

  return (
    <main className="min-h-screen bg-background text-foreground">
      <RealtimeSync sessionId={session.id} />
      <ActivityBanner sessionId={session.id} />
      <div className="max-w-2xl mx-auto px-4 py-10">
        {/* Header */}
        <SessionHeader session={session} templateConfig={templateConfig} />

        {/* Stats bar */}
        {items.length > 0 && (
          <div className="flex items-center gap-3 bg-card border border-border rounded-2xl px-5 py-4 shadow-sm mb-6 text-sm">
            <div className="flex-1 flex items-center gap-4 flex-wrap">
              <span className="text-muted-foreground">共 <span className="font-semibold text-foreground">{items.length}</span> {itemLabel}</span>
              <span className="text-green-600 dark:text-green-400 font-medium">已选 <span className="font-bold">{buyCount}</span> {itemLabel}</span>
              <span className="text-muted-foreground font-medium">待处理 <span className="font-semibold">{pendingCount}</span> {itemLabel}</span>
              {totalBuyPrice > 0 && (
                <span className="text-primary font-bold">合计 ¥{totalBuyPrice}</span>
              )}
            </div>
            {session.budget && (
              <span className={`text-xs shrink-0 font-bold px-2 py-1 rounded-lg bg-muted/50 ${
                totalBuyPrice > session.budget ? 'text-destructive bg-destructive/10' : 'text-muted-foreground'
              }`}>
                预算 ¥{session.budget}
                {totalBuyPrice > session.budget && ' ⚠️ 超额'}
              </span>
            )}
          </div>
        )}

        {/* View Toggle */}
        {items.length > 0 && (
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Suspense fallback={<div className="h-12 animate-pulse bg-muted rounded-2xl" />}>
              <FinalListToggle current={view} />
            </Suspense>
            {isAdmin && (
              <TournamentEntry items={tournamentItems} sessionToken={token} templateConfig={templateConfig} />
            )}
          </div>
        )}

        {/* Upload Zone — admin only, only in all view */}
        {isAdmin && !isFinalView && (
          <div className="mb-8 p-1 bg-card/50 border border-dashed border-border rounded-2xl">
            <UploadZone sessionToken={token} templateConfig={templateConfig} />
          </div>
        )}

        {/* Sort Control */}
        {sortedItems.length > 1 && (
          <div className="mb-6">
            <Suspense fallback={<div className="h-10 animate-pulse bg-muted rounded-xl" />}>
              <SortControl current={sort} />
            </Suspense>
          </div>
        )}

        {/* Final list heading */}
        {isFinalView && (
          <div className="mb-6 flex flex-col gap-4 rounded-2xl border border-primary/10 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-bold text-foreground leading-tight">✨ 最终清单</h2>
              <span className="mt-1 block text-xs leading-5 text-muted-foreground font-medium">挑选出的 {sortedItems.length} {itemLabel} {templateConfig?.name === '衣评' ? '穿搭' : '优选'}</span>
            </div>
            {totalBuyPrice > 0 && (
              <div className="rounded-xl bg-background/70 px-3 py-2 text-left shadow-sm sm:text-right">
                <span className="block text-[10px] text-muted-foreground uppercase font-bold">预估支出</span>
                <span className="text-xl font-black text-primary">¥{totalBuyPrice}</span>
              </div>
            )}
          </div>
        )}

        {/* Image Grid */}
        {sort === 'position' ? (
          <DraggableImageGrid items={sortedItems} sessionToken={token} />
        ) : (
          <ImageGrid
            items={sortedItems}
            sessionToken={token}
            templateConfig={templateConfig}
          />
        )}
      </div>
    </main>
  )
}
