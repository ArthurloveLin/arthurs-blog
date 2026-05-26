'use client'

import { useEffect, useRef, useState } from 'react'
import { X, Tag } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'

interface ChangelogEntry {
  version: string
  date: string
  body: string
}

function ChangelogMarkdown({ content }: { content: string }) {
  return (
    <div className="space-y-0.5 text-[13px] leading-relaxed text-foreground/75">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          h1: ({ children }) => <h1 className="mt-3 mb-1.5 text-[13px] font-semibold text-foreground/85 first:mt-0">{children}</h1>,
          h2: ({ children }) => <h2 className="mt-3 mb-1.5 text-[12px] font-semibold text-foreground/82 first:mt-0">{children}</h2>,
          h3: ({ children }) => <h3 className="mt-3 mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/70 first:mt-0">{children}</h3>,
          p: ({ children }) => <p className="my-1.5 text-[13px] leading-relaxed text-foreground/75">{children}</p>,
          ul: ({ children }) => <ul className="my-2 list-inside list-disc space-y-1 pl-1">{children}</ul>,
          ol: ({ children }) => <ol className="my-2 list-inside list-decimal space-y-1 pl-1">{children}</ol>,
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          a: ({ href, children }) => {
            const safeHref = href && /^(https?:\/\/|mailto:|tel:|#|\/)/.test(href) ? href : '#'
            const isExternal = /^(https?:)?\/\//.test(safeHref)
            return (
              <a
                href={safeHref}
                className="text-primary underline decoration-primary/35 underline-offset-2 hover:decoration-primary"
                target={isExternal ? '_blank' : undefined}
                rel={isExternal ? 'noopener noreferrer' : undefined}
              >
                {children}
              </a>
            )
          },
          blockquote: ({ children }) => <blockquote className="my-2 border-l-2 border-border/70 pl-3 text-muted-foreground">{children}</blockquote>,
          code: ({ className, children }) => {
            const isBlock = Boolean(className)
            if (isBlock) {
              return <code className="font-mono text-[12px] text-foreground/85">{children}</code>
            }
            return <code className="rounded bg-foreground/8 px-1 py-px font-mono text-[11px] text-foreground/85">{children}</code>
          },
          pre: ({ children }) => <pre className="my-2 overflow-x-auto rounded-lg bg-foreground/8 p-2.5">{children}</pre>,
          hr: () => <hr className="my-3 border-border/60" />,
          table: ({ children }) => <div className="my-2 overflow-x-auto"><table className="w-full border-collapse text-[12px]">{children}</table></div>,
          thead: ({ children }) => <thead className="bg-foreground/5">{children}</thead>,
          th: ({ children }) => <th className="border border-border/60 px-2 py-1 text-left font-semibold text-foreground/80">{children}</th>,
          td: ({ children }) => <td className="border border-border/60 px-2 py-1 align-top">{children}</td>,
          input: ({ checked }) => <input type="checkbox" checked={Boolean(checked)} readOnly className="mr-1.5 translate-y-[1px]" />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
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
