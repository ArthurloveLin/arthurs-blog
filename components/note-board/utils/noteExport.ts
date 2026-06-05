/**
 * Note export utilities — text download and kami-styled PNG export.
 *
 * Kami design tokens used here mirror the parchment system defined in
 * /home/arthur/.agents/skills/kami/references/design.md:
 *   parchment #f5f4ed · brand #1B365D · near-black #141413
 *   stone #6b6a64 · sand #e8e6dc · dark-warm #3d3d3a
 *
 * The PNG card consumes the live **markdown text theme** (`data-md-theme` on
 * <html>, see app/globals.css) for heading / strong / blockquote / link colors,
 * separately from the note's accent color (the sticky-note palette). Because the
 * card is always a light parchment surface, we resolve the LIGHT variant of the
 * md-theme palette regardless of the page's dark mode — see MD_PALETTES below.
 */

// ─── Markdown stripping (plain-text download) ───────────────────────────────

export function stripMarkdown(content: string): string {
  return content
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*\n]+)\*/g, '$1')
    .replace(/==([^=\n]+)==/g, '$1')
    .replace(/`([^`\n]+)`/g, '$1')
    .replace(/~~([^~\n]+)~~/g, '$1')
    .replace(/@due\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/#[\w一-鿿]+/g, (m) => m.slice(1))
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .trim()
}

export function fileNameFromContent(content: string): string {
  return (
    content
      .split('\n')[0]
      ?.replace(/^#+\s*/, '')
      .replace(/[^\w一-鿿-]/g, ' ')
      .trim()
      .slice(0, 40) || 'memo'
  )
}

// ─── Text / Markdown download ────────────────────────────────────────────────

export function downloadNote(content: string, format: 'md' | 'txt'): void {
  const name = fileNameFromContent(content)
  const text = format === 'md' ? content : stripMarkdown(content)
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${name}.${format}`
  a.click()
  URL.revokeObjectURL(url)
}

// ─── PNG export (kami template) ──────────────────────────────────────────────

const SERIF = 'Georgia,"Times New Roman",serif'
const MONO = '"SF Mono","Cascadia Code",Menlo,Consolas,"Liberation Mono",monospace'

const K = {
  parchment: '#f5f4ed',
  sand: '#e8e6dc',
  brand: '#1B365D',
  nearBlack: '#141413',
  darkWarm: '#3d3d3a',
  stone: '#6b6a64',
  tagPill: '#e2e0d6',

  scale: 2,
  logicalW: 640,
  padH: 44,
  padTop: 46,
  padBottom: 38,
  topBarH: 3.5,

  bodyPx: 13, bodyLineH: 20,
  tagPx: 10.5, tagLineH: 22,
  paraGap: 8,
  blockGap: 13,

  // lists
  listIndent: 2, listGap: 4,
  // blockquote
  quotePadL: 11, quoteBarW: 2.5,
  // fenced code block
  codePx: 12, codeLineH: 17, codePadX: 12, codePadY: 9, codeRadius: 5,
  // horizontal rule
  hrGap: 9,
}

// Inline code / highlight chrome — warm, parchment-cohesive (not the cool grey
// of the on-screen --md-code-bg, which would clash with the kami surface).
const CODE = { inlineBg: '#e7e5da', blockBg: '#eeece2', blockBorder: '#dcd9cc', text: '#43423d' }
const MARK = { bg: '#f2e3a8', text: '#3d3d3a' }

// Per-level heading sizing (px / lineHeight / weight). Levels 1-3 preserve the
// original kami scale & weights exactly (only the color is now themed); 4-6 are
// new, sitting near body size and distinguished by weight + color.
const HEADING_SIZE: Record<number, { px: number; lh: number; weight: string }> = {
  1: { px: 18, lh: 27, weight: '600' },
  2: { px: 15, lh: 23, weight: '500' },
  3: { px: 13, lh: 21, weight: '500' },
  4: { px: 13, lh: 20, weight: '600' },
  5: { px: 12, lh: 18, weight: '500' },
  6: { px: 11, lh: 17, weight: '500' },
}

// Light-variant markdown-theme palettes, mirroring app/globals.css
// `[data-md-theme="…"]` (the non-`.dark` blocks). Kept in JS because the export
// card is a fixed light surface and a DOM probe would inherit dark-mode values.
interface MdPalette {
  heading: readonly [string, string, string, string, string, string]
  strong: string
  link: string
  bqBorder: string
  bqText: string
}

