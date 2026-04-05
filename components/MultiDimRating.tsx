'use client'

import { useState } from 'react'
import { updatePresenceActivity } from './ActivityBanner'
import { Dimension } from '@/lib/templates'

interface RatingData {
  author: string
  score: number | null
  scores: Record<string, number | null>
}

interface MultiDimRatingProps {
  itemId: string
  author: string
  myScores: Record<string, number | null> // 从数据库 ratings.scores 传入
  allRatings: RatingData[]
  dimensions: Dimension[]
  onRate?: () => void
}

// 权重配置：Arthur / Grace 权重高，其余为游客权重
const NAMED_AUTHORS = ['Arthur', 'Grace']
const NAMED_WEIGHT = 2
const GUEST_WEIGHT = 1

const AUTHOR_COLORS: Record<string, string> = {
  Arthur: '#f472b6',
  Grace: '#60a5fa',
}
const AVG_COLOR = '#f59e0b'

function getWeight(author: string) {
  return NAMED_AUTHORS.includes(author) ? NAMED_WEIGHT : GUEST_WEIGHT
}

function computeWeightedAvg(ratings: RatingData[], dimensions: Dimension[]): RatingData | null {
  const valid = ratings.filter((r) => dimensions.every((d) => r.scores?.[d.key] != null))
  if (valid.length === 0) return null

  const totalWeight = valid.reduce((sum, r) => sum + getWeight(r.author), 0)
  const weightedScores: Record<string, number | null> = {}

  dimensions.forEach((d) => {
    weightedScores[d.key] =
      valid.reduce((sum, r) => sum + (r.scores![d.key] || 0) * getWeight(r.author), 0) / totalWeight
  })

  return {
    author: '加权均值',
    score: null,
    scores: weightedScores,
  }
}

// ── RadarChart ────────────────────────────────────────────────────────────────
interface RadarEntry {
  rating: RatingData
  color: string
  label: string
  dashed?: boolean
}

function RadarChart({ entries, dimensions }: { entries: RadarEntry[]; dimensions: Dimension[] }) {
  const cx = 100
  const cy = 105
  const r = 65
  const n = dimensions.length
  
  // 基础角度计算，n 个方向均匀分布
  const angles = Array.from({ length: n }, (_, i) =>
    ((-90 + (360 / n) * i) * Math.PI) / 180
  )

  function point(val: number, idx: number) {
    const ratio = Math.min(Math.max(val / 5, 0), 1) // 限制在 0-1 之间
    return {
      x: cx + ratio * r * Math.cos(angles[idx]),
      y: cy + ratio * r * Math.sin(angles[idx]),
    }
  }

  function toPath(entryScores: Record<string, number | null>): string | null {
    if (dimensions.some((d) => entryScores[d.key] == null)) return null
    const pts = dimensions.map((d, i) => point(entryScores[d.key] as number, i))
    return (
      pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ') +
      ' Z'
    )
  }

  const labelOffset = r + 18

  return (
    <svg viewBox="0 0 200 210" className="w-full max-w-[220px] mx-auto">
      {/* 背景网格 */}
      {[1, 2, 3, 4, 5].map((level) => {
        const pts = angles.map((_, i) => point(level, i))
        const d =
          pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ') +
          ' Z'
        return <path key={level} d={d} fill="none" stroke="currentColor" className="text-border" strokeWidth="1" />
      })}

      {/* 坐标轴线 */}
      {angles.map((_, i) => {
        const outer = point(5, i)
        return (
          <line
            key={i}
            x1={cx}
            y1={cy}
            x2={outer.x.toFixed(1)}
            y2={outer.y.toFixed(1)}
            stroke="currentColor"
            className="text-border"
            strokeWidth="1"
          />
        )
      })}

      {/* 各数据多边形 */}
      {entries.map(({ rating, color, dashed }) => {
        const d = toPath(rating.scores)
        if (!d) return null
        return (
          <g key={rating.author}>
            <path
              d={d}
              fill={color}
              fillOpacity={dashed ? 0.08 : 0.15}
              stroke={color}
              strokeWidth={dashed ? 1.5 : 2}
              strokeLinejoin="round"
              strokeDasharray={dashed ? '4 2' : undefined}
            />
            {!dashed &&
              dimensions.map((d, i) => {
                const val = rating.scores[d.key] || 0
                const p = point(val, i)
                return <circle key={i} cx={p.x} cy={p.y} r="3" fill={color} />
              })}
          </g>
        )
      })}

      {/* 维度标签 */}
      {dimensions.map((dim, i) => {
        const lx = cx + labelOffset * Math.cos(angles[i])
        const ly = cy + labelOffset * Math.sin(angles[i])
        return (
          <text
            key={dim.key}
            x={lx.toFixed(1)}
            y={ly.toFixed(1)}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize="10"
            className="fill-muted-foreground"
            fontWeight="600"
          >
            {dim.label}
          </text>
        )
      })}
    </svg>
  )
}

