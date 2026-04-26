'use client'

import { useId, useState } from 'react'

import type { SpotifySectionCopy } from '@/lib/spotify-page-copy'
import type { SpotifyTagAnalysis, SpotifyTagSection, TagRadarAxis } from '@/lib/spotify-types'

const SECTIONS: { id: SpotifyTagSection; label: string; sub: string }[] = [
  { id: 'short_term', label: '近期喜爱', sub: '最近 4 周 Top Tracks' },
  { id: 'medium_term', label: '半年喜爱', sub: '近 6 个月 Top Tracks' },
  { id: 'long_term', label: '长期喜爱', sub: '所有时间 Top Tracks' },
  { id: 'saved', label: '点赞歌曲', sub: '已收藏曲目' },
  { id: 'recent', label: '最近收听', sub: '近期播放记录' },
]

const VIEW_SIZE = 340
const CENTER = VIEW_SIZE / 2
const RADIUS = 96
const LABEL_RADIUS = 122
const RINGS = [0.25, 0.5, 0.75, 1]

function polarToCart(angleDeg: number, r: number): [number, number] {
  const rad = ((angleDeg - 90) * Math.PI) / 180
  return [CENTER + r * Math.cos(rad), CENTER + r * Math.sin(rad)]
}

function buildPolygon(axes: TagRadarAxis[]): string {
  return axes
    .map((axis, index) => {
      const angle = (360 / axes.length) * index
      const r = (axis.score / 100) * RADIUS
      const [x, y] = polarToCart(angle, r)
      return `${x},${y}`
    })
    .join(' ')
}

function splitAxisLabel(label: string) {
  const trimmed = label.trim()

  if (trimmed.length <= 6) {
    return [trimmed]
  }

  if (trimmed.includes(' ')) {
    const words = trimmed.split(/\s+/)
    const lines: string[] = []
    let current = ''

    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word
      if (candidate.length <= 8) {
        current = candidate
        continue
      }

      if (current) {
        lines.push(current)
      }

      current = word

      if (lines.length === 1) {
        break
      }
    }

    if (current) {
      lines.push(current)
    }

    return lines.slice(0, 2).map((line, index, arr) => {
      if (index === arr.length - 1 && arr.length === 2 && words.join(' ').length > arr.join(' ').length) {
        return `${line.slice(0, 7)}…`
      }
      return line
    })
  }

  if (trimmed.length <= 10) {
    return [trimmed.slice(0, Math.ceil(trimmed.length / 2)), trimmed.slice(Math.ceil(trimmed.length / 2))]
  }

  return [trimmed.slice(0, 6), `${trimmed.slice(6, 11)}…`]
}

