'use client'

import './book-shell.css'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useRef, Children, useCallback, useEffect, useState } from 'react'
import { BookShellOverlayProvider, BookShellSlideIndexProvider } from './book-shell-overlay-context'

const MOUNTED_SLIDE_RADIUS = 2

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
  const carouselRef = useRef<HTMLDivElement>(null)
  const slides = Children.toArray(children)
  const slideCount = slides.length
  const [currentSlide, setCurrentSlide] = useState(0)
  const [rightOverlay, setRightOverlay] = useState<React.ReactNode | null>(null)
  const canPrev = currentSlide > 0
  const canNext = currentSlide < slideCount - 1
  const progressPercent = slideCount > 0 ? ((currentSlide + 1) / slideCount) * 100 : 0

  const updateNavState = useCallback(() => {
    const el = carouselRef.current
    if (!el) return
    if (el.clientWidth > 0) {
      const nextSlide = Math.round(el.scrollLeft / el.clientWidth)
      setCurrentSlide(Math.max(0, Math.min(slideCount - 1, nextSlide)))
    }
  }, [slideCount])

  useEffect(() => {
    const el = carouselRef.current
    if (!el) return
    el.addEventListener('scroll', updateNavState, { passive: true })
    updateNavState()
    return () => el.removeEventListener('scroll', updateNavState)
  }, [updateNavState])

  function scrollToSlide(index: number) {
    const el = carouselRef.current
    if (!el) return
    const safeIndex = Math.max(0, Math.min(slideCount - 1, index))
    el.scrollTo({ left: el.clientWidth * safeIndex, behavior: 'smooth' })
  }

  function scrollBy(dir: 'prev' | 'next') {
    const delta = dir === 'next' ? 1 : -1
    scrollToSlide(currentSlide + delta)
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'ArrowLeft') {
      event.preventDefault()
      scrollToSlide(currentSlide - 1)
      return
    }

    if (event.key === 'ArrowRight') {
      event.preventDefault()
      scrollToSlide(currentSlide + 1)
      return
    }

    if (event.key === 'Home') {
      event.preventDefault()
      scrollToSlide(0)
      return
    }

    if (event.key === 'End') {
      event.preventDefault()
      scrollToSlide(slideCount - 1)
    }
  }

  return (
    <BookShellOverlayProvider value={{ currentSlide, setRightOverlay }}>
      <div
        className={`bs-root ${className ?? ''}`.trim()}
        style={{ '--slides': slideCount } as React.CSSProperties}
      >
        <div className="bs-book">
          {/* Sprite is a sibling of the carousel (not inside it) so carousel
              overflow:auto never clips it, and z-index:-1 works correctly
              within the isolation:isolate stacking context on .bs-book */}
          <div className="bs-sprite" aria-hidden="true" />

          <div
            ref={carouselRef}
            className="bs-carousel"
            tabIndex={0}
            role="region"
            aria-label="菜谱翻页区域"
            onKeyDown={handleKeyDown}
          >
            {slides.map((slide, index) => {
              const shouldMount = Math.abs(index - currentSlide) <= MOUNTED_SLIDE_RADIUS

              return shouldMount ? (
                <BookShellSlideIndexProvider key={`slide-${index}`} index={index}>
                  {slide}
                </BookShellSlideIndexProvider>
              ) : (
                <div key={`placeholder-${index}`} className="bs-carousel-item" aria-hidden="true" />
              )
            })}
          </div>

          {rightOverlay ? <div className="bs-shell-right-overlay">{rightOverlay}</div> : null}

          <div className="bs-nav" aria-label="翻页控制">
          <button
            type="button"
            className="bs-nav-btn"
            onClick={() => scrollBy('prev')}
            disabled={!canPrev}
            aria-label="上一页"
          >
            <ChevronLeft size={16} />
            <span>Prev</span>
          </button>

          <div className="bs-progress-shell">
            <div className="bs-progress-meta" aria-hidden="true">
              <span>Page</span>
              <span>{currentSlide + 1}/{slideCount}</span>
            </div>
            <div
              className="bs-progress"
              role="progressbar"
              aria-label="阅读进度"
              aria-valuemin={1}
              aria-valuemax={slideCount}
              aria-valuenow={Math.min(slideCount, currentSlide + 1)}
            >
              <div className="bs-progress-fill" style={{ width: `${progressPercent}%` }} />
            </div>
          </div>

          <button
            type="button"
            className="bs-nav-btn"
            onClick={() => scrollBy('next')}
            disabled={!canNext}
            aria-label="下一页"
          >
            <span>Next</span>
            <ChevronRight size={16} />
          </button>
          </div>

          {bookmarks && bookmarks.length > 0 && (
            <div className="bs-bookmarks" aria-label="章节书签">
              {bookmarks.map((bm, i) => (
                <button
                  key={i}
                  className={`bs-bookmark-tab${currentSlide === i ? ' active' : ''}`}
                  style={{ '--bm-color': BOOKMARK_COLORS[i % BOOKMARK_COLORS.length] } as React.CSSProperties}
                  onClick={() => scrollToSlide(i)}
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
