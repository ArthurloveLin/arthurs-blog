'use client'

import './book-shell.css'
import './page-turn-book-shell.css'

import { Children, useEffect, useMemo, useRef, useState } from 'react'
import type { BookmarkItem } from './BookShell'
import {
  BookShellOverlayProvider,
  BookShellRenderModeProvider,
  BookShellSlideIndexProvider,
} from './book-shell-overlay-context'

declare global {
  interface Window {
    $?: TurnJQueryStatic
    jQuery?: TurnJQueryStatic
  }
}

interface TurnJQueryStatic extends JQueryStatic {
  fn: JQuery & {
    turn?: (...args: unknown[]) => unknown
  }
}

interface TurnPluginApi {
  turn: (...args: unknown[]) => unknown
  on: (...args: unknown[]) => unknown
  off: (...args: unknown[]) => unknown
  data: (...args: unknown[]) => unknown
}

interface TurnPluginState {
  done?: boolean
  pages?: Record<string, unknown>
}

interface PageTurnBookShellProps {
  children: React.ReactNode
  bookmarks?: BookmarkItem[]
  className?: string
}

const FIRST_CONTENT_PAGE = 2

let turnScriptPromise: Promise<void> | null = null

function clampIndex(index: number, slideCount: number) {
  return Math.max(0, Math.min(slideCount - 1, index))
}

function turnPageForSlide(index: number) {
  return index * 2 + FIRST_CONTENT_PAGE
}

function getSlideIndexFromView(view: unknown, slideCount: number) {
  if (!Array.isArray(view)) {
    return 0
  }

  const firstVisibleContentPage = view.find((page) => typeof page === 'number' && page >= FIRST_CONTENT_PAGE)

  if (typeof firstVisibleContentPage !== 'number') {
    return 0
  }

  return clampIndex(Math.floor((firstVisibleContentPage - FIRST_CONTENT_PAGE) / 2), slideCount)
}

function loadTurnScript() {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('turn.js can only load in the browser'))
  }

  if (typeof window.jQuery?.fn.turn === 'function') {
    return Promise.resolve()
  }

  if (turnScriptPromise) {
    return turnScriptPromise
  }

  turnScriptPromise = import('jquery').then(async ({ default: jquery }) => {
    window.jQuery = jquery
    window.$ = jquery

    if (typeof window.jQuery?.fn.turn === 'function') {
      return
    }

    await import('./vendor/recipe-page-turn.original.js')
  })

  return turnScriptPromise
}

