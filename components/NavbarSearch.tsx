'use client'

import { FormEvent, useDeferredValue, useEffect, useId, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createPortal } from 'react-dom'
import { Clock3, Loader2, Search, X } from 'lucide-react'
import SearchResultCard from '@/components/SearchResultCard'
import type { SearchPostResult } from '@/lib/blog'
import { normalizeSearchQuery, SEARCH_MIN_QUERY_LENGTH } from '@/lib/blog-search'

const HISTORY_KEY = 'blog-search-history'
const SUGGESTION_LIMIT = 6

interface SearchResponse {
  results: SearchPostResult[]
  total: number
  page: number
  limit: number
}

function SearchSuggestions({
  query,
  results,
  total,
  loading,
  error,
  history,
  compact,
  onSelectHistory,
  onNavigate,
}: {
  query: string
  results: SearchPostResult[]
  total: number
  loading: boolean
  error: string | null
  history: string[]
  compact?: boolean
  onSelectHistory: (value: string) => void
  onNavigate: () => void
}) {
  const normalizedQuery = normalizeSearchQuery(query)
  const showHistory = normalizedQuery.length < SEARCH_MIN_QUERY_LENGTH

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-[1.1rem] border border-border/70 bg-background/70 px-4 py-4 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        搜索中…
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-[1.1rem] border border-destructive/20 bg-destructive/5 px-4 py-4 text-sm text-destructive">
        搜索失败：{error}
      </div>
    )
  }

  if (showHistory) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
          <Clock3 className="h-3.5 w-3.5" />
          最近搜索
        </div>
        {history.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {history.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => onSelectHistory(item)}
                className="rounded-full border border-border bg-background px-3 py-1.5 text-sm text-foreground transition hover:border-foreground/20 hover:bg-muted"
              >
                {item}
              </button>
            ))}
          </div>
        ) : (
          <p className="rounded-[1.1rem] border border-dashed border-border bg-background/65 px-4 py-4 text-sm text-muted-foreground">
            还没有历史记录。试试标题、标签或分类里的关键词。
          </p>
        )}
      </div>
    )
  }

  if (results.length === 0) {
    return (
      <div className="rounded-[1.1rem] border border-dashed border-border bg-background/65 px-4 py-5 text-sm text-muted-foreground">
        没有找到与 “{normalizedQuery}” 相关的结果。
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">建议结果</p>
        <Link
          href={`/search?q=${encodeURIComponent(normalizedQuery)}`}
          onClick={onNavigate}
          className="text-xs font-medium text-primary transition hover:text-primary/80"
        >
          查看全部 {total} 条
        </Link>
      </div>
      <div className="space-y-2">
        {results.map((result) => (
          <SearchResultCard
            key={result.id}
            result={result}
            query={normalizedQuery}
            compact={compact ?? true}
            onNavigate={onNavigate}
          />
        ))}
      </div>
    </div>
  )
}

