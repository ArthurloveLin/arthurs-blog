'use client'

import './book-shell.css'
import { useRef, Children, useEffect, useState } from 'react'
import { BookShellOverlayProvider, BookShellSlideIndexProvider } from './book-shell-overlay-context'

const MOUNTED_SLIDE_RADIUS = 2
const SPRITE_F = 7

const BOOKMARK_COLORS = [
  'oklch(0.55 0.16 30)',
  'oklch(0.55 0.14 50)',
  'oklch(0.50 0.13 140)',
  'oklch(0.50 0.14 220)',
  'oklch(0.52 0.13 280)',
  'oklch(0.52 0.14 350)',
  'oklch(0.50 0.14 170)',
  'oklch(0.52 0.13 70)',
]

export interface BookmarkItem {
  label: string
}

interface BookShellProps {
  children: React.ReactNode
  bookmarks?: BookmarkItem[]
  className?: string
}

export default function BookShell({ children, bookmarks, className }: BookShellProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const touchStartRef = useRef<{ x: number; y: number } | null>(null)
  const previousIsMobileRef = useRef(false)
  const slides = Children.toArray(children)
  const slideCount = slides.length
  const [currentPosition, setCurrentPosition] = useState(0)
  const [isMobile, setIsMobile] = useState(false)
  const [rightOverlay, setRightOverlay] = useState<React.ReactNode | null>(null)
  const totalPositions = isMobile ? slideCount * 2 : slideCount
  const currentSlide = isMobile ? Math.floor(currentPosition / 2) : currentPosition
  const currentPageSide = isMobile && currentPosition % 2 === 1 ? 'right' : 'left'
  const canPrev = currentPosition > 0
  const canNext = currentPosition < totalPositions - 1

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 767px)')
    const updateViewport = () => {
      setIsMobile(mediaQuery.matches)
    }

    updateViewport()
    mediaQuery.addEventListener('change', updateViewport)

    return () => {
      mediaQuery.removeEventListener('change', updateViewport)
    }
  }, [])

  useEffect(() => {
    if (previousIsMobileRef.current === isMobile) {
      return
    }

    setCurrentPosition((previous) => (isMobile ? previous * 2 : Math.floor(previous / 2)))
    previousIsMobileRef.current = isMobile
  }, [isMobile])

  useEffect(() => {
    rootRef.current?.style.setProperty('--sprite-fs', String(currentSlide * SPRITE_F))
  }, [currentSlide])

  function goToPosition(index: number) {
    const safeIndex = Math.max(0, Math.min(totalPositions - 1, index))
    setCurrentPosition(safeIndex)
  }

  function goToSlide(index: number) {
    goToPosition(isMobile ? index * 2 : index)
  }

  function go(dir: 'prev' | 'next') {
    goToPosition(currentPosition + (dir === 'next' ? 1 : -1))
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'ArrowLeft') { event.preventDefault(); goToPosition(currentPosition - 1); return }
    if (event.key === 'ArrowRight') { event.preventDefault(); goToPosition(currentPosition + 1); return }
    if (event.key === 'Home') { event.preventDefault(); goToSlide(0); return }
    if (event.key === 'End') { event.preventDefault(); goToPosition(totalPositions - 1) }
  }

  function handleTouchStart(event: React.TouchEvent<HTMLDivElement>) {
    if (!isMobile) {
      return
    }

    const touch = event.touches[0]
    touchStartRef.current = { x: touch.clientX, y: touch.clientY }
  }

  function handleTouchEnd(event: React.TouchEvent<HTMLDivElement>) {
    if (!isMobile || !touchStartRef.current) {
      return
    }

    const touch = event.changedTouches[0]
    const deltaX = touch.clientX - touchStartRef.current.x
    const deltaY = touch.clientY - touchStartRef.current.y
    touchStartRef.current = null

    if (Math.abs(deltaX) < 40 || Math.abs(deltaX) < Math.abs(deltaY)) {
      return
    }

    go(deltaX < 0 ? 'next' : 'prev')
  }

  return (
    <BookShellOverlayProvider value={{ currentSlide, setRightOverlay }}>
      <div
        ref={rootRef}
        className={`bs-root ${className ?? ''}`.trim()}
        style={{ '--slides': slideCount } as React.CSSProperties}
        data-mobile={isMobile ? 'true' : undefined}
      >
        <div className="bs-book">
          {/* Sprite is a sibling of the carousel (not inside it) so carousel
              overflow:hidden never clips it, and z-index:-1 works correctly
              within the isolation:isolate stacking context on .bs-book */}
          <div className="bs-sprite" aria-hidden="true" />

          <div
            className="bs-carousel"
            tabIndex={0}
            role="region"
            aria-label={isMobile ? '菜谱翻页区域，支持左右滑动切换单页' : '菜谱翻页区域'}
            onKeyDown={handleKeyDown}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            {slides.map((slide, index) => {
              const isActive = index === currentSlide
              const shouldMount = Math.abs(index - currentSlide) <= MOUNTED_SLIDE_RADIUS

              return (
                <div
                  key={`slide-${index}`}
                  className="bs-slide-wrapper"
                  data-active={isActive ? 'true' : undefined}
                  data-page-side={currentPageSide}
                  aria-hidden={!isActive}
                >
                  {shouldMount && (
                    <BookShellSlideIndexProvider index={index}>
                      {slide}
                    </BookShellSlideIndexProvider>
                  )}
                </div>
              )
            })}
          </div>

          {isMobile && totalPositions > 1 ? (
            <div className="bs-mobile-status" aria-live="polite">
              <span>{currentPosition + 1} / {totalPositions}</span>
              <span>左右滑动翻页</span>
            </div>
          ) : null}

          {rightOverlay ? <div className="bs-shell-right-overlay">{rightOverlay}</div> : null}

          <button
            type="button"
            className="bs-side-nav bs-side-nav-prev"
            onClick={() => go('prev')}
            disabled={!canPrev}
            aria-label={isMobile ? '上一单页' : '上一页'}
          >
            <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 4h2v2h-2V4zm-2 2h2v2h-2V6zm-2 2h2v2H8V8zm-2 2h2v2H6v-2zm2 2h2v2H8v-2zm2 2h2v2h-2v-2zm2 2h2v2h-2v-2z" />
            </svg>
          </button>

          <button
            type="button"
            className="bs-side-nav bs-side-nav-next"
            onClick={() => go('next')}
            disabled={!canNext}
            aria-label={isMobile ? '下一单页' : '下一页'}
          >
            <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
              <path d="M10 4h2v2h-2V4zm2 2h2v2h-2V6zm2 2h2v2h-2V8zm2 2h2v2h-2v-2zm-2 2h2v2h-2v-2zm-2 2h2v2h-2v-2zm-2 2h2v2h-2v-2z" />
            </svg>
          </button>

          {bookmarks && bookmarks.length > 0 && (
            <div className="bs-bookmarks" aria-label="章节书签">
              {bookmarks.map((bm, i) => (
                <button
                  key={i}
                  className={`bs-bookmark-tab${currentSlide === i ? ' active' : ''}`}
                  style={{ '--bm-color': BOOKMARK_COLORS[i % BOOKMARK_COLORS.length] } as React.CSSProperties}
                  onClick={() => goToSlide(i)}
                  title={bm.label}
                  aria-label={`跳转到 ${bm.label}`}
                >
                  <span>{bm.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </BookShellOverlayProvider>
  )
}
