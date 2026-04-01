'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import StarRating from './StarRating'
import CommentBox from './CommentBox'

const AUTHORS = ['Arthur', 'Grace']

type Decision = 'buy' | 'skip' | 'pending'

interface Rating {
  score: number
  author: string
}

interface Comment {
  id: string
  author: string
  content: string
  created_at: string
}

interface Item {
  id: string
  image_url: string
  decision: Decision
  ratings: Rating[]
  comments: Comment[]
}

interface ItemDetailProps {
  item: Item
  token: string
}

const DECISION_CONFIG: { value: Decision; label: string; active: string; inactive: string }[] = [
  { value: 'buy', label: '买', active: 'bg-green-500 text-white', inactive: 'bg-gray-100 text-gray-600 hover:bg-green-50 hover:text-green-600' },
  { value: 'pending', label: '待定', active: 'bg-yellow-400 text-white', inactive: 'bg-gray-100 text-gray-600 hover:bg-yellow-50 hover:text-yellow-600' },
  { value: 'skip', label: '不买', active: 'bg-gray-500 text-white', inactive: 'bg-gray-100 text-gray-600 hover:bg-gray-200' },
]

export default function ItemDetail({ item, token }: ItemDetailProps) {
  const [author, setAuthorState] = useState('')
  const [decision, setDecision] = useState<Decision>(item.decision)
  const [savingDecision, setSavingDecision] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem('wardrobe_author')
    if (stored) setAuthorState(stored)
  }, [])

  function setAuthor(name: string) {
    localStorage.setItem('wardrobe_author', name)
    setAuthorState(name)
  }

  async function handleDecision(value: Decision) {
    if (savingDecision) return
    setSavingDecision(true)
    const prev = decision
    setDecision(value)
    try {
      const res = await fetch(`/api/items/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision: value }),
      })
      if (!res.ok) throw new Error('Failed')
    } catch {
      setDecision(prev)
    } finally {
      setSavingDecision(false)
    }
  }

  const myRating = item.ratings.find((r) => r.author === author)?.score ?? null
  const allScores = item.ratings.map((r) => r.score)
  const avgScore =
    allScores.length > 0
      ? allScores.reduce((a, b) => a + b, 0) / allScores.length
      : null

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-lg mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <Link href={`/session/${token}`} className="text-gray-400 hover:text-gray-600">
            ← 返回
          </Link>
          <h1 className="text-lg font-semibold text-gray-800">图片详情</h1>
        </div>

        {/* Image */}
        <div className="relative w-full aspect-square rounded-2xl overflow-hidden bg-gray-100 shadow-sm mb-5">
          <Image
            src={item.image_url}
            alt="衣服图片"
            fill
            className="object-contain"
            sizes="(max-width: 640px) 100vw, 512px"
          />
        </div>

        {/* Decision */}
        <div className="bg-white rounded-2xl p-4 shadow-sm mb-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">决策</h2>
          <div className="flex gap-2">
            {DECISION_CONFIG.map(({ value, label, active, inactive }) => (
              <button
                key={value}
                disabled={savingDecision}
                onClick={() => handleDecision(value)}
                className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors disabled:opacity-60 ${
                  decision === value ? active : inactive
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Author Picker */}
        <div className="bg-white rounded-2xl p-4 shadow-sm mb-4">
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500">你是：</span>
            <div className="flex gap-2">
              {AUTHORS.map((a) => (
                <button
                  key={a}
                  onClick={() => setAuthor(a)}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    author === a
                      ? 'bg-pink-500 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {a}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Rating */}
        <div className="bg-white rounded-2xl p-4 shadow-sm mb-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-700">我的评分</h2>
            {avgScore !== null && (
              <span className="text-xs text-gray-400">
                平均 {avgScore.toFixed(1)} 分（{allScores.length} 人）
              </span>
            )}
          </div>
          <StarRating itemId={item.id} author={author} initialScore={myRating} />

          {item.ratings.length > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-50 flex gap-4">
              {item.ratings.map((r) => (
                <div key={r.author} className="text-xs text-gray-500">
                  <span className="font-medium text-pink-400">{r.author}</span>{' '}
                  <span className="text-yellow-400">{'★'.repeat(Math.round(r.score))}</span>
                  <span className="text-gray-300">{'★'.repeat(5 - Math.round(r.score))}</span>
                  {' '}{r.score.toFixed(1)}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Comments */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <CommentBox itemId={item.id} author={author} initialComments={item.comments} />
        </div>
      </div>
    </main>
  )
}
