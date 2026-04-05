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
}

export default function TournamentEntry({ items }: TournamentEntryProps) {
  const [isOpen, setIsOpen] = useState(false)

  // Only show if there are at least 2 items to compare
  if (items.length < 2) return null

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-pink-500 to-rose-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-pink-500/20 hover:shadow-pink-500/40 transition-all hover:scale-[1.02] active:scale-95 group"
      >
        <span className="text-lg group-hover:animate-bounce">⚔️</span>
        开启 2选1 对决
      </button>

      {isOpen && (
        <TournamentDuel 
          items={items} 
          onClose={() => setIsOpen(false)} 
        />
      )}
    </>
  )
}
