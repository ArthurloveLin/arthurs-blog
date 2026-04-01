'use client'

import { useState } from 'react'

interface StarRatingProps {
  itemId: string
  author: string
  initialScore: number | null
  onRate?: (score: number) => void
}

export default function StarRating({ itemId, author, initialScore, onRate }: StarRatingProps) {
  const [score, setScore] = useState<number | null>(initialScore)
  const [hover, setHover] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)

  async function handleRate(newScore: number) {
    if (!author || saving) return
    setSaving(true)
    const prev = score
    setScore(newScore)
    try {
      const res = await fetch('/api/ratings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_id: itemId, author, score: newScore }),
      })
      if (!res.ok) throw new Error('Failed')
      onRate?.(newScore)
    } catch {
      setScore(prev)
    } finally {
      setSaving(false)
    }
  }

  const display = hover ?? score ?? 0

  return (
    <div className="flex flex-col gap-1">
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            disabled={saving || !author}
            onClick={() => handleRate(star)}
            onMouseEnter={() => setHover(star)}
            onMouseLeave={() => setHover(null)}
            className={`text-3xl leading-none transition-colors disabled:cursor-not-allowed ${
              display >= star ? 'text-yellow-400' : 'text-gray-200'
            }`}
          >
            ★
          </button>
        ))}
      </div>
      {score !== null && (
        <p className="text-xs text-gray-400">{score.toFixed(1)} 分</p>
      )}
      {!author && (
        <p className="text-xs text-gray-400">请先选择身份再评分</p>
      )}
    </div>
  )
}
