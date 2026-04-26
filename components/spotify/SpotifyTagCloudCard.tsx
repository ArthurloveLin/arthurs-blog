'use client'

import { useState, useEffect, useRef } from 'react'
import type { SpotifySectionCopy } from '@/lib/spotify-page-copy'
import type { SpotifyTagAnalysis, SpotifyTagSection } from '@/lib/spotify-types'

const SECTIONS: { id: SpotifyTagSection; label: string; sub: string }[] = [
  { id: 'short_term',  label: '近期喜爱',  sub: '最近 4 周 Top Tracks' },
  { id: 'medium_term', label: '半年喜爱',  sub: '近 6 个月 Top Tracks' },
  { id: 'long_term',   label: '长期喜爱',  sub: '所有时间 Top Tracks' },
  { id: 'saved',       label: '点赞歌曲',  sub: '已收藏曲目' },
  { id: 'recent',      label: '最近收听',  sub: '近期播放记录' },
]

// ─── Geometry (ported from WORDLEJS.Rectangle) ───────────────────────────────

interface Rect {
  x: number
  y: number
  width: number
  height: number
}

function intersects(a: Rect, b: Rect): boolean {
  return !(
    b.x > a.x + a.width  ||
    b.x + b.width  < a.x ||
    b.y > a.y + a.height ||
    b.y + b.height < a.y
  )
}

// ─── Random utils (ported from CodePen Random) ───────────────────────────────

function randomInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1))
}

function randomColor(): string {
  const ch = () => randomInt(0x44, 0xff).toString(16).padStart(2, '0')
  return `#${ch()}${ch()}${ch()}`
}

// ─── Wordle layout (ported from WORDLEJS.Wordle.doLayout / layoutNextWord) ───

const BIGGEST_SIZE  = 46
const SMALLEST_SIZE = 14
const D_RADIUS      = 6
const D_DEG         = 10

interface WordInput {
  text:   string
  weight: number
  title:  string
}

interface PlacedWord {
  text:       string
  renderX:    number   // left  value for CSS (container-relative)
  renderY:    number   // top   value for CSS (container-relative)
  fontSize:   number
  color:      string
  fontFamily: string
  rotated:    boolean
  opacity:    number
  title:      string
}

/**
 * Compute the wordle spiral layout.
 * All intermediate bounds are kept in "wordle space" (origin = container centre),
 * matching the CodePen's coordinate model exactly.
 */
