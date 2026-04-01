'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState, useEffect, useRef } from 'react'
import MultiDimRating from './MultiDimRating'
import CommentBox from './CommentBox'
import Lightbox from './Lightbox'

const AUTHORS = ['Arthur', 'Grace']

type Decision = 'buy' | 'skip' | 'pending'

interface Rating {
  score: number | null
  author: string
  appearance_score: number | null
  practicality_score: number | null
  value_score: number | null
}

interface Comment {
  id: string
  author: string
  content: string
  created_at: string
  parent_id: string | null
}

interface Item {
  id: string
  image_url: string
  decision: Decision
  price: number | null
  notes: string | null
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
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [price, setPrice] = useState<string>(item.price !== null ? String(item.price) : '')
  const [notes, setNotes] = useState<string>(item.notes ?? '')
  const priceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const notesTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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

  function handlePriceChange(val: string) {
    if (val !== '' && !/^\d+$/.test(val)) return
    setPrice(val)
    if (priceTimerRef.current) clearTimeout(priceTimerRef.current)
    priceTimerRef.current = setTimeout(() => {
      fetch(`/api/items/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ price: val === '' ? null : Number(val) }),
      })
    }, 600)
  }

  function handleNotesChange(val: string) {
    setNotes(val)
    if (notesTimerRef.current) clearTimeout(notesTimerRef.current)
    notesTimerRef.current = setTimeout(() => {
      fetch(`/api/items/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: val || null }),
      })
    }, 600)
  }

  const myRatingData = item.ratings.find((r) => r.author === author)
  const myDimScores = {
    appearance_score: myRatingData?.appearance_score ?? null,
    practicality_score: myRatingData?.practicality_score ?? null,
    value_score: myRatingData?.value_score ?? null,
  }
  const allScores = item.ratings.map((r) => r.score).filter((s): s is number => s != null)
  const avgScore =
    allScores.length > 0
      ? allScores.reduce((a, b) => a + b, 0) / allScores.length
      : null
  const arthurRating = item.ratings.find((r) => r.author === 'Arthur')
  const graceRating = item.ratings.find((r) => r.author === 'Grace')
  const scoreDiff =
    arthurRating?.score != null && graceRating?.score != null
      ? Math.abs(arthurRating.score - graceRating.score)
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

        {/* Image — tap to enlarge */}
        <button
          className="relative w-full aspect-square rounded-2xl overflow-hidden bg-gray-100 shadow-sm mb-5 block"
          onClick={() => setLightboxOpen(true)}
        >
          <Image
            src={item.image_url}
            alt="衣服图片"
            fill
            className="object-contain"
            sizes="(max-width: 640px) 100vw, 512px"
          />
          <div className="absolute bottom-2 right-2 bg-black/30 text-white text-xs px-2 py-0.5 rounded-full">
            点击放大
          </div>
        </button>

        {lightboxOpen && (
          <Lightbox
            imageUrl={item.image_url}
            detailUrl=""
            onClose={() => setLightboxOpen(false)}
          />
        )}

        {/* Decision + Price */}
        <div className="bg-white rounded-2xl p-4 shadow-sm mb-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-700">决策</h2>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-gray-400">¥</span>
              <input
                type="text"
                inputMode="numeric"
                value={price}
                onChange={(e) => handlePriceChange(e.target.value)}
                placeholder="填写价格"
                className="w-24 text-sm text-right border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:border-pink-300"
              />
            </div>
          </div>
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
            <h2 className="text-sm font-semibold text-gray-700">多维评分</h2>
            {avgScore !== null && (
              <span className="text-xs text-gray-400">
                综合 {avgScore.toFixed(1)} 分（{allScores.length} 人）
              </span>
            )}
          </div>
          <MultiDimRating
            itemId={item.id}
            author={author}
            myScores={myDimScores}
            allRatings={item.ratings}
          />
          {scoreDiff !== null && scoreDiff >= 2 && (
            <div className="flex items-center gap-1.5 bg-orange-50 rounded-lg px-3 py-2 mt-3">
              <span className="text-orange-500 text-sm">⚡</span>
              <span className="text-xs text-orange-600 font-medium">
                两人综合分歧较大（相差 {scoreDiff.toFixed(1)} 分），需要讨论～
              </span>
            </div>
          )}
        </div>

        {/* Notes */}
        <div className="bg-white rounded-2xl p-4 shadow-sm mb-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-2">备注</h2>
          <textarea
            value={notes}
            onChange={(e) => handleNotesChange(e.target.value)}
            placeholder="品牌、店铺链接、尺码、颜色等信息…"
            rows={3}
            className="w-full text-sm text-gray-700 border border-gray-200 rounded-xl px-3 py-2 resize-none focus:outline-none focus:border-pink-300 placeholder-gray-300"
          />
        </div>

        {/* Comments */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <CommentBox itemId={item.id} author={author} initialComments={item.comments} />
        </div>
      </div>
    </main>
  )
}
