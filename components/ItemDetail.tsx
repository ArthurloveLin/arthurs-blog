'use client'

import Image from 'next/image'
import { createContext, use, useEffect, useRef, useState } from 'react'
import BackButton from './BackButton'
import MultiDimRating from './MultiDimRating'
import CommentBox from './CommentBox'
import Lightbox from './Lightbox'
import { useAuth } from './AuthProvider'
import { updatePresenceActivity } from './ActivityBanner'
import { TemplateConfig, TEMPLATES, DEFAULT_TEMPLATE } from '@/lib/templates'

const CATEGORIES = ['上衣', '裤子', '鞋子', '配饰', '其他']

type Decision = 'buy' | 'skip' | 'pending'

interface Rating {
  score: number | null
  author: string
  scores: Record<string, number | null>
  appearance_score?: number | null
  practicality_score?: number | null
  value_score?: number | null
}

interface Comment {
  id: string
  author: string
  content: string
  created_at: string
  updated_at: string | null
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
  ocr_status?: 'idle' | 'pending' | 'processing' | 'completed' | 'failed' | null
  ocr_provider?: string | null
  ocr_data?: {
    error?: string
  } | null
  ratings: Rating[]
  comments: Comment[]
}

interface ItemDetailProps {
  item: Item
  token: string
  templateConfig?: TemplateConfig
}

interface ItemDetailContextValue {
  item: Item
  token: string
  templateConfig: TemplateConfig
  identity: string
  isAdmin: boolean
  decision: Decision
  savingDecision: boolean
  lightboxOpen: boolean
  price: string
  productInfo: string
  category: string
  myDimScores: Record<string, number | null>
  formattedAllRatings: Array<Rating & { scores: Record<string, number | null> }>
  allScores: number[]
  avgScore: number | null
  scoreDiff: number | null
  openLightbox: () => void
  closeLightbox: () => void
  handleDecision: (value: Decision) => Promise<void>
  handlePriceChange: (value: string) => void
  handleProductInfoChange: (value: string) => void
  handleCategoryChange: (value: string) => Promise<void>
}

const ItemDetailContext = createContext<ItemDetailContextValue | null>(null)

function useItemDetail() {
  const context = use(ItemDetailContext)
  if (!context) {
    throw new Error('useItemDetail must be used within ItemDetailContext')
  }
  return context
}

function SectionCard({ children }: { children: React.ReactNode }) {
  return <div className="bg-card border border-border rounded-2xl p-4 shadow-sm mb-4">{children}</div>
}

function ItemDetailHeader() {
  const { token, templateConfig } = useItemDetail()

  return (
    <div className="flex items-center gap-3 mb-4">
      <BackButton fallback={`/session/${token}`} className="text-muted-foreground hover:text-foreground" />
      <h1 className="text-lg font-semibold text-foreground">{templateConfig.itemLabel}详情</h1>
    </div>
  )
}

function ItemDetailImageSection() {
  const { item, lightboxOpen, openLightbox, closeLightbox, templateConfig } = useItemDetail()

  return (
    <>
      <button
        className="relative w-full aspect-square rounded-2xl overflow-hidden bg-card border border-border shadow-sm mb-5 block"
        onClick={openLightbox}
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
        {item.rank && item.rank <= 3 && (
          <div className="absolute top-0 right-0 w-28 h-28 overflow-hidden z-20 pointer-events-none">
            <div
              className="absolute top-[32px] right-[-36px] w-[152px] rotate-45 text-xs font-bold py-1.5 text-center tracking-widest"
              style={{
                background:
                  item.rank === 1 ? 'rgba(216,180,72,0.68)' :
                  item.rank === 2 ? 'rgba(192,198,208,0.68)' :
                  'rgba(182,138,90,0.68)',
                backdropFilter: 'blur(6px)',
                WebkitBackdropFilter: 'blur(6px)',
                color:
                  item.rank === 1 ? '#2a1800' :
                  item.rank === 2 ? '#1a202c' :
                  '#1f120a',
                borderTop: item.rank === 1 ? '1px solid rgba(255,225,100,0.40)' :
                  item.rank === 2 ? '1px solid rgba(235,240,248,0.40)' :
                  '1px solid rgba(220,180,130,0.40)',
                borderBottom: item.rank === 1 ? '1px solid rgba(255,225,100,0.40)' :
                  item.rank === 2 ? '1px solid rgba(235,240,248,0.40)' :
                  '1px solid rgba(220,180,130,0.40)',
              }}
            >
              {item.rank === 1 ? '🥇 冠军' : item.rank === 2 ? '🥈 亚军' : '🥉 季军'}
            </div>
          </div>
        )}
      </button>

      {lightboxOpen && (
        <Lightbox imageUrl={item.image_url} detailUrl="" onClose={closeLightbox} />
      )}
    </>
  )
}

