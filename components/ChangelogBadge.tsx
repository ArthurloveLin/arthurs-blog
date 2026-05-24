'use client'

import { useEffect, useRef, useState } from 'react'
import { X, Tag } from 'lucide-react'

interface ChangelogEntry {
  version: string
  date: string
  body: string
}

interface ChangelogData {
  latest: ChangelogEntry | null
  entries: ChangelogEntry[]
}

// Very small Markdown renderer for the changelog body
function ChangelogMarkdown({ content }: { content: string }) {
  const lines = content.split('\n')
  const elements: React.ReactNode[] = []
  let listItems: string[] = []
  let currentSection = ''

  function flushList() {
    if (listItems.length === 0) return
    elements.push(
      <ul key={`list-${elements.length}`} className="space-y-1 pl-4">
        {listItems.map((item, i) => (
          <li key={i} className="list-disc text-[13px] leading-relaxed text-foreground/75">
            {item.replace(/^-\s+/, '')}
          </li>
        ))}
      </ul>,
    )
    listItems = []
  }

  for (const line of lines) {
    if (line.startsWith('### ')) {
      flushList()
      currentSection = line.slice(4).trim()
      elements.push(
        <p key={`h3-${elements.length}`} className="mt-3 mb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/70 first:mt-0">
          {currentSection}
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
          {line}
        </p>,
      )
    }
  }
  flushList()

  return <div className="space-y-0.5">{elements}</div>
}

export function ChangelogBadge() {
  const [open, setOpen] = useState(false)
  const [data, setData] = useState<ChangelogData | null>(null)
  const [loading, setLoading] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const fetchChangelog = () => {
    if (data || loading) return
    setLoading(true)
    fetch('/api/changelog')
      .then((r) => r.json())
      .then((d: ChangelogData) => setData(d))
      .catch(() => setData({ latest: null, entries: [] }))
      .finally(() => setLoading(false))
  }

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
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

  const version = data?.latest?.version ?? 'v0.1.1'
  const hasContent = Boolean(data?.latest?.body?.trim())

  return (
    <div ref={ref} className="relative flex-shrink-0">
      <button
        type="button"
        onClick={() => {
          const next = !open
          setOpen(next)
          if (next) {
            fetchChangelog()
          }
        }}
        title="查看更新日志"
        className={[
          'inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-mono font-medium leading-none transition',
          open
            ? 'border-primary/40 bg-primary/10 text-primary'
            : 'border-border/60 bg-background/50 text-muted-foreground hover:border-primary/30 hover:bg-primary/5 hover:text-primary',
        ].join(' ')}
      >
        <Tag size={9} strokeWidth={2.5} />
        {version}
      </button>

      {open ? (
        <div className="absolute left-0 top-full z-50 mt-2 w-80 max-w-[90vw] overflow-hidden rounded-2xl border border-border/70 bg-card shadow-[0_24px_60px_rgba(15,23,42,0.12)]">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border/40 px-4 py-3">
            <div className="flex items-center gap-2">
              <Tag size={13} className="text-muted-foreground" />
              <span className="text-[13px] font-semibold text-foreground">更新日志</span>
              {data?.latest?.version ? (
                <span className="rounded-full bg-foreground/8 px-2 py-0.5 font-mono text-[11px] text-muted-foreground">
                  {data.latest.version}
                </span>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-full p-1 text-muted-foreground transition hover:bg-accent hover:text-foreground"
              aria-label="关闭"
            >
              <X size={13} />
            </button>
          </div>

          {/* Body */}
          <div className="max-h-[60vh] overflow-y-auto overscroll-contain px-4 py-3">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <span className="inline-block h-4 w-4 animate-spin rounded-full border border-muted-foreground border-t-transparent" />
              </div>
            ) : !hasContent ? (
              <p className="py-4 text-center text-[13px] text-muted-foreground/60">
                暂无更新日志。
              </p>
            ) : (
              <>
                {data?.latest?.date ? (
                  <p className="mb-3 text-[11px] text-muted-foreground/55">{data.latest.date}</p>
                ) : null}
                <ChangelogMarkdown content={data!.latest!.body} />
                {(data?.entries.length ?? 0) > 1 ? (
                  <div className="mt-4 border-t border-border/30 pt-3">
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/55">
                      历史版本
                    </p>
                    <div className="space-y-1">
                      {data!.entries.slice(1).map((entry) => (
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
                  </div>
                ) : null}
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}