function computeLayout(
  inputWords: WordInput[],
  containerW: number,
  containerH: number,
): PlacedWord[] {
  if (inputWords.length === 0) return []

  // Sort biggest → smallest (same as CodePen demo default)
  const sorted = [...inputWords].sort((a, b) => b.weight - a.weight)

  let high = -Infinity, low = Infinity
  for (const w of sorted) {
    if (w.weight > high) high = w.weight
    if (w.weight < low)  low  = w.weight
  }

  // Build per-word data (canvas measureText, random attrs)
  const canvas = document.createElement('canvas')
  const ctx    = canvas.getContext('2d')!

  interface WordData {
    text:       string
    weight:     number
    title:      string
    fontSize:   number
    fontFamily: string
    rotated:    boolean
    color:      string
    opacity:    number
    bounds:     Rect   // in wordle space; x/y = top-left relative to origin
  }

  const words: WordData[] = sorted.map(w => {
    const fontSize = high === low
      ? (BIGGEST_SIZE + SMALLEST_SIZE) / 2
      : (w.weight - low) / (high - low) * (BIGGEST_SIZE - SMALLEST_SIZE) + SMALLEST_SIZE

    const rotated    = Math.random() >= 0.5
    const fontFamily = Math.random() >= 0.5 ? 'sans-serif' : 'serif'
    const color      = randomColor()
    const opacity    = high === low ? 0.85 : 0.45 + ((w.weight - low) / (high - low)) * 0.55

    ctx.font = `${fontSize}px ${fontFamily}`
    const tw = ctx.measureText(w.text).width

    // Bounds width/height swap when rotated (same as CodePen Word.calculate)
    const bw = rotated ? fontSize : tw
    const bh = rotated ? tw       : fontSize

    return {
      text: w.text, weight: w.weight, title: w.title,
      fontSize, fontFamily, rotated, color, opacity,
      bounds: { x: -bw / 2, y: -bh / 2, width: bw, height: bh },
    }
  })

  // Container centre offset for final rendering
  const ox = containerW / 2
  const oy = containerH / 2

  // Placed bounds (in wordle space) for collision detection
  const placed: Rect[]       = []
  const result: PlacedWord[] = []

  for (let i = 0; i < words.length; i++) {
    const word = words[i]

    // ── First word: centre at origin ──────────────────────────────────────
    if (i === 0) {
      placed.push({ ...word.bounds })
      result.push(makeEntry(word, word.bounds, ox, oy))
      continue
    }

    // ── Subsequent words: spiral out from weighted mass centre ─────────────

    // Weighted mass centre of all placed words (in wordle space)
    let massCx = 0, massCy = 0, totalW = 0
    for (let j = 0; j < i; j++) {
      const pb = placed[j]
      massCx += (pb.x + pb.width  / 2) * words[j].weight
      massCy += (pb.y + pb.height / 2) * words[j].weight
      totalW += words[j].weight
    }
    massCx /= totalW
    massCy /= totalW

    // Starting radius (CodePen: half the smallest dimension of the first word)
    const firstBounds = placed[0]
    let radius     = 0.5 * Math.min(firstBounds.width, firstBounds.height)
    let done       = false
    let guardLoop  = 0

    while (!done) {
      if (++guardLoop > 100_000) break

      const startDeg = Math.floor(Math.random() * 360)
      let prevX = -1, prevY = -1

      // Sweep 360° in steps of D_DEG — CodePen uses rad = deg / π * 180
      // (effectively deg * 57.3), which causes angles to cycle non-sequentially.
      // Kept verbatim for faithfulness.
      for (let deg = startDeg; deg < startDeg + 360; deg += D_DEG) {
        const rad = deg / Math.PI * 180.0
        const tx  = Math.floor(massCx + radius * Math.cos(rad))
        const ty  = Math.floor(massCy + radius * Math.sin(rad))

        if (tx === prevX && ty === prevY) continue
        prevX = tx; prevY = ty

        const candidate: Rect = {
          x:      word.bounds.x + tx,
          y:      word.bounds.y + ty,
          width:  word.bounds.width,
          height: word.bounds.height,
        }

        let collision = false
        for (let j = 0; j < i; j++) {
          if (intersects(candidate, placed[j])) { collision = true; break }
        }

        if (!collision) {
          placed.push(candidate)
          result.push(makeEntry(word, candidate, ox, oy))
          done = true
          break
        }
      }

      radius += D_RADIUS
    }
  }

  return result
}

/**
 * Convert wordle-space bounds to a PlacedWord with CSS left/top values.
 * Rotated words need the same position correction as CodePen (Word.renderText).
 */
