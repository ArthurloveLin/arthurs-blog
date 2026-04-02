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

// SVG 雷达图组件
function RadarChart({ ratings }: { ratings: RatingData[] }) {
  const cx = 100
  const cy = 105
  const r = 65
  const n = 3
  // 角度：颜值在顶，实用右下，性价比左下
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
    return pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ') + ' Z'
  }

  const gridLevels = [1, 2, 3, 4, 5]
  const authorColors: Record<string, string> = {
    Arthur: '#f472b6',
    Grace: '#60a5fa',
  }
  const defaultColors = ['#a78bfa', '#fb923c']

  function getColor(author: string, idx: number) {
    return authorColors[author] ?? defaultColors[idx % defaultColors.length]
  }

  const labelOffset = r + 18

  return (
    <svg viewBox="0 0 200 210" className="w-full max-w-[220px] mx-auto">
      {/* 背景网格 */}
      {gridLevels.map((level) => {
        const pts = angles.map((_, i) => point(level, i))
        const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ') + ' Z'
        return (
          <path key={level} d={d} fill="none" stroke="#e5e7eb" strokeWidth="1" />
        )
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
            stroke="#e5e7eb"
            strokeWidth="1"
          />
        )
      })}

      {/* 各人数据多边形 */}
      {ratings.map((r, idx) => {
        const vals = [r.appearance_score, r.practicality_score, r.value_score]
        const d = toPath(vals)
        if (!d) return null
        const color = getColor(r.author, idx)
        return (
          <g key={r.author}>
            <path d={d} fill={color} fillOpacity="0.15" stroke={color} strokeWidth="2" strokeLinejoin="round" />
            {(vals as number[]).map((v, i) => {
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
            fill="#6b7280"
            fontWeight="500"
          >
            {dim.label}
          </text>
        )
      })}
    </svg>
  )
}

// 单维度星级选择器
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
      <span className="text-xs w-14 text-gray-500 shrink-0">{label}</span>
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            disabled={disabled}
            onClick={() => onChange(star)}
            onMouseEnter={() => setHover(star)}
            onMouseLeave={() => setHover(null)}
            className={`text-xl leading-none transition-colors disabled:cursor-not-allowed`}
            style={{ color: display >= star ? color : '#e5e7eb' }}
          >
            ★
          </button>
        ))}
      </div>
      {value !== null && (
        <span className="text-xs text-gray-400 w-6">{value}.0</span>
      )}
    </div>
  )
}

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

    // 三维都填好才保存
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
      // 回滚单个维度
      setScores((prev) => ({ ...prev, [key]: myScores[key] }))
    } finally {
      setSaving(false)
    }
  }

  const allFilled =
    scores.appearance_score != null &&
    scores.practicality_score != null &&
    scores.value_score != null

  // 合并 allRatings 中当前用户的最新分和本地状态
  const displayRatings: RatingData[] = allRatings.map((r) =>
    r.author === author ? { ...r, ...scores } : r
  )
  // 如果 allRatings 里没有当前用户（新用户还没存过），且已填好，加进去预览
  const hasMyRating = allRatings.some((r) => r.author === author)
  if (!hasMyRating && author && allFilled) {
    displayRatings.push({
      author,
      score: null,
      ...scores,
    })
  }

  return (
    <div className="space-y-4">
      {/* 我的多维打分 */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">我的评分</span>
          {saving && <span className="text-xs text-gray-400">保存中…</span>}
          {!author && (
            <span className="text-xs text-gray-400">请先选择身份再评分</span>
          )}
        </div>
        <div className="space-y-2">
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
          <p className="text-xs text-gray-400 mt-1">完成三项评分后自动保存</p>
        )}
      </div>

      {/* 雷达图 */}
      {displayRatings.some(
        (r) => r.appearance_score != null && r.practicality_score != null && r.value_score != null
      ) && (
        <div>
          <div className="flex items-center gap-3 mb-1">
            {displayRatings
              .filter(
                (r) =>
                  r.appearance_score != null &&
                  r.practicality_score != null &&
                  r.value_score != null
              )
              .map((r, idx) => {
                const authorColors: Record<string, string> = {
                  Arthur: '#f472b6',
                  Grace: '#60a5fa',
                }
                const defaultColors = ['#a78bfa', '#fb923c']
                const color = authorColors[r.author] ?? defaultColors[idx % defaultColors.length]
                const avg =
                  ((r.appearance_score! + r.practicality_score! + r.value_score!) / 3).toFixed(1)
                return (
                  <div key={r.author} className="flex items-center gap-1 text-xs">
                    <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: color }} />
                    <span className="text-gray-600">{r.author}</span>
                    <span className="text-gray-400">{avg}分</span>
                  </div>
                )
              })}
          </div>
          <RadarChart ratings={displayRatings} />
        </div>
      )}
    </div>
  )
}
