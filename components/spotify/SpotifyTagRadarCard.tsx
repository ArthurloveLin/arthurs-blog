'use client'

import { useState } from 'react'
import type { SpotifyTagAnalysis, SpotifyTagSection, TagRadarAxis } from '@/lib/spotify-types'

const SECTIONS: { id: SpotifyTagSection; label: string; sub: string }[] = [
  { id: 'short_term',  label: '近期喜爱',  sub: '最近 4 周 Top Tracks' },
  { id: 'medium_term', label: '半年喜爱',  sub: '近 6 个月 Top Tracks' },
  { id: 'long_term',   label: '长期喜爱',  sub: '所有时间 Top Tracks' },
  { id: 'saved',       label: '点赞歌曲',  sub: '已收藏曲目' },
  { id: 'recent',      label: '最近收听',  sub: '近期播放记录' },
]

const SIZE = 280
const CENTER = SIZE / 2
const RADIUS = 108
const RINGS = [0.25, 0.5, 0.75, 1]

function polarToCart(angleDeg: number, r: number): [number, number] {
  const rad = ((angleDeg - 90) * Math.PI) / 180
  return [CENTER + r * Math.cos(rad), CENTER + r * Math.sin(rad)]
}

function buildPolygon(axes: TagRadarAxis[]): string {
  return axes
    .map((axis, i) => {
      const angle = (360 / axes.length) * i
      const r = (axis.score / 100) * RADIUS
      const [x, y] = polarToCart(angle, r)
      return `${x},${y}`
    })
    .join(' ')
}

function RadarChart({ axes }: { axes: TagRadarAxis[] }) {
  const n = axes.length
  if (n === 0) return null

  return (
    <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="w-full max-w-[300px] mx-auto">
      {/* Reference rings */}
      {RINGS.map((ratio) => {
        const pts = Array.from({ length: n }, (_, i) => {
          const angle = (360 / n) * i
          const [x, y] = polarToCart(angle, RADIUS * ratio)
          return `${x},${y}`
        }).join(' ')
        return (
          <polygon
            key={ratio}
            points={pts}
            fill="none"
            stroke="currentColor"
            strokeWidth="0.5"
            className="text-border/50"
          />
        )
      })}

      {/* Axis lines */}
      {axes.map((_, i) => {
        const angle = (360 / n) * i
        const [x, y] = polarToCart(angle, RADIUS)
        return (
          <line
            key={i}
            x1={CENTER} y1={CENTER}
            x2={x} y2={y}
            stroke="currentColor"
            strokeWidth="0.5"
            className="text-border/50"
          />
        )
      })}

      {/* Data polygon */}
      <polygon
        points={buildPolygon(axes)}
        fill="rgba(16,185,129,0.18)"
        stroke="rgba(16,185,129,0.7)"
        strokeWidth="1.5"
        strokeLinejoin="round"
        className="transition-all duration-500"
      />

      {/* Data dots */}
      {axes.map((axis, i) => {
        const angle = (360 / n) * i
        const r = (axis.score / 100) * RADIUS
        const [x, y] = polarToCart(angle, r)
        return (
          <circle key={i} cx={x} cy={y} r="3" fill="rgba(16,185,129,0.9)" />
        )
      })}

      {/* Axis labels */}
      {axes.map((axis, i) => {
        const angle = (360 / n) * i
        const [x, y] = polarToCart(angle, RADIUS + 22)
        const textAnchor = x < CENTER - 4 ? 'end' : x > CENTER + 4 ? 'start' : 'middle'
        return (
          <text
            key={i}
            x={x} y={y}
            textAnchor={textAnchor}
            dominantBaseline="middle"
            fontSize="9"
            fill="currentColor"
            className="text-muted-foreground/80 font-mono"
          >
            {axis.label}
          </text>
        )
      })}
    </svg>
  )
}

export default function SpotifyTagRadarCard({ analysis }: { analysis: SpotifyTagAnalysis }) {
  const [section, setSection] = useState<SpotifyTagSection>('long_term')
  const result = analysis[section]

  return (
    <section className="rounded-[28px] border border-border/60 bg-card/95 p-4 sm:p-6 shadow-[0_18px_60px_rgba(0,0,0,0.05)]">
      <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Radar Chart</p>
      <h3 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">音乐风格雷达</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        将 Last.fm 标签按 8 大流派聚类，展示所选板块的风格分布。
      </p>

      {/* Section Tabs */}
      <div className="mt-5 flex flex-wrap gap-2">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setSection(s.id)}
            className={[
              'rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
              section === s.id
                ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-500/30'
                : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground',
            ].join(' ')}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Chart */}
      <div className="mt-6">
        {result.tracksWithTags === 0 ? (
          <div className="flex items-center justify-center min-h-[200px] text-sm text-muted-foreground">
            暂无标签数据
          </div>
        ) : (
          <RadarChart axes={result.radarAxes} />
        )}
      </div>

      {/* Legend */}
      <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-x-3 gap-y-1.5">
        {result.radarAxes.map((axis) => (
          <div key={axis.label} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span
              className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500/70 shrink-0"
              style={{ opacity: 0.4 + (axis.score / 100) * 0.6 }}
            />
            <span className="truncate">{axis.label}</span>
            <span className="ml-auto tabular-nums text-foreground/50">{axis.score}</span>
          </div>
        ))}
      </div>

      <p className="mt-4 text-[11px] text-muted-foreground/60 text-center">
        {SECTIONS.find((s) => s.id === section)?.sub} · {result.tracksWithTags} 首有标签数据
      </p>
    </section>
  )
}
