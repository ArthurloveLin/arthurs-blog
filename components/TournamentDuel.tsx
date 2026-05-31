'use client'

import { useState, useEffect, useCallback } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { TournamentAwardsScreen } from './TournamentAwardsScreen'
import type { AwardsItem, AwardsResults } from './TournamentAwardsScreen'

type Item = AwardsItem;

interface TournamentDuelProps {
  items: Item[]
  sessionToken: string
  onClose: () => void
  templateConfig?: import('@/lib/templates').TemplateConfig
}

export default function TournamentDuel({ items: initialItems, sessionToken, onClose, templateConfig }: TournamentDuelProps) {
  const router = useRouter()
  const [pool, setPool] = useState<Item[]>([])
  const [leftItem, setLeftItem] = useState<Item | null>(null)
  const [rightItem, setRightItem] = useState<Item | null>(null)
  const [animating, setAnimating] = useState<'left' | 'right' | null>(null)
  const [showContent, setShowContent] = useState(false)
  const [results, setResults] = useState<AwardsResults | null>(null)
  const [saving, setSaving] = useState(false)
  
  // Track history to find 3rd place
  // winner of last duel = 1st
  // loser of last duel = 2nd
  // loser of second-to-last duel = 3rd
  const [loserHistory, setLoserHistory] = useState<Item[]>([])

  // Initialize tournament
  useEffect(() => {
    const shuffled = [...initialItems].sort(() => Math.random() - 0.5)
    if (shuffled.length >= 2) {
      const first = shuffled.pop()!
      const second = shuffled.pop()!
      setLeftItem(first)
      setRightItem(second)
      setPool(shuffled)
    }
    setTimeout(() => setShowContent(true), 10)
  }, [initialItems])

  // Preload next image in pool
  useEffect(() => {
    if (pool.length > 0) {
      const nextImg = new window.Image()
      nextImg.src = pool[pool.length - 1].image_url
    }
  }, [pool])

  const saveResults = useCallback(async (champion: Item, runnerUp: Item, thirdPlace?: Item) => {
    setSaving(true)
    try {
      const response = await fetch(`/api/sessions/${sessionToken}/rankings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          championId: champion.id,
          runnerUpId: runnerUp.id,
          thirdPlaceId: thirdPlace?.id ?? null,
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(errorText || 'Failed to refresh tournament rankings')
      }

      router.refresh()
    } catch (error) {
      console.error('Failed to save tournament results:', error)
    } finally {
      setSaving(false)
    }
  }, [router, sessionToken])

  const handlePick = useCallback((winnerSide: 'left' | 'right') => {
    if (animating || !leftItem || !rightItem) return

    setAnimating(winnerSide)
    const winner = winnerSide === 'left' ? leftItem : rightItem
    const loser = winnerSide === 'left' ? rightItem : leftItem

    // Process next round after animation
    setTimeout(() => {
      // 使用 functional setState 避免闭包中的 loserHistory 过时
      // rule: rerender-functional-setstate
      const nextLoserHistory = [...loserHistory, loser]
      setLoserHistory(curr => [...curr, loser])

      if (pool.length > 0) {
        const nextPool = [...pool]
        const nextItem = nextPool.pop()!
        
        setLeftItem(winner)
        setRightItem(nextItem)
        setPool(nextPool)
        setAnimating(null)
      } else {
        const champion = winner
        const runnerUp = loser
        const thirdPlace = nextLoserHistory.length >= 2 ? nextLoserHistory[nextLoserHistory.length - 2] : undefined
        
        setResults({ champion, runnerUp, thirdPlace })
        saveResults(champion, runnerUp, thirdPlace)
        setAnimating(null)
      }
    }, 600)
  }, [animating, leftItem, loserHistory, pool, rightItem, saveResults])

  if (!leftItem || !rightItem) return null

  return (
    <div className={`fixed inset-0 z-[var(--z-modal)] overflow-hidden bg-black/98 backdrop-blur-md flex flex-col transition-opacity duration-700 ${showContent ? 'opacity-100' : 'opacity-0'}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 md:px-8 md:py-5 shrink-0">
        <button
          onClick={onClose}
          className="text-white/40 hover:text-white flex items-center gap-2 transition-all duration-200 hover:-translate-x-1 text-sm"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
          退出锦标赛
        </button>
        {!results && (
          <div className="px-3 py-1 rounded-comfortable bg-white/5 border border-white/10 text-white/50 text-[11px] font-medium tracking-wider">
            第 <span className="text-white font-semibold">{initialItems.length - pool.length - 1}</span> / {initialItems.length - 1} 轮
          </div>
        )}
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-4 md:px-8 min-h-0">
        {results ? (
          <TournamentAwardsScreen
            results={results}
            onClose={onClose}
            saving={saving}
            templateConfig={templateConfig}
          />
        ) : (
          <div className="w-full max-w-4xl flex flex-col gap-6 md:gap-10">
            {/* Title */}
            <div className="text-center space-y-1.5">
              <h2 className="text-xl md:text-3xl font-black text-white tracking-tight animate-in fade-in slide-in-from-bottom-4 duration-700">
                选出你的{' '}
                <span className="inline-block px-1 text-gradient-primary">
                  冠军穿搭
                </span>
              </h2>
              <p className="text-white/30 text-[11px] md:text-sm font-medium tracking-[0.15em]">每轮留下更想穿的那一件</p>
            </div>

            {/* Duel area */}
            <div className="relative flex items-start justify-center gap-3 md:gap-10">
              {/* Left Card */}
              <DuelCard
                item={leftItem}
                side="left"
                animating={animating}
                onSelect={() => handlePick('left')}
              />

              {/* VS Divider – sits between the two cards in flow */}
              <div className="shrink-0 flex flex-col items-center justify-center self-center gap-0 pointer-events-none" style={{ marginTop: '0' }}>
                <div
                  className={`w-10 h-10 md:w-14 md:h-14 rounded-full bg-white text-black font-black flex items-center justify-center shadow-[0_0_40px_rgba(255,255,255,0.25)] border-2 border-black/10 transition-transform duration-300 text-sm md:text-base ${animating ? 'scale-130 animate-vs-impact' : 'scale-100'}`}
                >
                  VS
                </div>
              </div>

              {/* Right Card */}
              <DuelCard
                item={rightItem}
                side="right"
                animating={animating}
                onSelect={() => handlePick('right')}
              />
            </div>
          </div>
        )}
      </div>

      {/* Footer / Progress bar */}
      <div className="px-6 py-5 md:px-10 md:py-6 shrink-0">
        {!results && (
          <div className="w-full max-w-md mx-auto space-y-2">
            <div className="flex justify-between text-[10px] tracking-widest font-semibold text-white/20">
              <span>开始</span>
              <span>决赛</span>
            </div>
            <div className="h-[3px] bg-white/8 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-primary transition-all duration-700 ease-out rounded-full"
                style={{ width: `${(1 - pool.length / (initialItems.length - 1)) * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function DuelCard({ item, side, animating, onSelect }: { item: Item, side: 'left' | 'right', animating: 'left' | 'right' | null, onSelect: () => void }) {
  const isWinner = animating === side
  const isLoser = animating !== null && animating !== side

  return (
    <div
      className={`relative group cursor-pointer flex-1 min-w-0 transition-all duration-700 ${
        isLoser ? 'opacity-0 scale-90 blur-xl' : 'opacity-100'
      } ${isWinner ? 'scale-[1.03]' : ''} ${side === 'left' ? 'animate-slide-in-left' : 'animate-slide-in-right'}`}
      onClick={onSelect}
    >
      {/* Aspect-ratio wrapper: controls dimensions via ratio, not fixed height */}
      <div className="relative w-full aspect-[2/3] md:aspect-[3/4.5]">
        <div className={`absolute inset-0 rounded-2xl md:rounded-[1.75rem] overflow-hidden border-2 transition-all duration-500 shadow-2xl ${
          isWinner
            ? 'border-primary shadow-[0_0_40px_color-mix(in_srgb,var(--primary)_30%,transparent)]'
            : 'border-white/8 group-hover:border-white/25'
        }`}>
          <Image
            src={item.image_url}
            alt="候选穿搭"
            fill
            className={`object-cover transition-transform duration-700 ${isWinner ? 'scale-105' : 'group-hover:scale-103'}`}
            sizes="(max-width: 768px) 45vw, 380px"
          />

          {/* Hover gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-400" />

          {/* Hover CTA */}
          <div className="absolute inset-0 flex flex-col items-center justify-end pb-5 md:pb-8 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <div className="px-4 py-1.5 md:px-5 md:py-2 rounded-comfortable bg-primary text-primary-foreground font-semibold text-[11px] md:text-xs tracking-wide shadow-lg">
              选这件
            </div>
          </div>

          {/* Winner flare */}
          {isWinner && (
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.35),transparent_55%)] mix-blend-screen animate-winner-pulse" />
          )}
        </div>
      </div>

      {/* Price tag */}
      {item.price !== null && (
        <div className="mt-3 text-center">
          <span className="px-3 py-1 rounded-full bg-white/8 border border-white/12 text-white/80 font-mono text-xs md:text-sm font-medium">
            ¥{item.price}
          </span>
        </div>
      )}
    </div>
  )
}
