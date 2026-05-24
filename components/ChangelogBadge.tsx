'use client'

import { useEffect, useRef, useState } from 'react'
import { X, Tag } from 'lucide-react'

interface ChangelogEntry {
  version: string
  date: string
  body: string
}

function renderInline(text: string): React.ReactNode[] {
  // Parse **bold**, *italic*, `code` inline patterns
  const parts: React.ReactNode[] = []
  const re = /(\*\*(.+?)\*\*|\*(.+?)\*|`([^`]+)`)/g
  let last = 0
  let m: RegExpExecArray | null
  let idx = 0
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index))
    if (m[2] !== undefined) parts.push(<strong key={idx++} className="font-semibold text-foreground/90">{m[2]}</strong>)
    else if (m[3] !== undefined) parts.push(<em key={idx++} className="italic">{m[3]}</em>)
    else if (m[4] !== undefined) parts.push(<code key={idx++} className="rounded bg-foreground/8 px-1 py-px font-mono text-[11px]">{m[4]}</code>)
    last = m.index + m[0].length
  }
  if (last < text.length) parts.push(text.slice(last))
  return parts
}

function ChangelogMarkdown({ content }: { content: string }) {
  const lines = content.split('\n')
  const elements: React.ReactNode[] = []
  let listItems: string[] = []

  function flushList() {
    if (listItems.length === 0) return
    elements.push(
      <ul key={`list-${elements.length}`} className="space-y-1 pl-4">
        {listItems.map((item, i) => (
          <li key={i} className="list-disc text-[13px] leading-relaxed text-foreground/75">
            {renderInline(item.replace(/^-\s+/, ''))}
          </li>
        ))}
      </ul>,
    )
    listItems = []
  }

  for (const line of lines) {
    if (line.startsWith('### ')) {
      flushList()
      elements.push(
        <p key={`h3-${elements.length}`} className="mt-3 mb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/70 first:mt-0">
          {line.slice(4).trim()}
        </p>,
      )
    } else if (line.startsWith('## ')) {
      flushList()
      elements.push(
        <p key={`h2-${elements.length}`} className="mt-2 mb-1 text-[12px] font-semibold text-foreground/80 first:mt-0">
          {line.slice(3).trim()}
        </p>,
      )
    } else if (line.startsWith('- ')) {
      listItems.push(line)
    } else if (line.trim() === '') {
      flushList()
    } else if (line.trim()) {
      flushList()
      elements.push(
        <p key={`p-${elements.length}`} className="text-[13px] leading-relaxed text-foreground/75">
          {renderInline(line)}
        </p>,
      )
    }
  }
  flushList()

  return <div className="space-y-0.5">{elements}</div>
}

export function ChangelogBadge() {
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<'latest' | 'history'>('latest')

  const [latest, setLatest] = useState<ChangelogEntry | null | undefined>(undefined)
  const [latestLoading, setLatestLoading] = useState(false)

  const [historyEntries, setHistoryEntries] = useState<ChangelogEntry[] | null>(null)
  const [historyLoading, setHistoryLoading] = useState(false)

  const ref = useRef<HTMLDivElement>(null)
  const popupDivRef = useRef<HTMLDivElement>(null)
  const [popupPos, setPopupPos] = useState<{ top: number; left: number; width: number } | null>(null)

  // Position popup as fixed so it never overflows the viewport
  useEffect(() => {
    if (!open || !ref.current) return
    const badge = ref.current.getBoundingClientRect()
    const vw = document.documentElement.clientWidth
    const width = Math.min(320, vw - 16)
    const left = Math.min(badge.left, vw - width - 8)
    setPopupPos({ top: badge.bottom + 8, left: Math.max(8, left), width })
  }, [open])

  const fetchLatest = () => {
    if (latest !== undefined || latestLoading) return
    setLatestLoading(true)
    fetch('/api/changelog')
      .then((r) => r.json())
      .then((d: { latest: ChangelogEntry | null }) => setLatest(d.latest ?? null))
      .catch(() => setLatest(null))
      .finally(() => setLatestLoading(false))
  }

  const fetchHistory = () => {
    if (historyEntries !== null || historyLoading) return
    setHistoryLoading(true)
    fetch('/api/changelog?view=all')
      .then((r) => r.json())
      .then((d: { entries: ChangelogEntry[] }) => setHistoryEntries(d.entries ?? []))
      .catch(() => setHistoryEntries([]))
      .finally(() => setHistoryLoading(false))
  }

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      const target = e.target as Node
      if (
        ref.current && !ref.current.contains(target) &&
        popupDivRef.current && !popupDivRef.current.contains(target)
      ) setOpen(false)
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [open])

  return (
    <div ref={ref} className="relative flex-shrink-0">
      <button
        type="button"
        onClick={() => {
          const next = !open
          setOpen(next)
          if (next) fetchLatest()
        }}
        title="查看更新日志"
        className={[
          'inline-flex items-center justify-center rounded-full border p-1 transition',
          open
            ? 'border-primary/40 bg-primary/10 text-primary'
            : 'border-border/60 bg-background/50 text-muted-foreground hover:border-primary/30 hover:bg-primary/5 hover:text-primary',
        ].join(' ')}
      >
        <Tag size={11} strokeWidth={2.5} />
      </button>

      {open && popupPos ? (
        <div
          ref={popupDivRef}
          style={{ position: 'fixed', top: popupPos.top, left: popupPos.left, width: popupPos.width }}
          className="z-[2000] overflow-hidden rounded-2xl border border-border/70 bg-card shadow-[0_24px_60px_rgba(15,23,42,0.12)]"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border/40 px-4 py-3">
            <span className="text-[13px] font-semibold text-foreground">更新日志</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-full p-1 text-muted-foreground transition hover:bg-accent hover:text-foreground"
              aria-label="关闭"
            >
              <X size={13} />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-border/40">
            {(['latest', 'history'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => {
                  setView(tab)
                  if (tab === 'history') fetchHistory()
                }}
                className={[
                  'flex-1 py-2 text-[12px] font-medium transition',
                  view === tab
                    ? 'border-b-2 border-primary text-primary'
                    : 'text-muted-foreground hover:text-foreground',
                ].join(' ')}
              >
                {tab === 'latest' ? '最新更新' : '历史记录'}
              </button>
            ))}
          </div>

          {/* Body — fixed height, scrollable; key forces remount on tab switch to avoid layout bleed from <details> */}
          <div key={view} className="h-72 overflow-y-auto overscroll-contain px-4 py-3">
            {view === 'latest' ? (
              latestLoading ? (
                <div className="flex h-full items-center justify-center">
                  <span className="inline-block h-4 w-4 animate-spin rounded-full border border-muted-foreground border-t-transparent" />
                </div>
              ) : !latest?.body?.trim() ? (
                <p className="py-4 text-center text-[13px] text-muted-foreground/60">暂无更新日志。</p>
              ) : (
                <>
                  <div className="mb-3 flex items-center gap-2">
                    {latest.version ? (
                      <span className="rounded-full bg-foreground/8 px-2 py-0.5 font-mono text-[11px] text-muted-foreground">
                        {latest.version}
                      </span>
                    ) : null}
                    {latest.date ? (
                      <span className="text-[11px] text-muted-foreground/55">{latest.date}</span>
                    ) : null}
                  </div>
                  <ChangelogMarkdown content={latest.body} />
                </>
              )
            ) : historyLoading ? (
              <div className="flex h-full items-center justify-center">
                <span className="inline-block h-4 w-4 animate-spin rounded-full border border-muted-foreground border-t-transparent" />
              </div>
            ) : !historyEntries?.length ? (
              <p className="py-4 text-center text-[13px] text-muted-foreground/60">暂无历史记录。</p>
            ) : (
              <div className="space-y-1">
                {historyEntries.map((entry) => (
                  <details key={entry.version} className="group">
                    <summary className="flex cursor-pointer list-none items-center gap-2 rounded-lg px-2 py-1.5 text-[12px] text-muted-foreground transition hover:bg-accent hover:text-foreground">
                      <span className="font-mono font-medium">{entry.version}</span>
                      {entry.date ? <span className="opacity-55">{entry.date}</span> : null}
                    </summary>
                    <div className="px-2 pt-2 pb-1">
                      <ChangelogMarkdown content={entry.body} />
                    </div>
                  </details>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}
