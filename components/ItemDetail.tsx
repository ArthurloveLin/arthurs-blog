'use client'

import Image from 'next/image'
import { useState, useRef } from 'react'
import BackButton from './BackButton'
import MultiDimRating from './MultiDimRating'
import CommentBox from './CommentBox'
import Lightbox from './Lightbox'
import AdminOnly from './AdminOnly'
import { useAuth } from './AuthProvider'
import { updatePresenceActivity } from './ActivityBanner'
import { TemplateConfig, TEMPLATES, DEFAULT_TEMPLATE } from '@/lib/templates'

const CATEGORIES = ['上衣', '裤子', '鞋子', '配饰', '其他']

type Decision = 'buy' | 'skip' | 'pending'

interface Rating {
  score: number | null
  author: string
  scores: Record<string, number | null>
  // 旧字段保留用于兼容
  appearance_score?: number | null
  practicality_score?: number | null
  value_score?: number | null
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
  category: string | null
  rank: number | null
  ratings: Rating[]
  comments: Comment[]
}

interface ItemDetailProps {
  item: Item
  token: string
  templateConfig?: TemplateConfig
}

export default function ItemDetail({ 
  item, 
  token, 
  templateConfig: initialTemplateConfig
}: ItemDetailProps) {
  const { role, displayName, email, guestId } = useAuth()
  
  const isAdmin = role === 'admin'
  const identity = displayName || email || guestId

  const templateConfig = initialTemplateConfig || TEMPLATES[DEFAULT_TEMPLATE]
  const dimensions = templateConfig.dimensions

  const buyLabel = templateConfig?.descLabels?.buy || '买'
  const pendingLabel = templateConfig?.descLabels?.pending || '待定'
  const skipLabel = templateConfig?.descLabels?.skip || '不买'

  const DECISION_CONFIG: { value: Decision; label: string; active: string; inactive: string }[] = [
    { value: 'buy', label: buyLabel, active: 'bg-green-500 text-white shadow-lg shadow-green-500/20', inactive: 'bg-muted text-muted-foreground hover:bg-green-500/10 hover:text-green-500 transition-all font-bold' },
    { value: 'pending', label: pendingLabel, active: 'bg-yellow-400 text-white shadow-lg shadow-yellow-400/20', inactive: 'bg-muted text-muted-foreground hover:bg-yellow-500/10 hover:text-yellow-500 transition-all font-bold' },
    { value: 'skip', label: skipLabel, active: 'bg-zinc-500 text-white shadow-lg shadow-zinc-500/20', inactive: 'bg-muted text-muted-foreground hover:bg-muted/80 transition-all font-bold' },
  ]

  const [decision, setDecision] = useState<Decision>(item.decision)
  const [savingDecision, setSavingDecision] = useState(false)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [price, setPrice] = useState<string>(item.price !== null ? String(item.price) : '')
  const [notes, setNotes] = useState<string>(item.notes ?? '')
  const [category, setCategory] = useState<string>(item.category ?? '')
  const priceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const notesTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Trigger activity update on mount
  useState(() => {
    updatePresenceActivity(`正在看${templateConfig.itemLabel}`)
    return () => { updatePresenceActivity('正在浏览') }
  })

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

  async function handleCategoryChange(val: string) {
    setCategory(val)
    try {
      await fetch(`/api/items/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: val || null }),
      })
    } catch (err) {
      console.error('Failed to update category', err)
    }
  }

  const myRatingData = item.ratings.find((r) => r.author === identity)
  
  // 提取我的评分：优先从 scores 对象中取，否则尝试从旧字段映射
  const myDimScores: Record<string, number | null> = {}
  dimensions.forEach((d) => {
    const ratingRecord = myRatingData as Record<string, number | null | undefined> | undefined
    myDimScores[d.key] = myRatingData?.scores?.[d.key] ?? ratingRecord?.[d.key] ?? null
  })

  // 格式化所有评分以适配 MultiDimRating
  const formattedAllRatings = item.ratings.map(r => ({
    ...r,
    scores: dimensions.reduce((acc, d) => {
      const rRecord = r as unknown as Record<string, number | null | undefined>
      return {
        ...acc,
        [d.key]: r.scores?.[d.key] ?? rRecord?.[d.key] ?? null
      }
    }, {})
  }))

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
    <div className="min-h-screen bg-background">
      <div className="max-w-lg mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <BackButton fallback={`/session/${token}`} className="text-muted-foreground hover:text-foreground" />
          <h1 className="text-lg font-semibold text-foreground">{templateConfig.itemLabel}详情</h1>
        </div>

        {/* Image */}
        <button
          className="relative w-full aspect-square rounded-2xl overflow-hidden bg-card border border-border shadow-sm mb-5 block"
          onClick={() => setLightboxOpen(true)}
          style={{ viewTransitionName: `wardrobe-item-${item.id}` }}
        >
          <Image
            src={item.image_url}
            alt={`${templateConfig.itemLabel}图片`}
            fill
            className="object-contain"
            sizes="(max-width: 640px) 100vw, 512px"
          />
          <div className="absolute bottom-2 right-2 bg-black/30 text-white text-xs px-2 py-0.5 rounded-full">
            点击放大
          </div>

          {/* Rank Medal Ribbon */}
          {item.rank && item.rank <= 3 && (
            <div className="absolute top-0 right-0 w-24 h-24 overflow-hidden z-20 pointer-events-none">
              <div className={`absolute top-[28px] right-[-34px] w-[140px] rotate-45 text-white text-xs font-black py-1.5 shadow-2xl border-y border-white/20 text-center uppercase tracking-widest ${
                item.rank === 1 ? 'bg-gradient-to-r from-yellow-400 to-orange-500 animate-champion-shine bg-[length:200%_100%]' : 
                item.rank === 2 ? 'bg-gradient-to-r from-slate-300 to-slate-500' : 
                'bg-gradient-to-r from-amber-600 to-amber-800'
              }`}>
                {item.rank === 1 ? '🥇 Champion' : item.rank === 2 ? '🥈 Runner Up' : '🥉 Third Place'}
              </div>
            </div>
          )}
        </button>

        {lightboxOpen && (
          <Lightbox
            imageUrl={item.image_url}
            detailUrl=""
            onClose={() => setLightboxOpen(false)}
          />
        )}

        {/* Category — admin only */}
        {templateConfig.name === '衣评' && (
          <AdminOnly>
            <div className="bg-card border border-border rounded-2xl p-4 shadow-sm mb-4">
              <h2 className="text-sm font-semibold text-foreground mb-3">分类</h2>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => handleCategoryChange('')}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    category === ''
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-zinc-200 dark:hover:bg-zinc-800'
                  }`}
                >
                  未分类
                </button>
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => handleCategoryChange(cat)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                      category === cat
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
          </AdminOnly>
        )}

        {/* Category display — guest/user read-only */}
        {templateConfig.name === '衣评' && !isAdmin && category && (
          <div className="bg-card border border-border rounded-2xl p-4 shadow-sm mb-4">
            <h2 className="text-sm font-semibold text-foreground mb-1">分类</h2>
            <span className="inline-block px-3 py-1.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
              {category}
            </span>
          </div>
        )}

        {/* Decision + Price — admin only */}
        <AdminOnly>
          <div className="bg-card border border-border rounded-2xl p-4 shadow-sm mb-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-foreground">决策</h2>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] uppercase font-bold text-muted-foreground mr-1">
                  {templateConfig.priceLabel || '价格'}
                </span>
                <span className="text-xs text-muted-foreground">¥</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={price}
                  onChange={(e) => handlePriceChange(e.target.value)}
                  placeholder="填写"
                  className="w-24 text-sm text-right bg-muted/50 border border-border rounded-lg px-2 py-1 text-foreground focus:outline-none focus:border-primary/50"
                />
              </div>
            </div>
            <div className="flex gap-2">
              {DECISION_CONFIG.map(({ value, label, active, inactive }) => (
                <button
                  key={value}
                  disabled={savingDecision}
                  onClick={() => handleDecision(value)}
                  className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all active:scale-95 disabled:opacity-60 ${
                    decision === value ? active : inactive
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </AdminOnly>

        {/* Rating */}
        <div className="bg-card border border-border rounded-2xl p-4 shadow-sm mb-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-foreground">多维评分</h2>
            {avgScore !== null && (
              <span className="text-xs text-muted-foreground">
                综合 {avgScore.toFixed(1)} 分（{allScores.length} 人）
              </span>
            )}
          </div>
          <MultiDimRating
            itemId={item.id}
            author={identity}
            myScores={myDimScores}
            allRatings={formattedAllRatings}
            dimensions={dimensions}
          />
          {scoreDiff !== null && scoreDiff >= 2 && (
            <div className="flex items-center gap-1.5 bg-orange-50 dark:bg-orange-950/20 rounded-lg px-3 py-2 mt-3 text-orange-600 dark:text-orange-400">
              <span className="text-sm">⚡</span>
              <span className="text-xs font-medium">
                两人综合分歧较大（相差 {scoreDiff.toFixed(1)} 分），需要讨论～
              </span>
            </div>
          )}
        </div>

        {/* Notes — admin only */}
        <AdminOnly>
          <div className="bg-card border border-border rounded-2xl p-4 shadow-sm mb-4">
            <h2 className="text-sm font-semibold text-foreground mb-2">备注</h2>
            <textarea
              value={notes}
              onChange={(e) => handleNotesChange(e.target.value)}
              placeholder={templateConfig.itemNotePlaceholder || "填写详细描述..."}
              rows={3}
              className="w-full text-sm text-foreground bg-muted/50 border border-border rounded-xl px-3 py-2 resize-none focus:outline-none focus:border-primary/50 placeholder:text-muted-foreground/50"
            />
          </div>
        </AdminOnly>

        {/* Comments */}
        <div className="bg-card border border-border rounded-2xl p-4 shadow-sm">
          <CommentBox targetType="wardrobe_item" targetId={item.id} initialComments={item.comments} />
        </div>
      </div>
    </div>
  )
}
