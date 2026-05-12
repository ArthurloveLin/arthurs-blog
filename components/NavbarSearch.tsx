'use client'

import { FormEvent, useDeferredValue, useEffect, useId, useMemo, useRef, useState, useTransition, memo } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Clock3, Loader2, Search, X, TrendingUp } from 'lucide-react'
import SearchResultCard from '@/components/SearchResultCard'
import type { SearchPostResult } from '@/lib/blog'
import { normalizeSearchQuery, SEARCH_MIN_QUERY_LENGTH, searchInternalLinks } from '@/lib/blog-search'
import { useNavbarUiState } from './NavbarUiState'

const HISTORY_KEY = 'blog-search-history'
const SUGGESTION_LIMIT = 6

interface SearchResponse {
  results: SearchPostResult[]
  total: number
  page: number
  limit: number
}

interface MemoSearchResult {
  id: string
  content: string
  created_at: string
}

// Separate component for Quick Link items to avoid re-rendering all of them
const QuickLinkItem = memo(({ 
  item, 
  index, 
  icon: Icon, 
  onClick, 
  baseDelay,
  staggerDelay = 30
}: { 
  item: string
  index: number
  icon: typeof Clock3 | typeof TrendingUp
  onClick: (value: string) => void
  baseDelay: number
  staggerDelay?: number
}) => {
  return (
    <button
      type="button"
      onClick={() => onClick(item)}
      className="group flex items-center gap-3 w-full px-4 py-2.5 text-[15px] font-medium text-foreground/80 hover:text-primary hover:bg-muted/40 rounded-xl transition-colors duration-200 animate-apple-fade-in-right"
      style={{ 
        animationDelay: `${baseDelay + (index + 1) * staggerDelay}ms`, 
        animationFillMode: 'both' 
      }}
    >
      <Icon className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors duration-200" />
      {item}
    </button>
  )
})

QuickLinkItem.displayName = 'QuickLinkItem'