export default function NavbarSearch() {
  const router = useRouter()
  const pathname = usePathname()
  const desktopInputRef = useRef<HTMLInputElement>(null)
  const mobileInputRef = useRef<HTMLInputElement>(null)
  const desktopContainerRef = useRef<HTMLDivElement>(null)
  const [desktopOpen, setDesktopOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchPostResult[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [history, setHistory] = useState<string[]>([])
  const deferredQuery = useDeferredValue(query)
  const inputId = useId()
  const normalizedDeferredQuery = useMemo(() => normalizeSearchQuery(deferredQuery), [deferredQuery])
  const isOpen = desktopOpen || mobileOpen
  const canUsePortal = typeof document !== 'undefined'

  useEffect(() => {
    if (typeof window === 'undefined') return

    try {
      const parsed = JSON.parse(window.localStorage.getItem(HISTORY_KEY) ?? '[]')
      if (Array.isArray(parsed)) {
        setHistory(parsed.filter((item): item is string => typeof item === 'string'))
      }
    } catch {
      setHistory([])
    }
  }, [])

  useEffect(() => {
    setDesktopOpen(false)
    setMobileOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!desktopOpen) return

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node
      if (!desktopContainerRef.current?.contains(target)) {
        setDesktopOpen(false)
      }
    }

    window.addEventListener('pointerdown', handlePointerDown)
    return () => window.removeEventListener('pointerdown', handlePointerDown)
  }, [desktopOpen])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        if (window.matchMedia('(max-width: 767px)').matches) {
          setMobileOpen(true)
        } else {
          setDesktopOpen(true)
        }
        return
      }

      if (event.key === 'Escape') {
        setDesktopOpen(false)
        setMobileOpen(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  useEffect(() => {
    if (desktopOpen) {
      desktopInputRef.current?.focus()
    }
  }, [desktopOpen])

  useEffect(() => {
    if (mobileOpen) {
      mobileInputRef.current?.focus()
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = ''
      }
    }

    document.body.style.overflow = ''
    return undefined
  }, [mobileOpen])

  useEffect(() => {
    if (!isOpen) {
      return
    }

    if (normalizedDeferredQuery.length < SEARCH_MIN_QUERY_LENGTH) {
      setResults([])
      setTotal(0)
      setLoading(false)
      setError(null)
      return
    }

    const controller = new AbortController()
    const timeoutId = window.setTimeout(async () => {
      try {
        setLoading(true)
        setError(null)

        const response = await fetch(`/api/blog/search?q=${encodeURIComponent(normalizedDeferredQuery)}&limit=${SUGGESTION_LIMIT}`, {
          signal: controller.signal,
        })

        if (!response.ok) {
          throw new Error('搜索服务暂时不可用')
        }

        const data = await response.json() as SearchResponse
        setResults(data.results ?? [])
        setTotal(data.total ?? 0)
      } catch (fetchError) {
        if ((fetchError as Error).name === 'AbortError') {
          return
        }
        setError(fetchError instanceof Error ? fetchError.message : '搜索失败')
        setResults([])
        setTotal(0)
      } finally {
        setLoading(false)
      }
    }, 220)

    return () => {
      controller.abort()
      window.clearTimeout(timeoutId)
    }
  }, [isOpen, normalizedDeferredQuery])

  function persistHistory(value: string) {
    if (typeof window === 'undefined') return

    const next = [value, ...history.filter((item) => item !== value)].slice(0, 6)
    setHistory(next)
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(next))
  }

  function navigateToSearch(rawQuery: string) {
    const normalizedQuery = normalizeSearchQuery(rawQuery)
    if (normalizedQuery.length < SEARCH_MIN_QUERY_LENGTH) {
      return
    }

    persistHistory(normalizedQuery)
    setDesktopOpen(false)
    setMobileOpen(false)
    router.push(`/search?q=${encodeURIComponent(normalizedQuery)}`)
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    navigateToSearch(query)
  }

  function handleDesktopToggle() {
    if (!desktopOpen) {
      setDesktopOpen(true)
      return
    }

    if (query) {
      setQuery('')
      setResults([])
      setTotal(0)
      return
    }

    setDesktopOpen(false)
  }

  function handleHistorySelect(value: string) {
    setQuery(value)
    if (mobileOpen) {
      mobileInputRef.current?.focus()
    } else {
      desktopInputRef.current?.focus()
    }
  }

  const desktopPanel = desktopOpen ? (
    <div className="absolute right-0 top-[calc(100%+0.8rem)] z-[70] hidden w-[26rem] rounded-[1.4rem] border border-border/70 bg-card/96 p-4 shadow-[0_20px_60px_-28px_rgba(15,23,42,0.45)] backdrop-blur-xl md:block">
      <SearchSuggestions
        query={query}
        results={results}
        total={total}
        loading={loading}
        error={error}
        history={history}
        onSelectHistory={handleHistorySelect}
        onNavigate={() => {
          if (query) {
            persistHistory(normalizeSearchQuery(query))
          }
          setDesktopOpen(false)
        }}
      />
    </div>
  ) : null

  return (
    <>
      <div ref={desktopContainerRef} className="relative hidden md:block">
        <form
          onSubmit={handleSubmit}
          className={[
            'relative flex h-11 items-center overflow-hidden border text-foreground transition-all duration-500 ease-out',
            desktopOpen
              ? 'w-[20rem] rounded-[1.1rem] border-border bg-card/90 pl-4 pr-12 shadow-[0_12px_32px_-22px_rgba(15,23,42,0.45)] backdrop-blur-xl'
              : 'w-11 rounded-full border-border/70 bg-card/70 pl-0 pr-0 hover:border-foreground/15 hover:bg-card',
          ].join(' ')}
          role="search"
        >
          <label htmlFor={inputId} className="sr-only">搜索文章</label>
          <input
            id={inputId}
            ref={desktopInputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onFocus={() => setDesktopOpen(true)}
            placeholder="搜索标题、正文、标签、分类…"
            className={[
              'h-full min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/80 transition-opacity duration-200',
              desktopOpen ? 'opacity-100' : 'pointer-events-none opacity-0',
            ].join(' ')}
            enterKeyHint="search"
          />
          {!desktopOpen ? (
            <div className="pointer-events-none absolute right-12 top-1/2 hidden -translate-y-1/2 rounded-full border border-border/80 px-2 py-1 text-[10px] font-medium tracking-[0.14em] text-muted-foreground/90 lg:block">
              Ctrl K
            </div>
          ) : null}
          <button
            type="button"
            onClick={handleDesktopToggle}
            className="absolute right-1.5 top-1.5 inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition hover:bg-foreground/5 hover:text-foreground"
            aria-label={desktopOpen ? (query ? '清空搜索' : '关闭搜索') : '打开搜索'}
            title={desktopOpen ? '关闭搜索' : '搜索'}
          >
            {desktopOpen ? <X className="h-[17px] w-[17px]" strokeWidth={1.9} /> : <Search className="h-[17px] w-[17px]" strokeWidth={1.9} />}
          </button>
        </form>
        {desktopPanel}
      </div>

      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        className="p-2 text-muted-foreground hover:text-foreground hover:bg-foreground/5 rounded-lg transition duration-200 md:hidden"
        aria-label="搜索"
        title="搜索"
      >
        <Search className="w-[18px] h-[18px]" strokeWidth={1.75} />
      </button>

      {mobileOpen && canUsePortal ? createPortal(
        <div className="fixed inset-0 z-[90] md:hidden">
          <div className="absolute inset-0 bg-black/45 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <div className="absolute inset-x-0 top-0 h-full overflow-y-auto bg-background px-4 pb-8 pt-4">
            <div className="mx-auto max-w-2xl">
              <form onSubmit={handleSubmit} className="rounded-[1.4rem] border border-border/70 bg-card/95 p-3 shadow-[0_18px_50px_-24px_rgba(15,23,42,0.42)]">
                <div className="flex items-center gap-2">
                  <Search className="h-5 w-5 shrink-0 text-muted-foreground" strokeWidth={1.8} />
                  <input
                    ref={mobileInputRef}
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="搜索标题、正文、标签、分类…"
                    className="h-12 min-w-0 flex-1 bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground/80"
                    enterKeyHint="search"
                  />
                  <button
                    type="button"
                    onClick={() => setMobileOpen(false)}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition hover:bg-foreground/5 hover:text-foreground"
                    aria-label="关闭搜索"
                  >
                    <X className="h-5 w-5" strokeWidth={1.8} />
                  </button>
                </div>
              </form>

              <div className="mt-5 rounded-[1.4rem] border border-border/70 bg-card/94 p-4 shadow-[0_18px_50px_-28px_rgba(15,23,42,0.32)]">
                <SearchSuggestions
                  query={query}
                  results={results}
                  total={total}
                  loading={loading}
                  error={error}
                  history={history}
                  compact={false}
                  onSelectHistory={handleHistorySelect}
                  onNavigate={() => {
                    if (query) {
                      persistHistory(normalizeSearchQuery(query))
                    }
                    setMobileOpen(false)
                  }}
                />
              </div>
            </div>
          </div>
        </div>,
        document.body,
      ) : null}
    </>
  )
}