function RadarChart({
  axes,
  hoveredAxis,
  onHoverAxis,
}: {
  axes: TagRadarAxis[]
  hoveredAxis: string | null
  onHoverAxis: (label: string | null) => void
}) {
  const count = axes.length
  const gradientId = useId().replace(/:/g, '')
  const shadowId = useId().replace(/:/g, '')

  if (count === 0) {
    return null
  }

  return (
    <svg viewBox={`0 0 ${VIEW_SIZE} ${VIEW_SIZE}`} className="mx-auto w-full max-w-[360px]">
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fb7185" stopOpacity="0.88" />
          <stop offset="100%" stopColor="#818cf8" stopOpacity="0.8" />
        </linearGradient>
        <filter id={shadowId} x="-40%" y="-40%" width="180%" height="180%">
          <feDropShadow dx="0" dy="18" stdDeviation="14" floodColor="#8b5cf6" floodOpacity="0.24" />
        </filter>
      </defs>

      {RINGS.map((ratio) => {
        const points = Array.from({ length: count }, (_, index) => {
          const angle = (360 / count) * index
          const [x, y] = polarToCart(angle, RADIUS * ratio)
          return `${x},${y}`
        }).join(' ')

        return (
          <polygon
            key={ratio}
            points={points}
            fill={ratio === 1 ? 'rgba(244, 114, 182, 0.04)' : 'none'}
            stroke="rgba(148, 163, 184, 0.32)"
            strokeWidth="0.9"
          />
        )
      })}

      {axes.map((_, index) => {
        const angle = (360 / count) * index
        const [x, y] = polarToCart(angle, RADIUS)

        return (
          <line
            key={index}
            x1={CENTER}
            y1={CENTER}
            x2={x}
            y2={y}
            stroke="rgba(148, 163, 184, 0.26)"
            strokeWidth="0.9"
          />
        )
      })}

      <polygon
        points={buildPolygon(axes)}
        fill={`url(#${gradientId})`}
        fillOpacity="0.88"
        filter={`url(#${shadowId})`}
        stroke="rgba(255,255,255,0.72)"
        strokeWidth="1.25"
        strokeLinejoin="round"
        className="transition-all duration-500"
      />
      <polygon
        points={buildPolygon(axes)}
        fill="none"
        stroke="rgba(236,72,153,0.55)"
        strokeWidth="2.1"
        strokeLinejoin="round"
      />

      {axes.map((axis, index) => {
        const angle = (360 / count) * index
        const r = (axis.score / 100) * RADIUS
        const [x, y] = polarToCart(angle, r)
        const isActive = hoveredAxis === axis.label

        return (
          <circle
            key={axis.label}
            cx={x}
            cy={y}
            r={isActive ? '6' : '4.2'}
            fill={isActive ? '#ffffff' : 'rgba(255,255,255,0.82)'}
            stroke={isActive ? 'rgba(236,72,153,0.95)' : 'rgba(236,72,153,0.65)'}
            strokeWidth={isActive ? '3' : '2'}
            className="cursor-pointer transition-all duration-200"
            onMouseEnter={() => onHoverAxis(axis.label)}
            onMouseLeave={() => onHoverAxis(null)}
          />
        )
      })}

      {axes.map((axis, index) => {
        const angle = (360 / count) * index
        const [x, y] = polarToCart(angle, LABEL_RADIUS)
        const textAnchor = x < CENTER - 6 ? 'end' : x > CENTER + 6 ? 'start' : 'middle'
        const isActive = hoveredAxis === axis.label
        const lines = splitAxisLabel(axis.label)

        return (
          <text
            key={`${axis.label}-label`}
            x={x}
            y={y}
            textAnchor={textAnchor}
            dominantBaseline="middle"
            fontSize={isActive ? '10' : '8.8'}
            fill={isActive ? 'rgba(15,23,42,0.95)' : 'rgba(71,85,105,0.85)'}
            className="font-mono transition-all duration-200"
            onMouseEnter={() => onHoverAxis(axis.label)}
            onMouseLeave={() => onHoverAxis(null)}
          >
            {lines.map((line, lineIndex) => (
              <tspan
                key={`${axis.label}-${lineIndex}`}
                x={x}
                dy={lineIndex === 0 ? `${-(lines.length - 1) * 0.55}em` : '1.08em'}
              >
                {line}
              </tspan>
            ))}
          </text>
        )
      })}
    </svg>
  )
}

