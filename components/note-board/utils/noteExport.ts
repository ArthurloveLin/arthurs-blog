/**
 * Note export utilities — text download and kami-styled PNG export.
 *
 * Kami design tokens used here mirror the parchment system defined in
 * /home/arthur/.agents/skills/kami/references/design.md:
 *   parchment #f5f4ed · brand #1B365D · near-black #141413
 *   stone #6b6a64 · sand #e8e6dc · dark-warm #3d3d3a
 */

// ─── Markdown stripping ─────────────────────────────────────────────────────

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

  h1Px: 18, h1LineH: 27,
  h2Px: 15, h2LineH: 23,
  h3Px: 13, h3LineH: 21,
  bodyPx: 13, bodyLineH: 20,
  tagPx: 10.5, tagLineH: 22,
  paraGap: 8,
  blockGap: 13,
}

type ContentBlock =
  | { kind: 'heading'; level: 1 | 2 | 3; text: string }
  | { kind: 'tags'; tags: string[] }
  | { kind: 'paragraph'; text: string }
  | { kind: 'blank' }

function stripInline(line: string): string {
  return line
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*\n]+)\*/g, '$1')
    .replace(/==([^=\n]+)==/g, '$1')
    .replace(/`([^`\n]+)`/g, '$1')
    .replace(/~~([^~\n]+)~~/g, '$1')
    .replace(/@due\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^[-*]\s+(?:\[[ x]\]\s+)?/, '')
    .trim()
}

function parseBlocks(content: string): ContentBlock[] {
  const raw: ContentBlock[] = []

  for (const rawLine of content.split('\n')) {
    const line = rawLine.replace(/@due\[[^\]]*\]\([^)]*\)/g, '').trim()

    // Heading: # / ## / ###
    const headingMatch = line.match(/^(#{1,3})\s+(.+)$/)
    if (headingMatch) {
      const level = Math.min(headingMatch[1].length, 3) as 1 | 2 | 3
      const text = stripInline(headingMatch[2])
      if (text) raw.push({ kind: 'heading', level, text })
      continue
    }

    // Pure-tag line: every token is a #hashtag
    const tagMatches = line.match(/#[\w一-鿿]+/g)
    if (tagMatches && line.replace(/#[\w一-鿿]+/g, '').trim() === '') {
      raw.push({ kind: 'tags', tags: tagMatches.map(t => t.slice(1)) })
      continue
    }

    if (line === '') {
      raw.push({ kind: 'blank' })
      continue
    }

    // Paragraph — inline tags become plain text
    const text = stripInline(line).replace(/#[\w一-鿿]+/g, m => m.slice(1))
    if (text) raw.push({ kind: 'paragraph', text })
  }

  // Collapse consecutive blanks; trim leading/trailing
  const out: ContentBlock[] = []
  let prevBlank = false
  for (const b of raw) {
    if (b.kind === 'blank') { if (!prevBlank) out.push(b); prevBlank = true }
    else { out.push(b); prevBlank = false }
  }
  while (out[0]?.kind === 'blank') out.shift()
  while (out.at(-1)?.kind === 'blank') out.pop()
  return out
}

/**
 * Wrap text character-by-character (safe for CJK+Latin mix).
 */
function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = []
  let cur = ''
  for (const ch of text) {
    const next = cur + ch
    if (ctx.measureText(next).width > maxWidth && cur !== '') {
      lines.push(cur)
      cur = ch
    } else {
      cur = next
    }
  }
  if (cur) lines.push(cur)
  return lines.length > 0 ? lines : ['']
}

/**
 * Compute the pixel height of a block (uses ctx only for font measurement).
 */
function blockHeight(ctx: CanvasRenderingContext2D, block: ContentBlock, contentW: number, padH: number, logicalW: number): number {
  const { h1Px, h1LineH, h2Px, h2LineH, h3Px, h3LineH, bodyPx, bodyLineH, tagPx, tagLineH, paraGap } = K
  switch (block.kind) {
    case 'blank': return paraGap
    case 'heading': {
      const [px, lh, w] = block.level === 1 ? [h1Px, h1LineH, '600'] : block.level === 2 ? [h2Px, h2LineH, '500'] : [h3Px, h3LineH, '500']
      ctx.font = `${w} ${px}px ${SERIF}`
      const indent = block.level <= 2 ? 13 : 0
      return wrapText(ctx, block.text, contentW - indent).length * lh
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
      return rows * tagLineH
    }
    case 'paragraph': {
      ctx.font = `400 ${bodyPx}px ${SERIF}`
      return wrapText(ctx, block.text, contentW).length * bodyLineH
    }
  }
}

/**
 * Export the note as a kami-styled PNG card and trigger a browser download.
 *
 * Template anatomy (logical pixels, scaled 2× for retina):
 *   ▸ Full-width top accent bar in note accent color
 *   ▸ Eyebrow: "便签 · <formatted date>"
 *   ▸ Blocks: H1/H2/H3 with left bar + size hierarchy; tags as pills; body text
 *   ▸ Horizontal rule (sand)
 *   ▸ Footer: "arthur's blog" left · author right
 */
export function exportNoteAsImage(
  content: string,
  author: string,
  createdAt: string,
  accentColor?: string,
): void {
  const { scale, logicalW, padH, padTop, padBottom, topBarH, blockGap, h1Px, h1LineH, h2Px, h2LineH, h3Px, h3LineH, bodyPx, bodyLineH, tagPx, tagLineH, paraGap } = K
  const accent = accentColor ?? K.brand
  const contentW = logicalW - padH * 2

  const blocks = parseBlocks(content)

  // ── measure pass ──────────────────────────────────────────────────────────
  const mc = document.createElement('canvas')
  mc.width = logicalW * scale
  mc.height = 100 * scale
  const mCtx = mc.getContext('2d')!
  mCtx.scale(scale, scale)

  let contentHeight = 0
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i]!
    contentHeight += blockHeight(mCtx, block, contentW, padH, logicalW)
    if (block.kind !== 'blank' && i < blocks.length - 1 && blocks[i + 1]?.kind !== 'blank') {
      contentHeight += blockGap
    }
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

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i]!

    if (block.kind === 'blank') {
      y += paraGap
      continue
    }

    if (block.kind === 'heading') {
      const [px, lh, w] = block.level === 1 ? [h1Px, h1LineH, '600'] : block.level === 2 ? [h2Px, h2LineH, '500'] : [h3Px, h3LineH, '500']
      const indent = block.level <= 2 ? 13 : 0
      ctx.font = `${w} ${px}px ${SERIF}`
      const lines = wrapText(ctx, block.text, contentW - indent)
      const bh = lines.length * lh

      if (block.level <= 2) {
        const barW = block.level === 1 ? 2.5 : 2
        ctx.fillStyle = accent
        ctx.beginPath()
        ctx.roundRect(padH, y, barW, bh + 2, 1.5)
        ctx.fill()
      }

      ctx.fillStyle = K.nearBlack
      lines.forEach((line, li) => ctx.fillText(line, padH + indent, y + li * lh + px - 1))
      y += bh
    }

    else if (block.kind === 'tags') {
      ctx.font = `400 ${tagPx}px ${SERIF}`
      const pillPadX = 7
      const pillPadY = 3
      const pillH = tagPx + pillPadY * 2
      const endX = logicalW - padH
      let pillX = padH
      let rowStart = y

      for (const tag of block.tags) {
        const tw = ctx.measureText(tag).width
        const pw = tw + pillPadX * 2

        if (pillX + pw > endX && pillX > padH) {
          pillX = padH
          rowStart += tagLineH
        }

        ctx.fillStyle = K.tagPill
        ctx.beginPath()
        ctx.roundRect(pillX, rowStart + (tagLineH - pillH) / 2, pw, pillH, pillH / 2)
        ctx.fill()

        ctx.fillStyle = K.stone
        ctx.fillText(tag, pillX + pillPadX, rowStart + (tagLineH + tagPx) / 2 - 1)
        pillX += pw + 5
      }

      y = rowStart + tagLineH
    }

    else if (block.kind === 'paragraph') {
      ctx.font = `400 ${bodyPx}px ${SERIF}`
      ctx.fillStyle = K.darkWarm
      for (const line of wrapText(ctx, block.text, contentW)) {
        ctx.fillText(line, padH, y + bodyPx - 1)
        y += bodyLineH
      }
    }

    if (i < blocks.length - 1 && blocks[i + 1]?.kind !== 'blank') {
      y += blockGap
    }
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
  const firstText = blocks.find(b => b.kind === 'heading' || b.kind === 'paragraph')
  const name = fileNameFromContent(firstText && (firstText.kind === 'heading' || firstText.kind === 'paragraph') ? firstText.text : content)
  const url = canvas.toDataURL('image/png')
  const a = document.createElement('a')
  a.href = url
  a.download = `${name}.png`
  a.click()
}