function makeEntry(
  word: { text: string; fontSize: number; color: string; fontFamily: string;
          rotated: boolean; opacity: number; title: string },
  bounds: Rect,
  ox: number,
  oy: number,
): PlacedWord {
  let rx = bounds.x + ox
  let ry = bounds.y + oy
  if (word.rotated) {
    // CodePen: adjust so CSS rotate(90deg) lands on the collision rectangle
    rx = rx - bounds.height / 2 + bounds.width / 2
    ry = ry + bounds.height / 2 - bounds.width / 2
  }
  return {
    text: word.text, fontSize: word.fontSize, color: word.color,
    fontFamily: word.fontFamily, rotated: word.rotated,
    opacity: word.opacity, title: word.title,
    renderX: rx, renderY: ry,
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SpotifyTagCloudCard({
  analysis,
  copy,
}: {
  analysis: SpotifyTagAnalysis
  copy: SpotifySectionCopy
}) {
  const [section, setSection]           = useState<SpotifyTagSection>('long_term')
  const [displayedWords, setDisplayed]  = useState<PlacedWord[]>([])
  const containerRef                    = useRef<HTMLDivElement>(null)
  const rafRef                          = useRef<number | null>(null)
  const layoutIdRef                     = useRef(0)

  const result = analysis[section]
  const tags   = result.topTags

  // Re-run layout whenever tags change (section switch)
  useEffect(() => {
    if (!containerRef.current) return

    const containerW = containerRef.current.clientWidth
    const containerH = containerRef.current.clientHeight
    if (containerW === 0 || containerH === 0) return

    const inputWords: WordInput[] = tags.map(t => ({
      text:   t.name,
      weight: t.totalCount,
      title:  `${t.name} · ${t.trackCount} 首 · 累计热度 ${t.totalCount}`,
    }))

    const allWords = computeLayout(inputWords, containerW, containerH)

    // Cancel any in-flight animation
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    const myId = ++layoutIdRef.current

    setDisplayed([])

    let idx = 0
    const step = () => {
      if (myId !== layoutIdRef.current) return   // superseded layout
      if (idx >= allWords.length) return

      const word = allWords[idx++]
      setDisplayed(prev => [...prev, word])
      rafRef.current = requestAnimationFrame(step)
    }
    rafRef.current = requestAnimationFrame(step)

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [tags])

  return (
    <section className="relative flex h-full flex-col overflow-hidden rounded-[30px] border border-emerald-400/20 bg-[linear-gradient(160deg,#06110d_0%,#0d1b16_45%,#040706_100%)] p-5 text-slate-100 shadow-[0_28px_80px_rgba(3,14,11,0.52)] sm:p-6">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_16%,rgba(52,211,153,0.22),transparent_28%),radial-gradient(circle_at_82%_18%,rgba(45,212,191,0.18),transparent_24%),radial-gradient(circle_at_50%_84%,rgba(255,255,255,0.06),transparent_30%)]" />
      <div className="pointer-events-none absolute inset-x-[16%] top-[18%] h-40 rounded-full bg-emerald-300/10 blur-3xl" />

      <div className="relative flex items-start justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.26em] text-emerald-100/65">{copy.eyebrow}</p>
          <h3 className="mt-2 text-2xl font-semibold tracking-tight text-white">{copy.title}</h3>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-emerald-50/68">
            {copy.description}
          </p>
        </div>

        <div className="rounded-full border border-white/10 bg-white/6 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-emerald-100/70">
          {tags.length} Tags
        </div>
      </div>

      {/* Section tabs */}
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

      {/* Wordle canvas area */}
      <div className="relative mt-6 flex flex-1 overflow-hidden rounded-[28px] border border-white/8 bg-[radial-gradient(circle_at_center,rgba(30,41,34,0.86),rgba(8,14,12,0.98))] shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_18px_48px_rgba(0,0,0,0.32)]">
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-52 w-52 -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-emerald-200/10" />
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-300/8 blur-3xl" />

        <div
          ref={containerRef}
          className="relative min-h-[460px] w-full overflow-hidden"
        >
          {tags.length === 0 ? (
            <p className="absolute inset-0 flex items-center justify-center text-sm text-emerald-50/62">
              暂无标签数据
            </p>
          ) : (
            displayedWords.map((word, i) => (
              <span
                key={`${word.text}-${i}`}
                title={word.title}
                style={{
                  position:   'absolute',
                  left:       `${word.renderX}px`,
                  top:        `${word.renderY}px`,
                  fontSize:   `${word.fontSize}px`,
                  lineHeight: `${word.fontSize}px`,
                  fontFamily: word.fontFamily,
                  color:      word.color,
                  opacity:    word.opacity,
                  textShadow: '-1px -1px 0 #000, 1px 1px 0 #555',
                  whiteSpace: 'nowrap',
                  border:     '1px solid transparent',
                  transform:  word.rotated ? 'rotate(90deg)' : undefined,
                  cursor:     'default',
                  userSelect: 'none',
                }}
                onMouseEnter={e => {
                  const el = e.currentTarget as HTMLElement
                  el.style.border = '1px dashed #ffff00'
                }}
                onMouseLeave={e => {
                  const el = e.currentTarget as HTMLElement
                  el.style.border = '1px solid transparent'
                }}
              >
                {word.text}
              </span>
            ))
          )}
        </div>
      </div>

      <p className="relative mt-4 text-center font-mono text-[11px] uppercase tracking-[0.2em] text-emerald-100/45">
        {SECTIONS.find((s) => s.id === section)?.sub} · {result.tracksWithTags} 首有标签数据
      </p>
    </section>
  )
}