export default function SpotifyTagRadarCard({
  analysis,
  copy,
}: {
  analysis: SpotifyTagAnalysis
  copy: SpotifySectionCopy
}) {
  const [section, setSection] = useState<SpotifyTagSection>('long_term')
  const [hoveredAxis, setHoveredAxis] = useState<string | null>(null)
  const result = analysis[section]
  const activeAxis = result.radarAxes.find((axis) => axis.label === hoveredAxis) ?? result.radarAxes[0] ?? null

  return (
    <section className="relative h-full overflow-hidden rounded-[30px] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(244,247,251,0.94))] p-5 shadow-[0_22px_70px_rgba(15,23,42,0.08)] sm:p-6 dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(20,23,30,0.98),rgba(12,16,22,0.98))]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(129,140,248,0.12),transparent_28%),radial-gradient(circle_at_top_left,rgba(244,114,182,0.12),transparent_24%)]" />

      <div className="relative flex h-full flex-col gap-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.26em] text-slate-500 dark:text-slate-400">{copy.eyebrow}</p>
            <h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 dark:text-slate-50">{copy.title}</h3>
            <p className="mt-2 hidden max-w-xl text-sm leading-relaxed text-slate-500 dark:text-slate-400 sm:block">
              {copy.description}
            </p>
          </div>

          <div className="shrink-0 rounded-[20px] border border-slate-200/80 bg-white/85 px-2.5 py-2 text-right shadow-[0_12px_32px_rgba(15,23,42,0.06)] dark:border-white/8 dark:bg-white/6 sm:rounded-[24px] sm:px-3 sm:py-3">
            <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-slate-400 sm:text-[10px]">Focus</div>
            <div className="mt-0.5 text-xs font-semibold text-slate-900 dark:text-slate-100 sm:mt-1 sm:text-sm">{activeAxis?.label ?? '暂无数据'}</div>
            <div className="mt-0 text-[10px] text-slate-500 dark:text-slate-400 sm:mt-0.5 sm:text-[11px]">{activeAxis ? `${activeAxis.trackCount} 首` : 'No signal'}</div>
          </div>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400 sm:hidden">
          {copy.description}
        </p>

        <div className="flex flex-wrap gap-2">
          {SECTIONS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setSection(item.id)}
              className={[
                'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                section === item.id
                  ? 'border-pink-300/70 bg-pink-100 text-pink-700 shadow-sm dark:border-pink-400/40 dark:bg-pink-500/12 dark:text-pink-200'
                  : 'border-slate-200 bg-slate-100/80 text-slate-500 hover:border-slate-300 hover:bg-slate-100 hover:text-slate-800 dark:border-white/8 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white',
              ].join(' ')}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="rounded-[28px] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(247,248,251,0.96),rgba(237,242,247,0.92))] px-2 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] dark:border-white/8 dark:bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] sm:px-4 sm:py-5">
          {result.tracksWithTags === 0 ? (
            <div className="flex min-h-[320px] items-center justify-center text-sm text-slate-500 dark:text-slate-400">
              暂无标签数据
            </div>
          ) : (
            <RadarChart
              axes={result.radarAxes}
              hoveredAxis={hoveredAxis}
              onHoverAxis={setHoveredAxis}
            />
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {result.radarAxes.map((axis) => {
            const isActive = hoveredAxis === axis.label

            return (
              <button
                key={axis.label}
                type="button"
                onMouseEnter={() => setHoveredAxis(axis.label)}
                onMouseLeave={() => setHoveredAxis(null)}
                onFocus={() => setHoveredAxis(axis.label)}
                onBlur={() => setHoveredAxis(null)}
                className={[
                  'rounded-2xl border px-3 py-2 text-left transition-all duration-200',
                  isActive
                    ? 'border-pink-200 bg-white shadow-[0_12px_24px_rgba(236,72,153,0.12)] dark:border-pink-400/30 dark:bg-white/8'
                    : 'border-slate-200/80 bg-white/65 hover:border-slate-300 hover:bg-white dark:border-white/8 dark:bg-white/5 dark:hover:bg-white/8',
                ].join(' ')}
              >
                <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                  <span
                    className="inline-block h-2 w-2 rounded-full"
                    style={{
                      background: 'linear-gradient(135deg, rgba(244,114,182,0.95), rgba(129,140,248,0.95))',
                      opacity: 0.45 + (axis.score / 100) * 0.55,
                    }}
                  />
                  <span className="truncate">{axis.label}</span>
                </div>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-lg font-semibold tabular-nums text-slate-900 dark:text-slate-100">{axis.trackCount}</span>
                  <span className="text-[11px] text-slate-400 dark:text-slate-500">首</span>
                </div>
              </button>
            )
          })}
        </div>

        <p className="text-center font-mono text-[11px] uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
          {SECTIONS.find((item) => item.id === section)?.sub} · {result.tracksWithTags} 首有标签数据
        </p>
      </div>
    </section>
  )
}
