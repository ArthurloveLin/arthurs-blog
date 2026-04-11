'use client'

import { useState, useEffect, useCallback } from 'react'
import Image from 'next/image'
import { TournamentAwardsScreen } from './TournamentAwardsScreen'
import type { AwardsItem, AwardsResults } from './TournamentAwardsScreen'

type Item = AwardsItem;

interface TournamentDuelProps {
  items: Item[]
  onClose: () => void
  templateConfig?: import('@/lib/templates').TemplateConfig
}

export default function TournamentDuel({ items: initialItems, onClose, templateConfig }: TournamentDuelProps) {
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

  const saveResults = async (champion: Item, runnerUp: Item, thirdPlace?: Item) => {
    setSaving(true)
    try {
      // 1. Clear previous ranks in this session (optional but cleaner)
      // For simplicity, we just update the new top 3.
      // 2. Update Top 3
      const updates = [
        fetch(`/api/items/${champion.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rank: 1 }),
        }),
        fetch(`/api/items/${runnerUp.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rank: 2 }),
        }),
      ]
      
      if (thirdPlace) {
        updates.push(
          fetch(`/api/items/${thirdPlace.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rank: 3 }),
          })
        )
      }

      await Promise.all(updates)
    } catch (error) {
      console.error('Failed to save tournament results:', error)
    } finally {
      setSaving(false)
    }
  }

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
  }, [leftItem, rightItem, pool, animating, loserHistory])

  if (!leftItem || !rightItem) return null

  return (
    <div className={`fixed inset-0 z-[200] bg-black/98 backdrop-blur-md flex flex-col transition-opacity duration-700 ${showContent ? 'opacity-100' : 'opacity-0'}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-6">
        <button 
          onClick={onClose}
          className="text-white/40 hover:text-white flex items-center gap-2 transition-all hover:translate-x-[-4px]"
        >
          <span className="text-xl">✕</span> 退出对决
        </button>
        {!results && (
          <div className="px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-white/60 text-xs font-bold tracking-widest uppercase">
            Progress <span className="text-white ml-2">{initialItems.length - pool.length - 1} / {initialItems.length - 1}</span>
          </div>
        )}
      </div>

      <div className="flex-1 flex flex-col items-center justify-center -mt-8 px-6 overflow-hidden">
        {results ? (
          <TournamentAwardsScreen
            results={results}
            onClose={onClose}
            saving={saving}
            templateConfig={templateConfig}
          />
        ) : (
          <div className="w-full max-w-5xl">
            <div className="text-center mb-8 md:mb-16 space-y-2">
              <h2 className="text-2xl md:text-4xl font-black text-white tracking-tighter italic uppercase animate-in fade-in slide-in-from-bottom-4 duration-700">
                Pick Your <span className="text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-violet-500">Favorite</span>
              </h2>
              <p className="text-white/30 text-[10px] md:text-sm font-medium tracking-widest uppercase px-4">Select the one that sparks more joy</p>
            </div>

            <div className="grid grid-cols-2 gap-3 md:gap-20 relative h-[400px] md:h-[550px] items-center">
              {/* VS Divider */}
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-30 pointer-events-none">
                <div className={`w-12 h-12 md:w-16 md:h-16 rounded-full bg-white text-black font-black flex items-center justify-center shadow-[0_0_50px_rgba(255,255,255,0.3)] border-4 border-black transition-transform duration-300 text-sm md:text-base ${animating ? 'scale-150 animate-vs-impact' : 'scale-100'}`}>
                  VS
                </div>
              </div>

              {/* Left Side */}
              <DuelCard 
                item={leftItem} 
                side="left" 
                animating={animating} 
                onSelect={() => handlePick('left')} 
              />

              {/* Right Side */}
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
      <div className="p-8 md:p-12">
        {!results && (
          <div className="w-full max-w-xl mx-auto space-y-3">
             <div className="flex justify-between text-[10px] uppercase tracking-widest font-bold text-white/20">
                <span>Start</span>
                <span>Finish</span>
             </div>
             <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-violet-600 to-pink-500 shadow-[0_0_20px_rgba(124,58,237,0.5)] transition-all duration-700 cubic-bezier(0.16, 1, 0.3, 1)"
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
  const isLoser = animating && animating !== side

  return (
    <div 
      className={`relative group cursor-pointer transition-all duration-700 h-full ${
        isLoser ? 'opacity-0 scale-90 blur-2xl translate-y-12' : 'opacity-100'
      } ${isWinner ? 'z-20 scale-105' : 'z-10'} ${side === 'left' ? 'animate-slide-in-left' : 'animate-slide-in-right'}`}
      onClick={onSelect}
    >
      <div className={`relative h-full aspect-[3/4.5] rounded-[2rem] overflow-hidden border-2 transition-all duration-500 shadow-2xl ${
        isWinner ? 'border-violet-500 shadow-violet-500/40' : 'border-white/5 group-hover:border-white/20 group-hover:shadow-white/10'
      }`}>
        <Image
          src={item.image_url}
          alt="Option"
          fill
          className={`object-cover transition-transform duration-1000 ${isWinner ? 'scale-110' : 'group-hover:scale-105'}`}
          sizes="(max-width: 768px) 50vw, 400px"
        />
        
        {/* Interaction Overlays */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-all duration-500 flex flex-col items-center justify-center">
            <div className={`w-12 h-12 md:w-20 md:h-20 rounded-full bg-white/10 backdrop-blur-xl flex items-center justify-center text-white text-2xl md:text-4xl shadow-2xl transition-transform duration-500 group-hover:scale-110 group-active:scale-90 border border-white/20 ${isWinner ? 'animate-winner-pulse bg-violet-500/40' : ''}`}>
              {side === 'left' ? '👈' : '👉'}
            </div>
            <div className="mt-4 md:mt-6 px-4 md:px-6 py-1.5 md:py-2 rounded-full bg-white text-black font-black text-[10px] md:text-xs tracking-widest uppercase shadow-2xl">
              Select
            </div>
        </div>

        {/* Winner Flare */}
        {isWinner && (
          <div className="absolute inset-0 bg-violet-500/20 mix-blend-overlay animate-winner-pulse" />
        )}
      </div>

      {item.price !== null && (
        <div className="mt-4 md:mt-6 text-center">
          <span className="px-3 md:px-4 py-1 md:py-1.5 rounded-full bg-white/5 border border-white/10 text-white font-mono text-sm md:text-lg font-black group-hover:bg-white/10 transition-colors">
            ¥{item.price}
          </span>
        </div>
      )}
    </div>
  )
}
