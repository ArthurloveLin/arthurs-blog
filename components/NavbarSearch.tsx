'use client'

import { FormEvent, useDeferredValue, useEffect, useId, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Clock3, Loader2, Search, X, TrendingUp } from 'lucide-react'
import SearchResultCard from '@/components/SearchResultCard'
import type { SearchPostResult } from '@/lib/blog'
import { normalizeSearchQuery, SEARCH_MIN_QUERY_LENGTH } from '@/lib/blog-search'
import { useNavbarUiState } from './NavbarUiState'

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
  onSelectHistory,
  onNavigate,
}: {
  query: string
  results: SearchPostResult[]
  total: number
  loading: boolean
  error: string | null
  history: string[]
  onSelectHistory: (value: string) => void
  onNavigate: () => void
}) {
  const normalizedQuery = normalizeSearchQuery(query)
  const isQuerying = normalizedQuery.length >= SEARCH_MIN_QUERY_LENGTH

  if (loading) {
    return (
      <div className="flex items-center gap-3 px-8 py-10 text-muted-foreground animate-apple-fade-in">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-lg font-medium tracking-tight">搜索中…</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="px-8 py-10 text-destructive animate-apple-fade-in">
        <p className="text-lg font-medium tracking-tight">搜索失败：{error}</p>
      </div>
    )
  }

  if (!isQuerying) {
    return (
      <div className="py-6 px-4 sm:px-8">
        <h3 className="text-[12px] font-semibold text-muted-foreground uppercase tracking-[0.15em] mb-4 animate-apple-fade-in-right opacity-0" style={{ animationDelay: '0ms' }}>
          快速链接
        </h3>
        <div className="space-y-1">
          {history.length > 0 ? (
            history.map((item, index) => (
              <button
                key={item}
                type="button"
                onClick={() => onSelectHistory(item)}
                className="group flex items-center gap-3 w-full px-4 py-2.5 text-[15px] font-medium text-foreground/80 hover:text-primary hover:bg-muted/50 rounded-xl transition-all animate-apple-fade-in-right opacity-0"
                style={{ animationDelay: `${(index + 1) * 40}ms` }}
              >
                <Clock3 className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                {item}
              </button>
            ))
          ) : (
            <div className="animate-apple-fade-in-right opacity-0" style={{ animationDelay: '40ms' }}>
              <p className="px-4 py-6 text-[15px] text-muted-foreground border border-dashed border-border rounded-2xl bg-muted/20">
                还没有历史记录。试试标题、标签或分类里的关键词。
              </p>
            </div>
          )}
          
          {/* Default Suggestions if no history */}
          {history.length < 3 && (
            <>
              <div className="h-px bg-border/40 my-4 animate-apple-fade-in-right opacity-0" style={{ animationDelay: '160ms' }} />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {['Life Gallery', 'Life Lens', 'News'].map((tag, index) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => onSelectHistory(tag)}
                    className="group flex items-center gap-3 px-4 py-2.5 text-[15px] font-medium text-foreground/80 hover:text-primary hover:bg-muted/50 rounded-xl transition-all animate-apple-fade-in-right opacity-0"
                    style={{ animationDelay: `${(index + history.length + 2) * 40}ms` }}
                  >
                    <TrendingUp className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                    {tag}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    )
  }

  if (results.length === 0) {
    return (
      <div className="px-8 py-12 text-center animate-apple-fade-in">
        <p className="text-lg text-muted-foreground font-medium">
          没有找到与 “{normalizedQuery}” 相关的结果。
        </p>
      </div>
    )
  }

  return (
    <div className="py-6 px-4 sm:px-8 space-y-6 animate-apple-fade-in">
      <div className="flex items-center justify-between gap-3 px-4">
        <h3 className="text-[12px] font-semibold text-muted-foreground uppercase tracking-[0.2em]">建议结果</h3>
        <Link
          href={`/search?q=${encodeURIComponent(normalizedQuery)}`}
          onClick={onNavigate}
          className="text-[13px] font-semibold text-primary hover:underline underline-offset-4 decoration-2 transition-all"
        >
          查看全部 {total} 条
        </Link>
      </div>
      <div className="grid grid-cols-1 gap-3 px-1">
        {results.map((result, index) => (
          <div 
            key={result.id} 
            className="animate-apple-fade-in-right opacity-0" 
            style={{ animationDelay: `${index * 50}ms` }}
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
    </div>
  )
}

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
  const [history, setHistory] = useState<string[]>([])
  const [mounted, setMounted] = useState(false)
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
  }, [pathname])

  useEffect(() => {
    if (!isSearching) return

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node
      // If clicking outside the search container, close it
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
      // Focus input with a slight delay
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

      {isSearching && mounted ? createPortal(
        <>
          {/* Search Input Container - Fixed to match Navbar's top position and height */}
          <div
            ref={containerRef}
            className="fixed inset-x-0 top-0 h-16 z-[100] flex items-center justify-center bg-background/95 backdrop-blur-md transition-colors border-b border-border/50"
          >
            <div className="site-shell flex items-center justify-between gap-4 w-full">
              {/* We use a max-width container to match Apple's centered search look */}
              <div className="mx-auto w-full max-w-[680px] flex items-center">
                <form onSubmit={handleSubmit} className="flex-1 flex items-center animate-apple-fade-in-right">
                  <Search className="w-5 h-5 text-foreground/50 shrink-0" strokeWidth={2} />
                  <input
                    id={inputId}
                    ref={inputRef}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="搜索标题、正文、标签、分类…"
                    className="flex-1 bg-transparent px-3 py-2 text-[17px] font-medium text-foreground outline-none placeholder:text-muted-foreground/60 w-full"
                    enterKeyHint="search"
                    autoComplete="off"
                  />
                </form>
                <button
                  type="button"
                  onClick={() => setIsSearching(false)}
                  className="ml-2 p-2 text-foreground/60 hover:text-foreground transition-all duration-300 transform hover:rotate-90 animate-apple-fade-in-right"
                  style={{ animationDelay: '100ms' }}
                >
                  <X className="w-5 h-5" strokeWidth={2} />
                </button>
              </div>
            </div>

            {/* Quick Links / Suggestions Dropdown - Positioned below the fixed bar */}
            <div className="absolute top-16 left-0 right-0 animate-apple-fade-in-right" style={{ animationDelay: '150ms' }}>
              <div className="site-shell flex justify-center">
                <div className="w-full max-w-[680px] bg-background/98 backdrop-blur-3xl rounded-b-[2rem] border-x border-b border-border shadow-[0_40px_100px_-20px_rgba(0,0,0,0.25)] dark:shadow-[0_40px_100px_-20px_rgba(0,0,0,0.5)] overflow-hidden">
                  <SearchSuggestions
                    query={query}
                    results={results}
                    total={total}
                    loading={loading}
                    error={error}
                    history={history}
                    onSelectHistory={handleHistorySelect}
                    onNavigate={() => setIsSearching(false)}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Backdrop for closing Search */}
          <div 
            className="fixed inset-0 bg-black/20 dark:bg-black/40 backdrop-blur-[2px] z-[90] animate-in fade-in duration-500"
            onClick={() => setIsSearching(false)}
          />
        </>,
        document.body
      ) : null}
    </>
  )
}