const SearchSuggestionsList = memo(({
  query,
  results,
  total,
  loading,
  error,
  memoResults,
  history,
  onSelectHistory,
  onNavigate,
  isOpening,
}: {
  query: string
  results: SearchPostResult[]
  total: number
  loading: boolean
  error: string | null
  memoResults: MemoSearchResult[]
  history: string[]
  onSelectHistory: (value: string) => void
  onNavigate: () => void
  isOpening: boolean
}) => {
  const normalizedQuery = normalizeSearchQuery(query)
  const isQuerying = normalizedQuery.length >= SEARCH_MIN_QUERY_LENGTH
  
  // Only use stagger delay if we are currently opening the search panel
  const baseDelay = isOpening ? 280 : 0
  const staggerDelay = isOpening ? 30 : 0

  if (loading && results.length === 0) {
    return (
      <div className="flex items-center gap-3 px-8 py-10 text-muted-foreground animate-apple-fade-in" style={{ animationDelay: `${baseDelay}ms`, animationFillMode: 'both' }}>
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-lg font-medium tracking-tight">搜索中…</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="px-8 py-10 text-destructive animate-apple-fade-in" style={{ animationDelay: `${baseDelay}ms`, animationFillMode: 'both' }}>
        <p className="text-lg font-medium tracking-tight">搜索失败：{error}</p>
      </div>
    )
  }

  if (!isQuerying) {
    return (
      <div className="py-6 px-4 sm:px-8">
        <h3 className="text-[12px] font-semibold text-muted-foreground uppercase tracking-[0.15em] mb-4 animate-apple-fade-in-right" style={{ animationDelay: `${baseDelay}ms`, animationFillMode: 'both' }}>
          快速链接
        </h3>
        <div className="space-y-1">
          {history.length > 0 ? (
            history.map((item, index) => (
              <QuickLinkItem
                key={`history-${item}`}
                item={item}
                index={index}
                icon={Clock3}
                onClick={onSelectHistory}
                baseDelay={baseDelay}
                staggerDelay={staggerDelay}
              />
            ))
          ) : (
            <div className="animate-apple-fade-in-right" style={{ animationDelay: `${baseDelay + staggerDelay}ms`, animationFillMode: 'both' }}>
              <p className="px-4 py-6 text-[15px] text-muted-foreground border border-dashed border-border rounded-2xl bg-muted/20">
                还没有历史记录。试试标题、标签或分类里的关键词。
              </p>
            </div>
          )}
          
          {history.length < 3 && (
            <>
              <div className="h-px bg-border/40 my-4 animate-apple-fade-in-right" style={{ animationDelay: `${baseDelay + staggerDelay * 4}ms`, animationFillMode: 'both' }} />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {['Life Gallery', 'Life Lens', 'News'].map((tag, index) => (
                  <QuickLinkItem
                    key={`suggestion-${tag}`}
                    item={tag}
                    index={index + history.length}
                    icon={TrendingUp}
                    onClick={onSelectHistory}
                    baseDelay={baseDelay}
                    staggerDelay={staggerDelay}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    )
  }

  if (results.length === 0 && memoResults.length === 0 && !loading) {
    return (
      <div className="px-8 py-12 text-center animate-apple-fade-in" style={{ animationDelay: `${baseDelay}ms`, animationFillMode: 'both' }}>
        <p className="text-lg text-muted-foreground font-medium">
          没有找到与 "{normalizedQuery}" 相关的结果。
        </p>
      </div>
    )
  }

  return (
    <div className="py-6 px-4 sm:px-8 space-y-6 animate-apple-fade-in" style={{ animationDelay: `${baseDelay}ms`, animationFillMode: 'both' }}>
      {results.length > 0 ? (
        <>
          <div className="flex items-center justify-between gap-3 px-4">
            <h3 className="text-[12px] font-semibold text-muted-foreground uppercase tracking-[0.2em]">建议结果</h3>
            <Link
              href={`/search?q=${encodeURIComponent(normalizedQuery)}`}
              onClick={onNavigate}
              className="text-[13px] font-semibold text-primary hover:underline underline-offset-4 decoration-2 transition-colors duration-200"
            >
              查看全部 {total} 条
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-3 px-1">
            {results.map((result, index) => (
              <div
                key={result.id}
                className="animate-apple-fade-in-right"
                style={{
                  animationDelay: `${baseDelay + index * staggerDelay * 1.5}ms`,
                  animationFillMode: 'both'
                }}
              >
                <SearchResultCard
                  result={result}
                  query={normalizedQuery}
                  compact={true}
                  onNavigate={onNavigate}
                />
              </div>
            ))}
          </div>
        </>
      ) : null}

      {memoResults.length > 0 ? (
        <div className="space-y-2 px-1">
          <div className="flex items-center justify-between px-3">
            <h3 className="text-[12px] font-semibold text-muted-foreground uppercase tracking-[0.2em]">Memo</h3>
            <Link
              href={`/memo?q=${encodeURIComponent(normalizedQuery)}`}
              onClick={onNavigate}
              className="text-[13px] font-semibold text-primary hover:underline underline-offset-4 decoration-2 transition-colors duration-200"
            >
              在 Memo 中搜索
            </Link>
          </div>
          {memoResults.map((item) => {
            const snippet = item.content.slice(0, 120)
            return (
              <Link
                key={item.id}
                href={`/memo?q=${encodeURIComponent(normalizedQuery)}`}
                onClick={onNavigate}
                className="block rounded-xl border border-border/60 bg-card/60 px-4 py-2.5 text-sm transition hover:bg-accent"
              >
                <p className="line-clamp-2 text-[13px] text-foreground/80">{snippet}{item.content.length > 120 ? '…' : ''}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">{new Date(item.created_at).toLocaleDateString('zh-CN')}</p>
              </Link>
            )
          })}
        </div>
      ) : null}
    </div>
  )
})

SearchSuggestionsList.displayName = 'SearchSuggestionsList'

export default function NavbarSearch() {
  const router = useRouter()
  const pathname = usePathname()
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const { isSearching, setIsSearching } = useNavbarUiState()
  
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchPostResult[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [memoResults, setMemoResults] = useState<MemoSearchResult[]>([])
  const [history, setHistory] = useState<string[]>([])
  const [mounted, setMounted] = useState(false)
  const [portalOpen, setPortalOpen] = useState(false)
  const [isOpening, setIsOpening] = useState(false)
  const [isPending, startTransition] = useTransition()
  
  const deferredQuery = useDeferredValue(query)
  const inputId = useId()
  const normalizedDeferredQuery = useMemo(() => normalizeSearchQuery(deferredQuery), [deferredQuery])

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
    setMounted(true)
  }, [])

  useEffect(() => {
    if (isSearching) {
      setIsSearching(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  useEffect(() => {
    let timeoutId: number
    let openingTimer: number
    if (isSearching) {
      setPortalOpen(true)
      setIsOpening(true)
      // Duration of the "opening" state where stagger animations are active
      openingTimer = window.setTimeout(() => setIsOpening(false), 800)
    } else {
      timeoutId = window.setTimeout(() => setPortalOpen(false), 300)
      setIsOpening(false)
    }
    return () => {
      window.clearTimeout(timeoutId)
      window.clearTimeout(openingTimer)
    }
  }, [isSearching])

  useEffect(() => {
    if (!isSearching) return

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node
      if (containerRef.current && !containerRef.current.contains(target)) {
        setIsSearching(false)
      }
    }

    window.addEventListener('pointerdown', handlePointerDown)
    return () => window.removeEventListener('pointerdown', handlePointerDown)
  }, [isSearching, setIsSearching])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setIsSearching(!isSearching)
        return
      }

      if (event.key === 'Escape') {
        setIsSearching(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isSearching, setIsSearching])

  useEffect(() => {
    if (isSearching) {
      const timer = setTimeout(() => {
        inputRef.current?.focus()
      }, 350)
      
      document.body.style.overflow = 'hidden'
      return () => {
        clearTimeout(timer)
        document.body.style.overflow = ''
      }
    } else {
      document.body.style.overflow = ''
    }
  }, [isSearching])

  useEffect(() => {
    if (!isSearching) return

    if (normalizedDeferredQuery.length < SEARCH_MIN_QUERY_LENGTH) {
      setResults([])
      setTotal(0)
      setMemoResults([])
      setLoading(false)
      setError(null)
      return
    }

    const controller = new AbortController()
    const timeoutId = window.setTimeout(async () => {
      try {
        setLoading(true)
        setError(null)

        const [blogResponse, memoResponse] = await Promise.allSettled([
          fetch(`/api/blog/search?q=${encodeURIComponent(normalizedDeferredQuery)}&limit=${SUGGESTION_LIMIT}`, { signal: controller.signal }),
          fetch(`/api/note-boards/memo/search?q=${encodeURIComponent(normalizedDeferredQuery)}&limit=3`, { signal: controller.signal }),
        ])

        if (blogResponse.status === 'rejected') {
          throw new Error('搜索服务暂时不可用')
        }

        if (!blogResponse.value.ok) {
          throw new Error('搜索服务暂时不可用')
        }

        const data = await blogResponse.value.json() as SearchResponse

        const memoData = memoResponse.status === 'fulfilled' && memoResponse.value.ok
          ? await memoResponse.value.json().catch(() => ({ results: [] })) as { results: MemoSearchResult[] }
          : { results: [] }

        // Local search for internal links
        const internalResults = searchInternalLinks(normalizedDeferredQuery)
        const mappedInternalResults: SearchPostResult[] = internalResults.map((item) => ({
          id: item.id,
          slug: item.href,
          title: item.title,
          summary: item.summary,
          tags: item.tags,
          category: item.category,
          type: 'internal',
          rank: 10,
          matched_fields: ['title'],
          snippet: item.summary,
          r2_key: '',
          cover_image: null,
          published: true,
          published_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          sticky: 0,
          reading_minutes: 0,
        }))

        startTransition(() => {
          setResults([...mappedInternalResults, ...(data.results ?? [])])
          setTotal((data.total ?? 0) + internalResults.length)
          setMemoResults(memoData.results ?? [])
          setLoading(false)
        })
      } catch (fetchError) {
        if ((fetchError as Error).name === 'AbortError') {
          return
        }
        setError(fetchError instanceof Error ? fetchError.message : '搜索失败')
        setResults([])
        setTotal(0)
        setMemoResults([])
        setLoading(false)
      }
    }, 200)

    return () => {
      controller.abort()
      window.clearTimeout(timeoutId)
    }
  }, [isSearching, normalizedDeferredQuery])

  function persistHistory(value: string) {
    if (typeof window === 'undefined') return

    const next = [value, ...history.filter((item) => item !== value)].slice(0, 5)
    setHistory(next)
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(next))
  }

  function navigateToSearch(rawQuery: string) {
    const normalizedQuery = normalizeSearchQuery(rawQuery)
    if (normalizedQuery.length < SEARCH_MIN_QUERY_LENGTH) {
      return
    }

    persistHistory(normalizedQuery)
    setIsSearching(false)
    router.push(`/search?q=${encodeURIComponent(normalizedQuery)}`)
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    navigateToSearch(query)
  }

  function handleHistorySelect(value: string) {
    setQuery(value)
    inputRef.current?.focus()
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsSearching(true)}
        className={`p-2 text-foreground/60 hover:text-foreground hover:bg-foreground/5 rounded-lg transition duration-200 ${isSearching ? 'pointer-events-none' : ''}`}
        aria-label="打开搜索"
        title="搜索 (Ctrl K)"
      >
        <Search className="w-[18px] h-[18px]" strokeWidth={1.75} />
      </button>

      {portalOpen && mounted ? createPortal(
        <>
          <div
            ref={containerRef}
            className={`fixed inset-x-0 top-0 h-16 z-[100] flex items-center pointer-events-none transition-opacity duration-300 ${isSearching ? 'opacity-100' : 'opacity-0'}`}
          >
            <div className="site-shell flex items-center h-full w-full relative pointer-events-none">
              <div className="flex items-center w-full md:absolute md:left-1/2 md:-translate-x-1/2 md:max-w-[540px] pl-[170px] pr-[10px] md:px-0 pointer-events-auto">
                <form onSubmit={handleSubmit} className="flex-1 flex items-center animate-apple-fade-in-right" style={{ animationDelay: isSearching ? '350ms' : '0ms', animationFillMode: 'both' }}>
                  <Search className="w-[18px] h-[18px] md:w-5 md:h-5 text-foreground/50 shrink-0" strokeWidth={2} />
                  <input
                    id={inputId}
                    ref={inputRef}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="搜索标题、正文、标签、分类…"
                    className="flex-1 bg-transparent ml-3 px-3 py-2 text-[16px] md:text-[17px] font-medium text-foreground outline-none placeholder:text-muted-foreground/60 w-full rounded-full"
                    enterKeyHint="search"
                    autoComplete="off"
                  />
                  {(loading || isPending) && (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground/50 mr-2" />
                  )}
                </form>
                <button
                  type="button"
                  onClick={() => setIsSearching(false)}
                  className="ml-1 md:ml-2 p-2 text-foreground/60 hover:text-foreground transition-all duration-300 transform hover:rotate-90 animate-apple-fade-in-right"
                  style={{ animationDelay: isSearching ? '400ms' : '0ms', animationFillMode: 'both' }}
                >
                  <X className="w-5 h-5" strokeWidth={2} />
                </button>
              </div>
            </div>

            <div className="absolute top-16 left-0 right-0 pointer-events-none">
              <div className="site-shell flex justify-center relative">
                <div 
                  className="w-full max-w-[680px] bg-background rounded-b-[2rem] border-x border-b border-border shadow-xl overflow-hidden pointer-events-auto"
                  style={{ 
                    opacity: isSearching ? 1 : 0,
                    transition: 'opacity 300ms ease-out',
                    animationDelay: isSearching ? '350ms' : '0ms', 
                    animationFillMode: 'both'
                  }}
                >
                  <SearchSuggestionsList
                    query={query}
                    results={results}
                    total={total}
                    loading={loading}
                    error={error}
                    memoResults={memoResults}
                    history={history}
                    onSelectHistory={handleHistorySelect}
                    onNavigate={() => setIsSearching(false)}
                    isOpening={isOpening}
                  />
                </div>
              </div>
            </div>
          </div>

          <div 
            className={`fixed inset-x-0 bottom-0 top-16 bg-black/10 dark:bg-black/30 z-[90] transition-opacity duration-300 ${isSearching ? 'opacity-100' : 'opacity-0'}`}
            onClick={() => setIsSearching(false)}
          />
        </>,
        document.body
      ) : null}
    </>
  )
}