const MD_PALETTES: Record<string, MdPalette> = {
  mono: {
    heading: ['#111111', '#1e1e1e', '#2d2d2d', '#404040', '#555555', '#6b6b6b'],
    strong: '#0a0a0a', link: '#1B365D', bqBorder: '#9ca3af', bqText: '#6b7280',
  },
  polar: {
    heading: ['#2E3440', '#5E81AC', '#81A1C1', '#8FBCBB', '#88C0D0', '#4C566A'],
    strong: '#2E3440', link: '#5E81AC', bqBorder: '#5E81AC', bqText: '#81A1C1',
  },
  tide: {
    heading: ['#0f766e', '#0e7490', '#0891b2', '#0d9488', '#155e75', '#64748b'],
    strong: '#0f766e', link: '#0891b2', bqBorder: '#0891b2', bqText: '#0e7490',
  },
  sage: {
    heading: ['#14532d', '#15803d', '#0f766e', '#166534', '#4d7c0f', '#6b7280'],
    strong: '#14532d', link: '#15803d', bqBorder: '#15803d', bqText: '#166534',
  },
  amber: {
    heading: ['#7c2d12', '#9a3412', '#c2410c', '#b45309', '#ca8a04', '#78716c'],
    strong: '#7c2d12', link: '#b45309', bqBorder: '#c2410c', bqText: '#9a3412',
  },
  sakura: {
    heading: ['#b4637a', '#286983', '#907aa9', '#56949f', '#ea9d34', '#797593'],
    strong: '#b4637a', link: '#286983', bqBorder: '#907aa9', bqText: '#797593',
  },
  night: {
    heading: ['#1e1b4b', '#3730a3', '#4338ca', '#6d28d9', '#7c3aed', '#6b7280'],
    strong: '#1e1b4b', link: '#4338ca', bqBorder: '#6d28d9', bqText: '#4338ca',
  },
  spectral: {
    heading: ['#b91c1c', '#c2410c', '#a16207', '#15803d', '#1d4ed8', '#7c3aed'],
    strong: '#b91c1c', link: '#1d4ed8', bqBorder: '#7c3aed', bqText: '#6d28d9',
  },
}

function resolveMdPalette(): MdPalette {
  const id = (typeof document !== 'undefined'
    ? document.documentElement.getAttribute('data-md-theme')
    : null) ?? 'mono'
  return MD_PALETTES[id] ?? MD_PALETTES.mono!
}

// ─── Inline tokenization ────────────────────────────────────────────────────

interface Seg {
  text: string
  bold?: boolean
  italic?: boolean
  code?: boolean
  strike?: boolean
  mark?: boolean
  link?: boolean
  tag?: boolean
}