// ── DimStars ──────────────────────────────────────────────────────────────────
function DimStars({
  label,
  color,
  value,
  onChange,
  disabled,
}: {
  label: string
  color: string
  value: number | null
  onChange: (v: number) => void
  disabled: boolean
}) {
  const [hover, setHover] = useState<number | null>(null)
  const display = hover ?? value ?? 0

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs w-14 text-muted-foreground shrink-0">{label}</span>
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            disabled={disabled}
            onClick={() => onChange(star)}
            onMouseEnter={() => setHover(star)}
            onMouseLeave={() => setHover(null)}
            className="text-xl leading-none transition-all active:scale-125 disabled:cursor-not-allowed hover:scale-110"
            style={{ color: display >= star ? color : 'var(--muted)' }}
          >
            ★
          </button>
        ))}
      </div>
      {value !== null && <span className="text-[10px] font-bold text-muted-foreground/40 w-6">{value}.0</span>}
    </div>
  )
}

// ── MultiDimRating ────────────────────────────────────────────────────────────
export default function MultiDimRating({
  itemId,
  author,
  myScores,
  allRatings,
  dimensions,
  onRate,
}: MultiDimRatingProps) {
  const [scores, setScores] = useState<Record<string, number | null>>({ ...myScores })
  const [saving, setSaving] = useState(false)

  async function handleDimChange(key: string, val: number) {
    if (!author || saving) return
    updatePresenceActivity('正在打分')
    const newScores = { ...scores, [key]: val }
    setScores(newScores)

    // 检查是否所有维度都已填满
    const allFilled = dimensions.every((d) => newScores[d.key] != null)
    if (!allFilled) return

    setSaving(true)
    try {
      const res = await fetch('/api/ratings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item_id: itemId,
          author,
          ...newScores,
        }),
      })
      if (!res.ok) throw new Error('Failed')
      onRate?.()
    } catch {
      setScores((prev) => ({ ...prev, [key]: myScores[key] }))
    } finally {
      setSaving(false)
    }
  }

  const allFilled = dimensions.every((d) => scores[d.key] != null)

  // 合并本地状态到 allRatings
  const displayRatings: RatingData[] = allRatings.map((r) =>
    r.author === author ? { ...r, scores: { ...r.scores, ...scores } } : r
  )
  const hasMyRating = allRatings.some((r) => r.author === author)
  if (!hasMyRating && author && allFilled) {
    displayRatings.push({ author, score: null, scores })
  }

  // ── 构建雷达图数据：Arthur / Grace / 加权均值 ──────────────────────────────
  const arthurEntry = displayRatings.find((r) => r.author === 'Arthur')
  const graceEntry = displayRatings.find((r) => r.author === 'Grace')
  const weightedAvg = computeWeightedAvg(displayRatings, dimensions)

  const radarEntries: RadarEntry[] = []
  if (arthurEntry) radarEntries.push({ rating: arthurEntry, color: AUTHOR_COLORS.Arthur, label: 'Arthur' })
  if (graceEntry) radarEntries.push({ rating: graceEntry, color: AUTHOR_COLORS.Grace, label: 'Grace' })
  if (weightedAvg) radarEntries.push({ rating: weightedAvg, color: AVG_COLOR, label: '加权均值', dashed: true })

  const hasRadarData = radarEntries.some((e) => dimensions.every((d) => e.rating.scores?.[d.key] != null))

  // 综合分计算（用于图例展示）
  function avgScore(ratingScores: Record<string, number | null>) {
    const vals = Object.values(ratingScores).filter((v) => v != null) as number[]
    if (vals.length === 0) return null
    return (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1)
  }

  return (
    <div className="space-y-4">
      {/* 我的多维打分 */}
      <div className="bg-muted/30 rounded-xl p-3 border border-border/50">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground/60">我的评分</span>
          {saving && <span className="text-[10px] uppercase font-bold text-primary animate-pulse">保存中…</span>}
          {!author && <span className="text-[10px] font-bold text-destructive/60">请先选择身份再评分</span>}
        </div>
        <div className="space-y-3">
          {dimensions.map((dim) => (
            <DimStars
              key={dim.key}
              label={dim.label}
              color={dim.color}
              value={scores[dim.key]}
              onChange={(v) => handleDimChange(dim.key, v)}
              disabled={!author || saving}
            />
          ))}
        </div>
        {author && !allFilled && (
          <p className="text-[10px] text-muted-foreground/40 mt-3 italic text-right">
            完成 {dimensions.length} 项评分后自动保存
          </p>
        )}
      </div>

      {/* 雷达图 */}
      {hasRadarData && (
        <div className="pt-2">
          {/* 图例 */}
          <div className="flex flex-wrap items-center justify-center gap-4 mb-4">
            {radarEntries.map((e) => {
              const avg = avgScore(e.rating.scores)
              return (
                <div key={e.label} className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-tight">
                  <span
                    className="inline-block w-2 h-2 rounded-full shadow-sm"
                    style={{ background: e.color }}
                  />
                  <span className="text-muted-foreground/80">{e.label}</span>
                  {avg && <span className="text-foreground/40">{avg}分</span>}
                </div>
              )
            })}
          </div>
          <RadarChart entries={radarEntries} dimensions={dimensions} />
        </div>
      )}
    </div>
  )
}
