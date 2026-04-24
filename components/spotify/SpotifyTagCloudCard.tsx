'use client'

import { useState } from 'react'
import type { SpotifyTagAnalysis, SpotifyTagSection } from '@/lib/spotify-types'

const SECTIONS: { id: SpotifyTagSection; label: string; sub: string }[] = [
  { id: 'short_term',  label: '近期喜爱',  sub: '最近 4 周 Top Tracks' },
  { id: 'medium_term', label: '半年喜爱',  sub: '近 6 个月 Top Tracks' },
  { id: 'long_term',   label: '长期喜爱',  sub: '所有时间 Top Tracks' },
  { id: 'saved',       label: '点赞歌曲',  sub: '已收藏曲目' },
  { id: 'recent',      label: '最近收听',  sub: '近期播放记录' },
]

function scaleFont(count: number, min: number, max: number): number {
  if (max === min) return 16
  const normalized = (count - min) / (max - min)
  return Math.round(11 + normalized * 20)
}

function scaleOpacity(count: number, min: number, max: number): number {
  if (max === min) return 0.85
  const normalized = (count - min) / (max - min)
  return 0.45 + normalized * 0.55
}

export default function SpotifyTagCloudCard({ analysis }: { analysis: SpotifyTagAnalysis }) {
  const [section, setSection] = useState<SpotifyTagSection>('long_term')
  const result = analysis[section]
  const tags = result.topTags

  const counts = tags.map((t) => t.totalCount)
  const min = Math.min(...counts, 0)
  const max = Math.max(...counts, 1)

  return (
    <section className="rounded-[28px] border border-border/60 bg-card/95 p-4 sm:p-6 shadow-[0_18px_60px_rgba(0,0,0,0.05)]">
      <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Tag Cloud</p>
      <h3 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">音乐标签画像</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        基于 Last.fm 标签聚合，字号反映该标签在所选板块中的热度。
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

      {/* Cloud */}
      <div className="mt-6 min-h-[180px] flex flex-wrap gap-x-3 gap-y-2.5 justify-center items-center">
        {tags.length === 0 ? (
          <p className="text-sm text-muted-foreground">暂无标签数据</p>
        ) : (
          tags.map((tag) => {
            const fontSize = scaleFont(tag.totalCount, min, max)
            const opacity = scaleOpacity(tag.totalCount, min, max)
            return (
              <span
                key={tag.name}
                title={`${tag.name} · ${tag.trackCount} 首 · 累计热度 ${tag.totalCount}`}
                style={{ fontSize: `${fontSize}px`, opacity }}
                className="cursor-default font-medium text-foreground transition-opacity hover:opacity-100 hover:text-emerald-500 select-none"
              >
                {tag.name}
              </span>
            )
          })
        )}
      </div>

      {/* Footer */}
      <p className="mt-4 text-[11px] text-muted-foreground/60 text-center">
        {SECTIONS.find((s) => s.id === section)?.sub} · {result.tracksWithTags} 首有标签数据
      </p>
    </section>
  )
}