// Mirrors INLINE_PATTERN in components/note-board/components/NoteContent.tsx.
const INLINE_RE = /(\*\*[^*]+\*\*|\*[^*\n]+\*|==[^=\n]+==|`[^`\n]+`|~~[^~\n]+~~|@due\[[^\]]*\]\([^)]*\)|\[[^\]]+\]\([^)]+\)|#[\w一-鿿]+|\$\$[^$\n]+\$\$|\$(?!\$)[^$\n]+\$)/g

function tokenizeInline(text: string): Seg[] {
  const segs: Seg[] = []
  let cursor = 0
  INLINE_RE.lastIndex = 0
  const push = (t: string, s: Partial<Seg> = {}) => { if (t) segs.push({ text: t, ...s }) }

  let m = INLINE_RE.exec(text)
  while (m) {
    const tok = m[0]
    const start = m.index
    if (start > cursor) push(text.slice(cursor, start))

    if (tok.startsWith('**') && tok.endsWith('**')) push(tok.slice(2, -2), { bold: true })
    else if (tok.startsWith('==') && tok.endsWith('==')) push(tok.slice(2, -2), { mark: true })
    else if (tok.startsWith('~~') && tok.endsWith('~~')) {
      const inner = tok.slice(2, -2)
      const due = inner.match(/^@due\[([^\]]*)\]\(/)
      push(due ? (due[1] || '截止') : inner, { strike: true })
    } else if (tok.startsWith('`') && tok.endsWith('`')) push(tok.slice(1, -1), { code: true })
    else if (tok.startsWith('*') && tok.endsWith('*')) push(tok.slice(1, -1), { italic: true })
    else if (tok.startsWith('@due[')) {
      const dm = tok.match(/^@due\[([^\]]*)\]/)
      push(dm?.[1] || '截止', { tag: true })
    } else if (tok.startsWith('[')) {
      const lm = tok.match(/^\[([^\]]+)\]/)
      push(lm?.[1] ?? tok, { link: true })
    } else if (tok.startsWith('#')) push(tok, { tag: true })
    else if (tok.startsWith('$$') && tok.endsWith('$$')) push(tok.slice(2, -2))
    else if (tok.startsWith('$') && tok.endsWith('$')) push(tok.slice(1, -1))
    else push(tok)

    cursor = start + tok.length
    m = INLINE_RE.exec(text)
  }
  if (cursor < text.length) push(text.slice(cursor))
  return segs.length > 0 ? segs : [{ text }]
}

function segsText(segs: Seg[]): string {
  return segs.map((s) => s.text).join('')
}

// ─── Block model ────────────────────────────────────────────────────────────

type Block =
  | { kind: 'heading'; level: number; segs: Seg[] }
  | { kind: 'paragraph'; segs: Seg[] }
  | { kind: 'quote'; segs: Seg[] }
  | { kind: 'listitem'; ordered: boolean; num?: number; checked: boolean | null; segs: Seg[] }
  | { kind: 'code'; lines: string[] }
  | { kind: 'tags'; tags: string[] }
  | { kind: 'hr' }
  | { kind: 'blank' }

function parseBlocks(content: string): Block[] {
  const raw: Block[] = []
  const lines = content.split('\n')

  let inCode = false
  let codeLines: string[] = []

  for (const rawLine of lines) {
    // Fenced code block
    if (rawLine.startsWith('```')) {
      if (inCode) { raw.push({ kind: 'code', lines: codeLines }); codeLines = []; inCode = false }
      else { inCode = true }
      continue
    }
    if (inCode) { codeLines.push(rawLine); continue }

    const line = rawLine.trim()

    // Heading (1-6)
    const h = line.match(/^(#{1,6})\s+(.+)$/)
    if (h) { raw.push({ kind: 'heading', level: Math.min(h[1].length, 6), segs: tokenizeInline(h[2].trim()) }); continue }

    // Horizontal rule
    if (/^(?:---+|\*\*\*+|___+)$/.test(line)) { raw.push({ kind: 'hr' }); continue }

    // Checklist item — must precede the generic UL match
    const cl = line.match(/^[-*+]\s+\[([ xX])\]\s+(.*)$/)
    if (cl) { raw.push({ kind: 'listitem', ordered: false, checked: cl[1].toLowerCase() === 'x', segs: tokenizeInline(cl[2].trim()) }); continue }

    // Unordered list item
    const ul = line.match(/^[-*+]\s+(.+)$/)
    if (ul) { raw.push({ kind: 'listitem', ordered: false, checked: null, segs: tokenizeInline(ul[1].trim()) }); continue }

    // Ordered list item
    const ol = line.match(/^(\d+)\.\s+(.+)$/)
    if (ol) { raw.push({ kind: 'listitem', ordered: true, num: parseInt(ol[1], 10), checked: null, segs: tokenizeInline(ol[2].trim()) }); continue }

    // Blockquote
    const bq = line.match(/^>\s?(.*)$/)
    if (bq) { raw.push({ kind: 'quote', segs: tokenizeInline(bq[1].trim()) }); continue }

    // Pure-tag line: every token is a #hashtag
    const tagMatches = line.match(/#[\w一-鿿]+/g)
    if (tagMatches && line.replace(/#[\w一-鿿]+/g, '').trim() === '') {
      raw.push({ kind: 'tags', tags: tagMatches.map((t) => t.slice(1)) })
      continue
    }

    if (line === '') { raw.push({ kind: 'blank' }); continue }

    raw.push({ kind: 'paragraph', segs: tokenizeInline(line) })
  }
  if (inCode && codeLines.length > 0) raw.push({ kind: 'code', lines: codeLines })

  // Collapse consecutive blanks; trim leading/trailing
  const out: Block[] = []
  let prevBlank = false
  for (const b of raw) {
    if (b.kind === 'blank') { if (!prevBlank) out.push(b); prevBlank = true }
    else { out.push(b); prevBlank = false }
  }
  while (out[0]?.kind === 'blank') out.shift()
  while (out.at(-1)?.kind === 'blank') out.pop()
  return out
}

// ─── Rich-text layout (mixed fonts, CJK-safe char wrapping) ──────────────────

interface Run { text: string; font: string; color: string; bg?: string; strike?: boolean }

interface Sizing {
  px: number
  baseColor: string
  strongColor: string
  weight: string        // weight used for bold segments
  defaultBold?: boolean // headings: every seg renders bold
  defaultItalic?: boolean
}

function fontFor(seg: Seg, sz: Sizing): string {
  const bold = seg.bold || sz.defaultBold
  const italic = seg.italic || sz.defaultItalic
  const weight = bold ? sz.weight : '400'
  const style = italic ? 'italic ' : ''
  if (seg.code) return `${weight} ${sz.px - 1}px ${MONO}`
  return `${style}${weight} ${sz.px}px ${SERIF}`
}

function colorFor(seg: Seg, sz: Sizing, pal: MdPalette): string {
  if (seg.code) return CODE.text
  if (seg.link) return pal.link
  if (seg.mark) return MARK.text
  if (seg.tag) return K.stone
  if (seg.strike) return K.stone
  if (seg.bold) return sz.strongColor
  return sz.baseColor
}

function bgFor(seg: Seg): string | undefined {
  if (seg.code) return CODE.inlineBg
  if (seg.mark) return MARK.bg
  return undefined
}

/**
 * Lay segments out into visual lines of styled runs, wrapping at `maxWidth`.
 * measureText depends only on the font, so a layout computed on the measure
 * canvas is valid for the draw canvas (both share scale + fonts).
 */
function layoutRich(ctx: CanvasRenderingContext2D, segs: Seg[], maxWidth: number, sz: Sizing, pal: MdPalette): Run[][] {
  const lines: Run[][] = []
  let line: Run[] = []
  let cur: Run | null = null
  let x = 0
  const flush = () => { lines.push(line); line = []; cur = null; x = 0 }

  for (const seg of segs) {
    const font = fontFor(seg, sz)
    const color = colorFor(seg, sz, pal)
    const bg = bgFor(seg)
    const strike = !!seg.strike
    ctx.font = font
    for (const ch of seg.text) {
      const w = ctx.measureText(ch).width
      if (x + w > maxWidth && x > 0) flush()
      if (!cur || cur.font !== font || cur.color !== color || cur.bg !== bg || cur.strike !== strike) {
        cur = { text: '', font, color, bg, strike }
        line.push(cur)
      }
      cur.text += ch
      x += w
    }
  }
  flush()
  return lines.length > 0 ? lines : [[]]
}

function drawRichLines(ctx: CanvasRenderingContext2D, lines: Run[][], xStart: number, yTop: number, lineH: number, px: number): void {
  let y = yTop
  for (const ln of lines) {
    const by = y + px - 1
    let x = xStart
    for (const run of ln) {
      ctx.font = run.font
      const w = ctx.measureText(run.text).width
      if (run.bg) {
        ctx.fillStyle = run.bg
        ctx.beginPath()
        ctx.roundRect(x - 2, by - px + 1, w + 4, px + 4, 3)
        ctx.fill()
      }
      ctx.fillStyle = run.color
      ctx.fillText(run.text, x, by)
      if (run.strike) {
        ctx.strokeStyle = run.color
        ctx.lineWidth = Math.max(0.8, px * 0.07)
        ctx.beginPath()
        ctx.moveTo(x, by - px * 0.3)
        ctx.lineTo(x + w, by - px * 0.3)
        ctx.stroke()
      }
      x += w
    }
    y += lineH
  }
}

/** Wrap a plain string char-by-char at maxWidth using the currently set font. */
function wrapMono(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = []
  let cur = ''
  for (const ch of text) {
    const next = cur + ch
    if (ctx.measureText(next).width > maxWidth && cur !== '') { lines.push(cur); cur = ch }
    else cur = next
  }
  lines.push(cur)
  return lines.length > 0 ? lines : ['']
}

// ─── Prepared (measured) blocks ──────────────────────────────────────────────

interface ListMarker { type: 'bullet' | 'ordered' | 'check'; label?: string; checked?: boolean }

type Prepared =
  | { kind: 'heading'; level: number; lines: Run[][]; px: number; lh: number; indent: number; height: number; barW: number }
  | { kind: 'paragraph'; lines: Run[][]; height: number }
  | { kind: 'quote'; lines: Run[][]; height: number }
  | { kind: 'listitem'; lines: Run[][]; marker: ListMarker; textX: number; height: number }
  | { kind: 'code'; codeLines: string[]; height: number }
  | { kind: 'tags'; tags: string[]; height: number }
  | { kind: 'hr'; height: number }
  | { kind: 'blank'; height: number }

function prepareBlock(ctx: CanvasRenderingContext2D, block: Block, contentW: number, pal: MdPalette): Prepared {
  const { padH, logicalW, bodyPx, bodyLineH, tagPx, tagLineH, paraGap, listIndent, quotePadL, codePx, codeLineH, codePadX, codePadY, hrGap } = K

  switch (block.kind) {
    case 'blank':
      return { kind: 'blank', height: paraGap }

    case 'hr':
      return { kind: 'hr', height: hrGap * 2 }

    case 'heading': {
      const { px, lh, weight } = HEADING_SIZE[block.level]!
      const indent = block.level <= 2 ? 13 : 0
      const barW = block.level === 1 ? 2.5 : 2
      const sz: Sizing = { px, baseColor: pal.heading[block.level - 1]!, strongColor: pal.heading[block.level - 1]!, weight, defaultBold: true }
      const lines = layoutRich(ctx, block.segs, contentW - indent, sz, pal)
      return { kind: 'heading', level: block.level, lines, px, lh, indent, barW, height: lines.length * lh }
    }

    case 'paragraph': {
      const sz: Sizing = { px: bodyPx, baseColor: K.darkWarm, strongColor: pal.strong, weight: '600' }
      const lines = layoutRich(ctx, block.segs, contentW, sz, pal)
      return { kind: 'paragraph', lines, height: lines.length * bodyLineH }
    }

    case 'quote': {
      const sz: Sizing = { px: bodyPx, baseColor: pal.bqText, strongColor: pal.bqText, weight: '600', defaultItalic: true }
      const lines = layoutRich(ctx, block.segs, contentW - quotePadL, sz, pal)
      return { kind: 'quote', lines, height: lines.length * bodyLineH }
    }

    case 'listitem': {
      let markerW: number
      let marker: ListMarker
      if (block.checked !== null) {
        marker = { type: 'check', checked: block.checked }
        markerW = 18
      } else if (block.ordered) {
        ctx.font = `400 ${bodyPx}px ${SERIF}`
        const label = `${block.num}.`
        markerW = ctx.measureText(label).width + 7
        marker = { type: 'ordered', label }
      } else {
        marker = { type: 'bullet' }
        markerW = 13
      }
      const textX = padH + listIndent + markerW
      const checked = block.checked === true
      const sz: Sizing = {
        px: bodyPx,
        baseColor: checked ? K.stone : K.darkWarm,
        strongColor: checked ? K.stone : pal.strong,
        weight: '600',
      }
      let lines = layoutRich(ctx, block.segs, logicalW - padH - textX, sz, pal)
      if (checked) lines = lines.map((ln) => ln.map((r) => ({ ...r, strike: true })))
      return { kind: 'listitem', lines, marker, textX, height: Math.max(lines.length * bodyLineH, bodyLineH) }
    }

    case 'code': {
      ctx.font = `400 ${codePx}px ${MONO}`
      const innerW = contentW - codePadX * 2
      const wrapped: string[] = []
      for (const ln of block.lines) wrapped.push(...wrapMono(ctx, ln === '' ? ' ' : ln, innerW))
      return { kind: 'code', codeLines: wrapped, height: wrapped.length * codeLineH + codePadY * 2 }
    }

    case 'tags': {
      ctx.font = `400 ${tagPx}px ${SERIF}`
      const pillPadX = 7
      const endX = logicalW - padH
      let x = padH
      let rows = 1
      for (const tag of block.tags) {
        const pw = ctx.measureText(tag).width + pillPadX * 2
        if (x + pw > endX && x > padH) { rows++; x = padH }
        x += pw + 5
      }
      return { kind: 'tags', tags: block.tags, height: rows * tagLineH }
    }
  }
}

function gapAfter(curr: Prepared, next: Prepared): number {
  if (curr.kind === 'blank' || next.kind === 'blank') return 0
  if (curr.kind === 'listitem' && next.kind === 'listitem') return K.listGap
  return K.blockGap
}

/**
 * Export the note as a kami-styled PNG card and trigger a browser download.
 *
 * Renders headings (1-6, colored by the active md-theme), paragraphs, ordered /
 * unordered / checklist items, blockquotes, horizontal rules, fenced code
 * blocks, inline code / bold / italic / highlight / strikethrough / links, and
 * tag pills. The note `accentColor` drives the top bar + heading left-bars +
 * tag accents; the md-theme palette drives text colors.
 */
export function exportNoteAsImage(
  content: string,
  author: string,
  createdAt: string,
  accentColor?: string,
): void {
  const { scale, logicalW, padH, padTop, padBottom, topBarH, bodyPx, bodyLineH, tagPx, tagLineH, listIndent, quotePadL, quoteBarW, codePx, codeLineH, codePadX, codePadY, codeRadius, hrGap } = K
  const accent = accentColor ?? K.brand
  const pal = resolveMdPalette()
  const contentW = logicalW - padH * 2

  const blocks = parseBlocks(content)

  // ── measure pass ──────────────────────────────────────────────────────────
  const mc = document.createElement('canvas')
  mc.width = logicalW * scale
  mc.height = 100 * scale
  const mCtx = mc.getContext('2d')!
  mCtx.scale(scale, scale)

  const prepared = blocks.map((b) => prepareBlock(mCtx, b, contentW, pal))

  let contentHeight = 0
  for (let i = 0; i < prepared.length; i++) {
    contentHeight += prepared[i]!.height
    if (i < prepared.length - 1) contentHeight += gapAfter(prepared[i]!, prepared[i + 1]!)
  }

  // ── layout ─────────────────────────────────────────────────────────────────
  const eyebrowY = topBarH + padTop
  const contentStartY = eyebrowY + 16 + 10
  const sep1Y = contentStartY + contentHeight + 20
  const footerY = sep1Y + 18
  const totalH = Math.max(footerY + padBottom, 240)

  // ── draw ──────────────────────────────────────────────────────────────────
  const canvas = document.createElement('canvas')
  canvas.width = logicalW * scale
  canvas.height = totalH * scale
  const ctx = canvas.getContext('2d')!
  ctx.scale(scale, scale)

  // Background
  ctx.fillStyle = K.parchment
  ctx.fillRect(0, 0, logicalW, totalH)

  // Top accent bar
  ctx.fillStyle = accent
  ctx.fillRect(0, 0, logicalW, topBarH)

  // Eyebrow
  const dateStr = new Date(createdAt).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })
  ctx.font = `400 9.5px ${SERIF}`
  ctx.fillStyle = K.stone
  ctx.fillText(`便签 · ${dateStr}`, padH, eyebrowY + 11)

  // ── blocks ─────────────────────────────────────────────────────────────────
  let y = contentStartY

  for (let i = 0; i < prepared.length; i++) {
    const p = prepared[i]!

    switch (p.kind) {
      case 'blank':
        break

      case 'hr': {
        const hy = y + hrGap
        ctx.strokeStyle = K.sand
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(padH, hy)
        ctx.lineTo(logicalW - padH, hy)
        ctx.stroke()
        break
      }

      case 'heading': {
        if (p.level <= 2) {
          ctx.fillStyle = accent
          ctx.beginPath()
          ctx.roundRect(padH, y, p.barW, p.height + 2, 1.5)
          ctx.fill()
        }
        drawRichLines(ctx, p.lines, padH + p.indent, y, p.lh, p.px)
        break
      }

      case 'paragraph':
        drawRichLines(ctx, p.lines, padH, y, bodyLineH, bodyPx)
        break

      case 'quote': {
        ctx.fillStyle = pal.bqBorder
        ctx.beginPath()
        ctx.roundRect(padH, y + 1, quoteBarW, p.height - 2, 1.25)
        ctx.fill()
        drawRichLines(ctx, p.lines, padH + quotePadL, y, bodyLineH, bodyPx)
        break
      }

      case 'listitem': {
        const baseX = padH + listIndent
        const by = y + bodyPx - 1
        if (p.marker.type === 'bullet') {
          ctx.fillStyle = accent
          ctx.beginPath()
          ctx.arc(baseX + 3, y + bodyPx * 0.55, 2, 0, Math.PI * 2)
          ctx.fill()
        } else if (p.marker.type === 'ordered') {
          ctx.font = `600 ${bodyPx}px ${SERIF}`
          ctx.fillStyle = accent
          ctx.fillText(p.marker.label!, baseX, by)
        } else {
          // checkbox
          const boxY = y + 1
          const boxSize = 11
          ctx.lineWidth = 1.25
          ctx.strokeStyle = p.marker.checked ? accent : K.stone
          ctx.beginPath()
          ctx.roundRect(baseX, boxY, boxSize, boxSize, 3)
          ctx.stroke()
          if (p.marker.checked) {
            ctx.fillStyle = accent
            ctx.beginPath()
            ctx.roundRect(baseX, boxY, boxSize, boxSize, 3)
            ctx.fill()
            ctx.strokeStyle = K.parchment
            ctx.lineWidth = 1.4
            ctx.beginPath()
            ctx.moveTo(baseX + 2.6, boxY + 5.8)
            ctx.lineTo(baseX + 4.6, boxY + 8)
            ctx.lineTo(baseX + 8.4, boxY + 3.2)
            ctx.stroke()
          }
        }
        drawRichLines(ctx, p.lines, p.textX, y, bodyLineH, bodyPx)
        break
      }

      case 'code': {
        ctx.fillStyle = CODE.blockBg
        ctx.beginPath()
        ctx.roundRect(padH, y, contentW, p.height, codeRadius)
        ctx.fill()
        ctx.strokeStyle = CODE.blockBorder
        ctx.lineWidth = 0.75
        ctx.beginPath()
        ctx.roundRect(padH, y, contentW, p.height, codeRadius)
        ctx.stroke()
        ctx.font = `400 ${codePx}px ${MONO}`
        ctx.fillStyle = CODE.text
        let cy = y + codePadY
        for (const ln of p.codeLines) {
          ctx.fillText(ln, padH + codePadX, cy + codePx - 2)
          cy += codeLineH
        }
        break
      }

      case 'tags': {
        ctx.font = `400 ${tagPx}px ${SERIF}`
        const pillPadX = 7
        const pillPadY = 3
        const pillH = tagPx + pillPadY * 2
        const endX = logicalW - padH
        let pillX = padH
        let rowStart = y
        for (const tag of p.tags) {
          const tw = ctx.measureText(tag).width
          const pw = tw + pillPadX * 2
          if (pillX + pw > endX && pillX > padH) { pillX = padH; rowStart += tagLineH }
          ctx.fillStyle = K.tagPill
          ctx.beginPath()
          ctx.roundRect(pillX, rowStart + (tagLineH - pillH) / 2, pw, pillH, pillH / 2)
          ctx.fill()
          ctx.fillStyle = K.stone
          ctx.fillText(tag, pillX + pillPadX, rowStart + (tagLineH + tagPx) / 2 - 1)
          pillX += pw + 5
        }
        break
      }
    }

    y += p.height
    if (i < prepared.length - 1) y += gapAfter(p, prepared[i + 1]!)
  }

  // Separator
  ctx.strokeStyle = K.sand
  ctx.lineWidth = 0.75
  ctx.beginPath()
  ctx.moveTo(padH, sep1Y)
  ctx.lineTo(logicalW - padH, sep1Y)
  ctx.stroke()

  // Footer
  ctx.font = `400 10px ${SERIF}`
  ctx.fillStyle = K.stone
  ctx.fillText("arthur's blog", padH, footerY + 10)
  const authorW = ctx.measureText(author).width
  ctx.fillText(author, logicalW - padH - authorW, footerY + 10)

  // Download
  const firstText = blocks.find((b) => b.kind === 'heading' || b.kind === 'paragraph')
  const name = fileNameFromContent(
    firstText && (firstText.kind === 'heading' || firstText.kind === 'paragraph')
      ? segsText(firstText.segs)
      : content,
  )
  const url = canvas.toDataURL('image/png')
  const a = document.createElement('a')
  a.href = url
  a.download = `${name}.png`
  a.click()
}