function ItemDetailProductInfoSection() {
  const {
    category,
    handleCategoryChange,
    handlePriceChange,
    handleProductInfoChange,
    isAdmin,
    item,
    price,
    productInfo,
    templateConfig,
  } = useItemDetail()

  const hasDisplayContent = Boolean(productInfo || category || price || (isAdmin && templateConfig.name === '衣评'))

  if (!hasDisplayContent) return null

  const ocrStatus = item.ocr_status
  const showOcrStatus = isAdmin && templateConfig.name === '衣评' && ocrStatus && ocrStatus !== 'idle'

  return (
    <SectionCard>
      <div className="flex items-center justify-between gap-3 mb-3">
        <h2 className="text-sm font-semibold text-foreground">商品信息</h2>
        {showOcrStatus && (
          <span className={`text-[11px] px-2.5 py-1 rounded-full font-medium ${
            ocrStatus === 'completed'
              ? 'bg-emerald-500/10 text-emerald-600'
              : ocrStatus === 'failed'
                ? 'bg-destructive/10 text-destructive'
                : 'bg-amber-500/10 text-amber-600'
          }`}>
            {ocrStatus === 'completed'
              ? 'OCR 已自动填写'
              : ocrStatus === 'failed'
                ? 'OCR 失败，可手动填写'
                : 'OCR 识别中'}
          </span>
        )}
      </div>

      {showOcrStatus && ocrStatus === 'failed' && item.ocr_data?.error && (
        <p className="text-xs text-muted-foreground mb-3">{item.ocr_data.error}</p>
      )}

      {isAdmin ? (
        <textarea
          value={productInfo}
          onChange={(e) => handleProductInfoChange(e.target.value)}
          placeholder={templateConfig.itemNotePlaceholder || '填写商品信息...'}
          rows={4}
          className="w-full text-sm text-foreground bg-muted/50 border border-border rounded-xl px-3 py-2 resize-none focus:outline-none focus:border-primary/50 placeholder:text-muted-foreground/50"
        />
      ) : productInfo ? (
        <div className="rounded-xl border border-border bg-muted/30 px-3 py-2 text-sm text-foreground whitespace-pre-wrap">
          {productInfo}
        </div>
      ) : null}

      {templateConfig.name === '衣评' && (
        <div className="mt-4 space-y-3">
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-[0.18em] mb-2">分类</h3>
            {isAdmin ? (
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => void handleCategoryChange('')}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    category === ''
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-zinc-200 dark:hover:bg-zinc-800'
                  }`}
                >
                  未分类
                </button>
                {CATEGORIES.map((itemCategory) => (
                  <button
                    key={itemCategory}
                    onClick={() => void handleCategoryChange(itemCategory)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                      category === itemCategory
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    }`}
                  >
                    {itemCategory}
                  </button>
                ))}
              </div>
            ) : category ? (
              <span className="inline-block px-3 py-1.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                {category}
              </span>
            ) : (
              <span className="text-sm text-muted-foreground">未分类</span>
            )}
          </div>

          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-[0.18em] mb-2">
              {templateConfig.priceLabel || '价格'}
            </h3>
            {isAdmin ? (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">¥</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={price}
                  onChange={(e) => handlePriceChange(e.target.value)}
                  placeholder="填写"
                  className="w-full max-w-[160px] text-sm bg-muted/50 border border-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:border-primary/50"
                />
              </div>
            ) : price ? (
              <span className="text-sm font-medium text-foreground">¥{price}</span>
            ) : (
              <span className="text-sm text-muted-foreground">未填写</span>
            )}
          </div>
        </div>
      )}
    </SectionCard>
  )
}

