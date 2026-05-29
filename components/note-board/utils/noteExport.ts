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
    .replace(/#[\w\u4e00-\u9fff]+/g, (m) => m.slice(1))
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .trim()
}

export function fileNameFromContent(content: string): string {
  return (
    content
      .split('\n')[0]
      ?.replace(/^#+\s*/, '')
      .replace(/[^\w\u4e00-\u9fff-]/g, ' ')
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

const K = {
  parchment: '#f5f4ed',
  sand: '#e8e6dc',
  brand: '#1B365D',
  nearBlack: '#141413',
  darkWarm: '#3d3d3a',
  stone: '#6b6a64',

  // Layout
  scale: 2,
  logicalW: 640,
  padH: 44,
  padTop: 46,
  padBottom: 36,
  topBarH: 3.5,
  titleFontPx: 17,
  titleLineH: 23,
  bodyFontPx: 13,
  bodyLineH: 20,
  paraGap: 10,
}

/**
 * Wrap text to fit within maxWidth for a given canvas context.
 * Handles CJK (character-level split) and Latin (word-level split) together
 * by iterating character by character — safe for any script mix.
 */
function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const result: string[] = []
  for (const para of text.split('\n')) {
    if (para.trim() === '') {
      result.push('')
      continue
    }
    let current = ''
    for (const char of para) {
      const test = current + char
      if (ctx.measureText(test).width > maxWidth && current !== '') {
        result.push(current)
        current = char
      } else {
        current = test
      }
    }
    if (current) result.push(current)
  }
  return result
}

/**
 * Export the note as a kami-styled PNG card and trigger a browser download.
 *
 * Template anatomy (logical pixels, scaled 2× for retina):
 *   ▸ Full-width top accent bar in ink-blue
 *   ▸ Eyebrow: "便签 · <formatted date>"
 *   ▸ Left accent bar + title (first non-empty line)
 *   ▸ Horizontal rule (sand)
 *   ▸ Body text (remaining lines, markdown stripped)
 *   ▸ Horizontal rule
 *   ▸ Footer: "arthur's blog" left · author right
 */
export function exportNoteAsImage(
  content: string,
  author: string,
  createdAt: string,
): void {
  const {
    scale,
    logicalW,
    padH,
    padTop,
    padBottom,
    topBarH,
    titleFontPx,
    titleLineH,
    bodyFontPx,
    bodyLineH,
    paraGap,
  } = K

  const plainText = stripMarkdown(content)
  const contentW = logicalW - padH * 2

  // ── measure pass ──────────────────────────────────────────────────────────
  const mc = document.createElement('canvas')
  mc.width = logicalW * scale
  mc.height = 3000 * scale
  const mCtx = mc.getContext('2d')!
  mCtx.scale(scale, scale)

  const rawParagraphs = plainText.split('\n').filter(Boolean)
  const titleLine = rawParagraphs[0] ?? ''
  const bodyText = rawParagraphs.slice(1).join('\n').trim()

  mCtx.font = `500 ${titleFontPx}px Georgia,"Times New Roman",serif`
  const titleWrapped = wrapText(mCtx, titleLine, contentW - 14)
  const titleBlockH = Math.max(titleWrapped.length, 1) * titleLineH

  let bodyWrapped: string[] = []
  let bodyBlockH = 0
  if (bodyText) {
    mCtx.font = `400 ${bodyFontPx}px Georgia,"Times New Roman",serif`
    bodyWrapped = wrapText(mCtx, bodyText, contentW)
    bodyBlockH = bodyWrapped.reduce(
      (acc, l) => acc + (l === '' ? paraGap : bodyLineH),
      0,
    )
  }

  // ── layout constants ───────────────────────────────────────────────────────
  const eyebrowY = topBarH + padTop
  const titleY = eyebrowY + 16 + 8
  const sep1Y = titleY + titleBlockH + 20
  const bodyY = sep1Y + 16
  const sep2Y = bodyY + bodyBlockH + (bodyBlockH > 0 ? 24 : 0)
  const footerY = sep2Y + 18
  const totalH = Math.max(footerY + padBottom, 260)

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
  ctx.fillStyle = K.brand
  ctx.fillRect(0, 0, logicalW, topBarH)

  // Eyebrow
  const dateStr = new Date(createdAt).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
  ctx.font = `500 9.5px system-ui,-apple-system,sans-serif`
  ctx.fillStyle = K.stone
  ctx.fillText(`便签 · ${dateStr}`, padH, eyebrowY + 11)

  // Title left bar
  ctx.fillStyle = K.brand
  ctx.beginPath()
  ctx.roundRect(padH, titleY, 2.5, titleBlockH + 2, 1.5)
  ctx.fill()

  // Title text
  ctx.font = `500 ${titleFontPx}px Georgia,"Times New Roman",serif`
  ctx.fillStyle = K.nearBlack
  titleWrapped.forEach((line, i) => {
    ctx.fillText(line, padH + 13, titleY + i * titleLineH + titleFontPx - 1)
  })

  // Separator 1
  ctx.strokeStyle = K.sand
  ctx.lineWidth = 0.75
  ctx.beginPath()
  ctx.moveTo(padH, sep1Y)
  ctx.lineTo(logicalW - padH, sep1Y)
  ctx.stroke()

  // Body text
  if (bodyWrapped.length > 0) {
    ctx.font = `400 ${bodyFontPx}px Georgia,"Times New Roman",serif`
    ctx.fillStyle = K.darkWarm
    let yCursor = bodyY
    for (const line of bodyWrapped) {
      if (line === '') {
        yCursor += paraGap
      } else {
        ctx.fillText(line, padH, yCursor + bodyFontPx - 1)
        yCursor += bodyLineH
      }
    }
  }

  // Separator 2 (only when there's body content or we need footer spacing)
  ctx.strokeStyle = K.sand
  ctx.lineWidth = 0.75
  ctx.beginPath()
  ctx.moveTo(padH, sep2Y)
  ctx.lineTo(logicalW - padH, sep2Y)
  ctx.stroke()

  // Footer
  ctx.font = `400 10px system-ui,-apple-system,sans-serif`
  ctx.fillStyle = K.stone
  ctx.fillText("arthur's blog", padH, footerY + 10)
  const authorW = ctx.measureText(author).width
  ctx.fillText(author, logicalW - padH - authorW, footerY + 10)

  // Download
  const name = fileNameFromContent(plainText || titleLine)
  const url = canvas.toDataURL('image/png')
  const a = document.createElement('a')
  a.href = url
  a.download = `${name}.png`
  a.click()
}
