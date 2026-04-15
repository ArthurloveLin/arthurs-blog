'use client'

import { useState } from 'react'
import TournamentDuel from './TournamentDuel'

interface Item {
  id: string
  image_url: string
  decision: 'buy' | 'skip' | 'pending'
  price: number | null
  category: string | null
}

interface TournamentEntryProps {
  items: Item[]
  sessionToken: string
  templateConfig?: import('@/lib/templates').TemplateConfig
}

export default function TournamentEntry({ items, sessionToken, templateConfig }: TournamentEntryProps) {
  const [isOpen, setIsOpen] = useState(false)

  // Only show if there are at least 2 items to compare
  if (items.length < 2) return null

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="group relative flex w-full items-center gap-4 rounded-2xl border border-gray-900/[0.08] bg-gray-900/[0.04] px-5 py-4 text-left backdrop-blur-sm transition-all duration-300 hover:border-amber-500/20 hover:bg-gray-900/[0.07] hover:-translate-y-0.5 active:scale-[0.99] dark:border-white/[0.08] dark:bg-white/[0.03] dark:hover:border-amber-200/20 dark:hover:bg-white/[0.06] sm:w-auto sm:min-w-[280px]"
      >
        {/* subtle warm glow on hover */}
        <div className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-500 group-hover:opacity-100 bg-[radial-gradient(ellipse_at_top_left,rgba(251,191,36,0.07),transparent_60%)]" />

        <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-500/20 bg-amber-500/10 text-lg shadow-inner shadow-amber-300/5 transition-colors duration-300 group-hover:border-amber-500/35 group-hover:bg-amber-500/15">
          🏆
        </span>

        <span className="relative min-w-0 flex-1">
          <span className="block text-[13px] font-semibold tracking-[0.06em] text-gray-800 transition-colors duration-200 group-hover:text-gray-900 dark:text-white/90 dark:group-hover:text-white">选衣锦标赛</span>
          <span className="block text-[11px] font-normal tracking-wide text-gray-500 mt-0.5 dark:text-white/35">
            从 {items.length} 件{templateConfig?.itemLabel || '单品'}中决出冠军
          </span>
        </span>

        <span className="relative shrink-0 text-gray-400/60 transition-all duration-300 group-hover:translate-x-0.5 group-hover:text-amber-500/60 dark:text-white/20 dark:group-hover:text-amber-200/50">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M5 2.5L9.5 7L5 11.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </span>
      </button>

      {isOpen && (
        <TournamentDuel 
          items={items} 
          sessionToken={sessionToken}
          onClose={() => setIsOpen(false)} 
          templateConfig={templateConfig}
        />
      )}
    </>
  )
}
