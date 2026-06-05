'use client'

import { useEffect, useState } from 'react'

/**
 * Album-cover color wash.
 *
 * Replaces the old `filter: blur(80px)` (perf) AND the "1px <img> → scale(3000)"
 * hack that succeeded it (commit a391404). That hack relied on the browser
 * collapsing the cover to a single averaged pixel before upscaling, which the
 * GPU compositor doesn't guarantee — depending on layer rasterization / DPR it
 * re-samples the full image into the scaled bounds, so the real cover leaks
 * through as a recognizable 底图.
 *
 * Instead we read the dominant colors ONCE on image load via a tiny canvas and
 * hand back a static CSS gradient. One-time cost, no <img> to leak, no runtime
 * blur — keeps the perf win that motivated removing the filter. The proxy
 * (img.arthurlovegrace.top) sends `access-control-allow-origin: *`, so the
 * crossOrigin canvas read isn't tainted; on any failure we fall back to the
 * card's emerald theme.
 */

type RGB = { r: number; g: number; b: number }

// Emerald, matching the wide player's existing card theming.
const FALLBACK: RGB[] = [
  { r: 16, g: 185, b: 129 },
  { r: 5, g: 150, b: 105 },
]

function extractColors(img: HTMLImageElement, count = 3): RGB[] {
  const size = 48
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) return []

  ctx.drawImage(img, 0, 0, size, size)
  const { data } = ctx.getImageData(0, 0, size, size)

  const buckets = new Map<string, { r: number; g: number; b: number; n: number }>()
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    if (data[i + 3] < 128) continue // skip transparent pixels
    const key = `${r >> 5}-${g >> 5}-${b >> 5}`
    const bk = buckets.get(key) ?? { r: 0, g: 0, b: 0, n: 0 }
    bk.r += r
    bk.g += g
    bk.b += b
    bk.n += 1
    buckets.set(key, bk)
  }

  return [...buckets.values()]
    .map((bk) => {
      const r = Math.round(bk.r / bk.n)
      const g = Math.round(bk.g / bk.n)
      const b = Math.round(bk.b / bk.n)
      const sat = (Math.max(r, g, b) - Math.min(r, g, b)) / 255
      return { r, g, b, n: bk.n, sat }
    })
    // drop near-black / near-white so the wash reads as a hue, not a smudge
    .filter((c) => {
      const lum = 0.299 * c.r + 0.587 * c.g + 0.114 * c.b
      return lum > 24 && lum < 236
    })
    // prefer colors that are both vivid and frequent
    .sort((a, b) => b.sat * 1.4 + b.n / 64 - (a.sat * 1.4 + a.n / 64))
    .slice(0, count)
    .map(({ r, g, b }) => ({ r, g, b }))
}

function toGradient(colors: RGB[]): string {
  const rgb = (c: RGB) => `rgb(${c.r} ${c.g} ${c.b})`
  const c0 = colors[0]
  const c1 = colors[1] ?? colors[0]
  const c2 = colors[2] ?? c1
  return [
    `radial-gradient(circle at 20% 18%, ${rgb(c0)} 0%, transparent 55%)`,
    `radial-gradient(circle at 84% 76%, ${rgb(c1)} 0%, transparent 58%)`,
    `linear-gradient(135deg, ${rgb(c0)}, ${rgb(c2)})`,
  ].join(', ')
}

/** Returns a CSS `background` value derived from the cover's dominant colors. */
export function useAlbumWash(src: string | null | undefined): string {
  // Keyed by the src that produced it, so a stale track's colors never show
  // while a new cover is still loading — we fall back until this src resolves.
  const [result, setResult] = useState<{ src: string; colors: RGB[] } | null>(null)

  useEffect(() => {
    if (!src) return

    let cancelled = false
    const img = new Image()
    img.crossOrigin = 'anonymous'

    img.onload = () => {
      if (cancelled) return
      try {
        const cols = extractColors(img)
        const colors = cols.length >= 2 ? cols : cols.length === 1 ? [cols[0], cols[0]] : FALLBACK
        setResult({ src, colors })
      } catch {
        setResult({ src, colors: FALLBACK })
      }
    }
    img.onerror = () => {
      if (!cancelled) setResult({ src, colors: FALLBACK })
    }
    img.src = src

    return () => {
      cancelled = true
    }
  }, [src])

  const colors = src && result?.src === src ? result.colors : FALLBACK
  return toGradient(colors)
}