export default function PageTurnBookShell({ children, bookmarks, className }: PageTurnBookShellProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const pagesRef = useRef<HTMLDivElement>(null)
  const turnRef = useRef<TurnPluginApi | null>(null)
  const [currentSlide, setCurrentSlide] = useState(0)
  const [isTurnReady, setIsTurnReady] = useState(false)
  const [rightOverlay, setRightOverlay] = useState<React.ReactNode | null>(null)
  const [pageSize, setPageSize] = useState({ width: 0, height: 0 })
  const slides = useMemo(() => Children.toArray(children), [children])
  const slideCount = slides.length
  const safeCurrentSlide = clampIndex(currentSlide, slideCount)
  const currentSlideRef = useRef(safeCurrentSlide)
  const canPrev = safeCurrentSlide > 0
  const canNext = safeCurrentSlide < slideCount - 1

  useEffect(() => {
    currentSlideRef.current = safeCurrentSlide
  }, [safeCurrentSlide])

  useEffect(() => {
    if (!hostRef.current) {
      return
    }

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0]
      const nextWidth = Math.round(entry.contentRect.width)
      const nextHeight = Math.round(entry.contentRect.height)

      setPageSize((current) => {
        if (current.width === nextWidth && current.height === nextHeight) {
          return current
        }

        return {
          width: nextWidth,
          height: nextHeight,
        }
      })
    })

    resizeObserver.observe(hostRef.current)

    return () => {
      resizeObserver.disconnect()
    }
  }, [])

  useEffect(() => {
    if (!pagesRef.current || pageSize.width <= 0 || pageSize.height <= 0 || slideCount === 0) {
      return
    }

    let isDisposed = false
    let turnInstance: TurnPluginApi | null = null

    void loadTurnScript().then(() => {
      if (isDisposed || !pagesRef.current || !window.jQuery) {
        return
      }

      setIsTurnReady(false)

      const jquery = window.jQuery
      const instance = jquery(pagesRef.current) as unknown as TurnPluginApi

      try {
        if (instance.data('pages')) {
          instance.turn('destroy')
        }
      } catch {
        // Ignore stale destroy failures during shell switches.
      }

      instance.turn({
        acceleration: true,
        display: 'double',
        duration: 1500,
        elevation: 300,
        gradients: true,
        height: pageSize.height,
        page: turnPageForSlide(currentSlideRef.current),
        turnCorners: 'bl,br',
        width: pageSize.width,
        when: {
          turning: (_event: unknown, page: number) => {
            if (page < FIRST_CONTENT_PAGE) {
              return false
            }

            return undefined
          },
          turned: (_event: unknown, _page: number, view: unknown) => {
            setCurrentSlide(getSlideIndexFromView(view, slideCount))
            pagesRef.current?.focus()
          },
        },
      })

      const turnState = instance.data() as TurnPluginState | undefined

      if (!turnState?.done || !turnState.pages) {
        throw new Error('turn.js failed to initialize the desktop recipe shell')
      }

      turnInstance = instance
      turnRef.current = instance
      setIsTurnReady(true)
      setCurrentSlide(getSlideIndexFromView(instance.turn('view'), slideCount))
    }).catch((error: unknown) => {
      setIsTurnReady(false)
      turnRef.current = null
      console.error('[PageTurnBookShell]', error)
    })

    return () => {
      isDisposed = true

      try {
        turnInstance?.turn('destroy')
      } catch {
        // Ignore destroy failures on route/theme switches.
      }

      if (turnRef.current === turnInstance) {
        turnRef.current = null
      }
    }
  }, [pageSize.height, pageSize.width, slideCount])

  useEffect(() => {
    if (!turnRef.current || pageSize.width <= 0 || pageSize.height <= 0) {
      return
    }

    try {
      turnRef.current.turn('size', pageSize.width, pageSize.height)
    } catch {
      // Ignore size updates while the plugin is being recreated.
    }
  }, [pageSize.height, pageSize.width])

  useEffect(() => {
    if (!turnRef.current || !isTurnReady) {
      return
    }

    try {
      const visibleSlide = getSlideIndexFromView(turnRef.current.turn('view'), slideCount)

      if (visibleSlide !== safeCurrentSlide) {
        turnRef.current.turn('page', turnPageForSlide(safeCurrentSlide))
      }
    } catch {
      // Ignore navigation sync while turn.js is finalizing a turn.
    }
  }, [isTurnReady, safeCurrentSlide, slideCount])

  function goToSlide(index: number) {
    const safeIndex = clampIndex(index, slideCount)
    setCurrentSlide(safeIndex)

    if (!turnRef.current) {
      return
    }

    turnRef.current.turn('page', turnPageForSlide(safeIndex))
  }

  function go(dir: 'prev' | 'next') {
    if (!turnRef.current) {
      goToSlide(currentSlide + (dir === 'next' ? 1 : -1))
      return
    }

    turnRef.current.turn(dir === 'next' ? 'next' : 'previous')
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'ArrowLeft') { event.preventDefault(); go('prev'); return }
    if (event.key === 'ArrowRight') { event.preventDefault(); go('next'); return }
    if (event.key === 'Home') { event.preventDefault(); goToSlide(0); return }
    if (event.key === 'End') { event.preventDefault(); goToSlide(slideCount - 1) }
  }

  return (
    <BookShellRenderModeProvider mode="page-turn">
      <BookShellOverlayProvider value={{ currentSlide: safeCurrentSlide, setRightOverlay }}>
        <div className={`rt-root ${className ?? ''}`.trim()}>
          <div className="rt-book-wrapper">
            <div className="rt-book-cover" aria-hidden="true" />
            <div ref={hostRef} className="rt-pages-container">
              <div
                ref={pagesRef}
                className="rt-pages"
                data-ready={isTurnReady ? 'true' : 'false'}
                tabIndex={0}
                role="region"
                aria-label="菜谱翻页区域"
                onKeyDown={handleKeyDown}
              >
                <div className="rt-page rt-page-cover page-num-1" aria-hidden="true">
                  <div className="rt-page-surface rt-page-cover-surface" />
                </div>

                {slides.map((slide, index) => (
                  <BookShellSlideIndexProvider key={`slide-${index + 1}`} index={index}>
                    {slide}
                  </BookShellSlideIndexProvider>
                ))}
              </div>
            </div>

            {rightOverlay ? <div className="rt-shell-right-overlay">{rightOverlay}</div> : null}

            <button
              type="button"
              className="rt-side-nav rt-side-nav-prev"
              onClick={() => go('prev')}
              disabled={!canPrev}
              aria-label="上一页"
            >
              <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 4h2v2h-2V4zm-2 2h2v2h-2V6zm-2 2h2v2H8V8zm-2 2h2v2H6v-2zm2 2h2v2H8v-2zm2 2h2v2h-2v-2zm2 2h2v2h-2v-2z" />
              </svg>
            </button>

            <button
              type="button"
              className="rt-side-nav rt-side-nav-next"
              onClick={() => go('next')}
              disabled={!canNext}
              aria-label="下一页"
            >
              <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
                <path d="M10 4h2v2h-2V4zm2 2h2v2h-2V6zm2 2h2v2h-2V8zm2 2h2v2h-2v-2zm-2 2h2v2h-2v-2zm-2 2h2v2h-2v-2zm-2 2h2v2h-2v-2z" />
              </svg>
            </button>

            {bookmarks && bookmarks.length > 0 ? (
              <div className="rt-bookmarks" aria-label="章节书签">
                {bookmarks.map((bm, index) => (
                  <button
                    key={bm.label}
                    type="button"
                    className={`bs-bookmark-tab${safeCurrentSlide === index ? ' active' : ''}`}
                    onClick={() => goToSlide(index)}
                    title={bm.label}
                    aria-label={`跳转到 ${bm.label}`}
                  >
                    <span>{bm.label}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </BookShellOverlayProvider>
    </BookShellRenderModeProvider>
  )
}