import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

function parseChangelog(content: string) {
  const entries: Array<{ version: string; date: string; body: string }> = []
  const lines = content.split('\n')
  let current: { version: string; date: string; lines: string[] } | null = null

  for (const line of lines) {
    // Matches both timestamp tags (v2026.05.28-1521) and weekly tags (v2026-W22)
    const match = line.match(/^##\s+(\[?v[^\s\]]+\]?)\s*[—–-]?\s*(.*)/)
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

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const view = searchParams.get('view')
    const cdnBase = process.env.R2_CDN_PUBLIC_DOMAIN ?? 'cdn.arthurlovegrace.top'

    if (view === 'all') {
      const resp = await fetch(`https://${cdnBase}/changelog/all.md`, { next: { revalidate: 3600 } })
      if (!resp.ok) return NextResponse.json({ entries: [] })
      const entries = parseChangelog(await resp.text())
      return NextResponse.json({ entries }, {
        headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' },
      })
    }

    // Default: latest only — try latest.md first, fall back to all.md
    const latestResp = await fetch(`https://${cdnBase}/changelog/latest.md`, { next: { revalidate: 3600 } })
    if (latestResp.ok) {
      const entries = parseChangelog(await latestResp.text())
      return NextResponse.json({ latest: entries[0] ?? null }, {
        headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' },
      })
    }

    // Fallback: parse all.md and return only the first entry
    const allResp = await fetch(`https://${cdnBase}/changelog/all.md`, { next: { revalidate: 3600 } })
    if (!allResp.ok) return NextResponse.json({ latest: null })
    const entries = parseChangelog(await allResp.text())
    return NextResponse.json({ latest: entries[0] ?? null }, {
      headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' },
    })
  } catch {
    return NextResponse.json({ latest: null })
  }
}
