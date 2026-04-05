'use client'

import { useState } from 'react'
import { updatePresenceActivity } from './ActivityBanner'

const DIMS = [
  { key: 'appearance_score' as const, label: '颜值', color: '#f472b6' },
  { key: 'practicality_score' as const, label: '实用', color: '#60a5fa' },
  { key: 'value_score' as const, label: '性价比', color: '#34d399' },
]

type DimKey = 'appearance_score' | 'practicality_score' | 'value_score'

interface DimScores {
  appearance_score: number | null
  practicality_score: number | null
  value_score: number | null
}

interface RatingData {
  author: string
  score: number | null
  appearance_score: number | null
  practicality_score: number | null
  value_score: number | null
}

interface MultiDimRatingProps {
  itemId: string
  author: string
  myScores: DimScores
  allRatings: RatingData[]
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

function computeWeightedAvg(ratings: RatingData[]): RatingData | null {
  const valid = ratings.filter(
    (r) =>
      r.appearance_score != null &&
      r.practicality_score != null &&
      r.value_score != null
  )
  if (valid.length === 0) return null

  const totalWeight = valid.reduce((sum, r) => sum + getWeight(r.author), 0)
  const wavg = (key: DimKey) =>
    valid.reduce((sum, r) => sum + r[key]! * getWeight(r.author), 0) / totalWeight

  return {
    author: '加权均值',
    score: null,
    appearance_score: wavg('appearance_score'),
    practicality_score: wavg('practicality_score'),
    value_score: wavg('value_score'),
  }
}

// ── RadarChart ────────────────────────────────────────────────────────────────
interface RadarEntry {
  rating: RatingData
  color: string
  label: string
  dashed?: boolean
}

function RadarChart({ entries }: { entries: RadarEntry[] }) {
  const cx = 100
  const cy = 105
  const r = 65
  const n = 3
  const angles = Array.from({ length: n }, (_, i) =>
    ((-90 + (360 / n) * i) * Math.PI) / 180
  )

  function point(val: number, idx: number) {
    const ratio = val / 5
    return {
      x: cx + ratio * r * Math.cos(angles[idx]),
      y: cy + ratio * r * Math.sin(angles[idx]),
    }
  }

  function toPath(values: (number | null)[]): string | null {
    if (values.some((v) => v == null)) return null
    const pts = (values as number[]).map((v, i) => point(v, i))
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
        const vals = [rating.appearance_score, rating.practicality_score, rating.value_score]
        const d = toPath(vals)
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
              (vals as number[]).map((v, i) => {
                const p = point(v, i)
                return <circle key={i} cx={p.x} cy={p.y} r="3" fill={color} />
              })}
          </g>
        )
      })}

      {/* 维度标签 */}
      {DIMS.map((dim, i) => {
        const lx = cx + labelOffset * Math.cos(angles[i])
        const ly = cy + labelOffset * Math.sin(angles[i])
        return (
          <text
            key={dim.key}
            x={lx.toFixed(1)}
            y={ly.toFixed(1)}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize="11"
            className="fill-muted-foreground"
            fontWeight="500"
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
  onRate,
}: MultiDimRatingProps) {
  const [scores, setScores] = useState<DimScores>({ ...myScores })
  const [saving, setSaving] = useState(false)

  async function handleDimChange(key: DimKey, val: number) {
    if (!author || saving) return
    updatePresenceActivity('正在打分')
    const newScores = { ...scores, [key]: val }
    setScores(newScores)

    const { appearance_score, practicality_score, value_score } = newScores
    if (appearance_score == null || practicality_score == null || value_score == null) return

    setSaving(true)
    try {
      const res = await fetch('/api/ratings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item_id: itemId,
          author,
          appearance_score,
          practicality_score,
          value_score,
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

  const allFilled =
    scores.appearance_score != null &&
    scores.practicality_score != null &&
    scores.value_score != null

  // 合并本地状态到 allRatings
  const displayRatings: RatingData[] = allRatings.map((r) =>
    r.author === author ? { ...r, ...scores } : r
  )
  const hasMyRating = allRatings.some((r) => r.author === author)
  if (!hasMyRating && author && allFilled) {
    displayRatings.push({ author, score: null, ...scores })
  }

  // ── 构建雷达图数据：Arthur / Grace / 加权均值 ──────────────────────────────
  const arthurEntry = displayRatings.find((r) => r.author === 'Arthur')
  const graceEntry = displayRatings.find((r) => r.author === 'Grace')
  const weightedAvg = computeWeightedAvg(displayRatings)

  const radarEntries: RadarEntry[] = []
  if (arthurEntry) radarEntries.push({ rating: arthurEntry, color: AUTHOR_COLORS.Arthur, label: 'Arthur' })
  if (graceEntry) radarEntries.push({ rating: graceEntry, color: AUTHOR_COLORS.Grace, label: 'Grace' })
  if (weightedAvg) radarEntries.push({ rating: weightedAvg, color: AVG_COLOR, label: '加权均值', dashed: true })

  const hasRadarData = radarEntries.some(
    (e) =>
      e.rating.appearance_score != null &&
      e.rating.practicality_score != null &&
      e.rating.value_score != null
  )

  // 加权均值分（用于图例展示）
  function avgScore(r: RatingData) {
    if (r.appearance_score == null || r.practicality_score == null || r.value_score == null)
      return null
    return ((r.appearance_score + r.practicality_score + r.value_score) / 3).toFixed(1)
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
          {DIMS.map((dim) => (
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
          <p className="text-[10px] text-muted-foreground/40 mt-3 italic text-right">完成三项评分后自动保存</p>
        )}
      </div>

      {/* 雷达图 */}
      {hasRadarData && (
        <div className="pt-2">
          {/* 图例 */}
          <div className="flex flex-wrap items-center justify-center gap-4 mb-4">
            {radarEntries.map((e) => {
              const avg = avgScore(e.rating)
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
          <RadarChart entries={radarEntries} />
        </div>
      )}
    </div>
  )
}
