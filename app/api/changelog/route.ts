import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

function parseChangelog(content: string) {
  const entries: Array<{ version: string; date: string; body: string }> = []
  const lines = content.split('\n')
  let current: { version: string; date: string; lines: string[] } | null = null

  for (const line of lines) {
    const match = line.match(/^##\s+(\[?v[\d.]+\]?)\s*[\u2014-]?\s*(.*)/)
    if (match) {
      if (current) {
        entries.push({ version: current.version, date: current.date, body: current.lines.join('\n').trim() })
      }
      current = { version: match[1]!.replace(/[[\]]/g, ''), date: match[2]?.trim() ?? '', lines: [] }
    } else if (current) {
      current.lines.push(line)
    }
  }
  if (current) {
    entries.push({ version: current.version, date: current.date, body: current.lines.join('\n').trim() })
  }
  return entries
}

export async function GET() {
  try {
    const cdnBase = process.env.R2_CDN_PUBLIC_DOMAIN ?? 'cdn.arthurlovegrace.top'
    const url = `https://${cdnBase}/changelog/all.md`

    const resp = await fetch(url, { next: { revalidate: 3600 } })
    if (!resp.ok) {
      return NextResponse.json({ entries: [], latest: null })
    }

    const content = await resp.text()
    const entries = parseChangelog(content)
    const latest = entries[0] ?? null

    return NextResponse.json({ entries, latest }, {
      headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' },
    })
  } catch {
    return NextResponse.json({ entries: [], latest: null })
  }
}
