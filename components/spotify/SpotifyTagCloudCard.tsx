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

function getTagSignature(tagName: string) {
  let hash = 0

  for (const character of tagName) {
    hash = (hash * 33 + character.charCodeAt(0)) % 9973
  }

  return {
    angle: ((hash % 5) - 2) * 6,
    offsetY: ((Math.floor(hash / 5) % 5) - 2) * 3,
    hue: 144 + (hash % 42),
  }
}

export default function SpotifyTagCloudCard({ analysis }: { analysis: SpotifyTagAnalysis }) {
  const [section, setSection] = useState<SpotifyTagSection>('long_term')
  const result = analysis[section]
  const tags = result.topTags

  const counts = tags.map((t) => t.totalCount)
  const min = Math.min(...counts, 0)
  const max = Math.max(...counts, 1)

  return (
    <section className="relative h-full overflow-hidden rounded-[30px] border border-emerald-400/20 bg-[linear-gradient(160deg,#06110d_0%,#0d1b16_45%,#040706_100%)] p-5 text-slate-100 shadow-[0_28px_80px_rgba(3,14,11,0.52)] sm:p-6">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_16%,rgba(52,211,153,0.22),transparent_28%),radial-gradient(circle_at_82%_18%,rgba(45,212,191,0.18),transparent_24%),radial-gradient(circle_at_50%_84%,rgba(255,255,255,0.06),transparent_30%)]" />
      <div className="pointer-events-none absolute inset-x-[16%] top-[18%] h-40 rounded-full bg-emerald-300/10 blur-3xl" />

      <div className="relative flex items-start justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.26em] text-emerald-100/65">Tag Cloud</p>
          <h3 className="mt-2 text-2xl font-semibold tracking-tight text-white">音乐标签画像</h3>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-emerald-50/68">
            借用 wordle 式暗底排版与发光字重，字号映射热度，hover 强调当前标签。
          </p>
        </div>

        <div className="rounded-full border border-white/10 bg-white/6 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-emerald-100/70">
          {tags.length} Tags
        </div>
      </div>

      <div className="relative mt-5 flex flex-wrap gap-2">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setSection(s.id)}
            className={[
              'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
              section === s.id
                ? 'border-emerald-300/45 bg-emerald-300/16 text-emerald-50 shadow-[0_0_0_1px_rgba(255,255,255,0.05)]'
                : 'border-white/8 bg-white/6 text-emerald-50/72 hover:border-emerald-200/20 hover:bg-white/10 hover:text-white',
            ].join(' ')}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="relative mt-6 overflow-hidden rounded-[28px] border border-white/8 bg-[radial-gradient(circle_at_center,rgba(30,41,34,0.86),rgba(8,14,12,0.98))] px-4 py-8 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_18px_48px_rgba(0,0,0,0.32)] sm:px-6">
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-52 w-52 -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-emerald-200/10" />
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-300/8 blur-3xl" />

        <div className="relative flex min-h-[260px] flex-wrap items-center justify-center gap-x-3 gap-y-3 sm:min-h-[320px]">
          {tags.length === 0 ? (
            <p className="text-sm text-emerald-50/62">暂无标签数据</p>
          ) : (
            tags.map((tagEntry) => {
              const fontSize = scaleFont(tagEntry.totalCount, min, max)
              const opacity = scaleOpacity(tagEntry.totalCount, min, max)
              const signature = getTagSignature(tagEntry.name)
              const colorLightness = 68 + Math.round(((fontSize - 11) / 20) * 14)

              return (
                <span
                  key={tagEntry.name}
                  title={`${tagEntry.name} · ${tagEntry.trackCount} 首 · 累计热度 ${tagEntry.totalCount}`}
                  style={{
                    fontSize: `${fontSize}px`,
                    opacity,
                    color: `hsl(${signature.hue} 70% ${colorLightness}%)`,
                    textShadow: '-1px -1px 0 rgba(0, 0, 0, 0.9), 1px 1px 0 rgba(240, 253, 250, 0.18)',
                    transform: `translateY(${signature.offsetY}px) rotate(${signature.angle}deg)`,
                  }}
                  className="cursor-default select-none rounded-sm border border-transparent px-2 py-1 font-medium transition duration-300 hover:-translate-y-1 hover:scale-105 hover:border-dashed hover:border-amber-200/70 hover:bg-white/6 hover:opacity-100"
                >
                  {tagEntry.name}
                </span>
              )
            })
          )}
        </div>
      </div>

      <p className="relative mt-4 text-center font-mono text-[11px] uppercase tracking-[0.2em] text-emerald-100/45">
        {SECTIONS.find((s) => s.id === section)?.sub} · {result.tracksWithTags} 首有标签数据
      </p>
    </section>
  )
}