function ItemDetailDecisionRatingSection() {
  const { avgScore, allScores, decision, formattedAllRatings, handleDecision, identity, isAdmin, item, myDimScores, savingDecision, scoreDiff, templateConfig } = useItemDetail()

  const decisionOptions: { value: Decision; label: string; active: string; inactive: string }[] = [
    {
      value: 'buy',
      label: templateConfig.descLabels?.buy || '买',
      active: 'bg-green-500 text-white shadow-lg shadow-green-500/20',
      inactive: 'bg-muted text-muted-foreground hover:bg-green-500/10 hover:text-green-500 transition-all font-bold',
    },
    {
      value: 'pending',
      label: templateConfig.descLabels?.pending || '待定',
      active: 'bg-yellow-400 text-white shadow-lg shadow-yellow-400/20',
      inactive: 'bg-muted text-muted-foreground hover:bg-yellow-500/10 hover:text-yellow-500 transition-all font-bold',
    },
    {
      value: 'skip',
      label: templateConfig.descLabels?.skip || '不买',
      active: 'bg-zinc-500 text-white shadow-lg shadow-zinc-500/20',
      inactive: 'bg-muted text-muted-foreground hover:bg-muted/80 transition-all font-bold',
    },
  ]

  return (
    <SectionCard>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-foreground">决策与评分</h2>
        {avgScore !== null && (
          <span className="text-xs text-muted-foreground">
            综合 {avgScore.toFixed(1)} 分（{allScores.length} 人）
          </span>
        )}
      </div>
      {isAdmin && (
        <div className="flex gap-2 mb-4">
          {decisionOptions.map(({ value, label, active, inactive }) => (
            <button
              key={value}
              disabled={savingDecision}
              onClick={() => void handleDecision(value)}
              className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all active:scale-95 disabled:opacity-60 ${
                decision === value ? active : inactive
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      <MultiDimRating
        itemId={item.id}
        author={identity}
        myScores={myDimScores}
        allRatings={formattedAllRatings}
        dimensions={templateConfig.dimensions}
      />
      {scoreDiff !== null && scoreDiff >= 2 && (
        <div className="flex items-center gap-1.5 bg-orange-50 dark:bg-orange-950/20 rounded-lg px-3 py-2 mt-3 text-orange-600 dark:text-orange-400">
          <span className="text-sm">⚡</span>
          <span className="text-xs font-medium">
            两人综合分歧较大（相差 {scoreDiff.toFixed(1)} 分），需要讨论～
          </span>
        </div>
      )}
    </SectionCard>
  )
}

function ItemDetailCommentsSection() {
  const { item } = useItemDetail()

  return (
    <SectionCard>
      <CommentBox targetType="wardrobe_item" targetId={item.id} initialComments={item.comments} />
    </SectionCard>
  )
}

export default function ItemDetail({
  item,
  token,
  templateConfig: initialTemplateConfig,
}: ItemDetailProps) {
  const { identity, isAdmin } = useAuth()
  const templateConfig = initialTemplateConfig || TEMPLATES[DEFAULT_TEMPLATE]

  const [decision, setDecision] = useState<Decision>(item.decision)
  const [savingDecision, setSavingDecision] = useState(false)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [price, setPrice] = useState<string>(item.price !== null ? String(item.price) : '')
  const [productInfo, setProductInfo] = useState<string>(item.notes ?? '')
  const [category, setCategory] = useState<string>(item.category ?? '')
  const priceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const productInfoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    updatePresenceActivity(`正在看${templateConfig.itemLabel}`)
    return () => {
      updatePresenceActivity('正在浏览')
    }
  }, [templateConfig.itemLabel])

  useEffect(() => {
    return () => {
      if (priceTimerRef.current) {
        clearTimeout(priceTimerRef.current)
      }
      if (productInfoTimerRef.current) {
        clearTimeout(productInfoTimerRef.current)
      }
    }
  }, [])

  async function patchItem(payload: Record<string, unknown>) {
    const res = await fetch(`/api/items/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      throw new Error('Failed to update item')
    }
  }

  async function handleDecision(value: Decision) {
    if (savingDecision) return

    const previousDecision = decision
    setSavingDecision(true)
    setDecision(value)

    try {
      await patchItem({ decision: value })
    } catch {
      setDecision(previousDecision)
    } finally {
      setSavingDecision(false)
    }
  }

  function handlePriceChange(value: string) {
    if (value !== '' && !/^\d+$/.test(value)) return

    setPrice(value)
    if (priceTimerRef.current) clearTimeout(priceTimerRef.current)

    priceTimerRef.current = setTimeout(() => {
      void patchItem({ price: value === '' ? null : Number(value) })
    }, 600)
  }

  function handleProductInfoChange(value: string) {
    setProductInfo(value)
    if (productInfoTimerRef.current) clearTimeout(productInfoTimerRef.current)

    productInfoTimerRef.current = setTimeout(() => {
      void patchItem({ notes: value || null })
    }, 600)
  }

  async function handleCategoryChange(value: string) {
    const previousCategory = category
    setCategory(value)

    try {
      await patchItem({ category: value || null })
    } catch (error) {
      console.error('Failed to update category', error)
      setCategory(previousCategory)
    }
  }

  const myRatingData = item.ratings.find((rating) => rating.author === identity)
  const myDimScores: Record<string, number | null> = {}

  templateConfig.dimensions.forEach((dimension) => {
    const ratingRecord = myRatingData as Record<string, number | null | undefined> | undefined
    myDimScores[dimension.key] = myRatingData?.scores?.[dimension.key] ?? ratingRecord?.[dimension.key] ?? null
  })

  const formattedAllRatings = item.ratings.map((rating) => ({
    ...rating,
    scores: templateConfig.dimensions.reduce<Record<string, number | null>>((accumulator, dimension) => {
      const ratingRecord = rating as unknown as Record<string, number | null | undefined>
      accumulator[dimension.key] = rating.scores?.[dimension.key] ?? ratingRecord?.[dimension.key] ?? null
      return accumulator
    }, {}),
  }))

  const allScores = item.ratings.map((rating) => rating.score).filter((score): score is number => score != null)
  const avgScore = allScores.length > 0
    ? allScores.reduce((left, right) => left + right, 0) / allScores.length
    : null
  const arthurRating = item.ratings.find((rating) => rating.author === 'Arthur')
  const graceRating = item.ratings.find((rating) => rating.author === 'Grace')
  const scoreDiff = arthurRating?.score != null && graceRating?.score != null
    ? Math.abs(arthurRating.score - graceRating.score)
    : null

  const contextValue: ItemDetailContextValue = {
    item,
    token,
    templateConfig,
    identity,
    isAdmin,
    decision,
    savingDecision,
    lightboxOpen,
    price,
    productInfo,
    category,
    myDimScores,
    formattedAllRatings,
    allScores,
    avgScore,
    scoreDiff,
    openLightbox: () => setLightboxOpen(true),
    closeLightbox: () => setLightboxOpen(false),
    handleDecision,
    handlePriceChange,
    handleProductInfoChange,
    handleCategoryChange,
  }

  return (
    <ItemDetailContext.Provider value={contextValue}>
      <div className="min-h-screen bg-background">
        <div className="max-w-lg mx-auto px-4 py-6">
          <ItemDetailHeader />
          <ItemDetailImageSection />
          <ItemDetailProductInfoSection />
          <ItemDetailDecisionRatingSection />
          <ItemDetailCommentsSection />
        </div>
      </div>
    </ItemDetailContext.Provider>
  )
}
