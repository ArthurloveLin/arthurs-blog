'use client'

import './book-shell.css'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useRef, Children, useState } from 'react'
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
  const slides = Children.toArray(children)
  const slideCount = slides.length
  const [currentSlide, setCurrentSlide] = useState(0)
  const [rightOverlay, setRightOverlay] = useState<React.ReactNode | null>(null)
  const canPrev = currentSlide > 0
  const canNext = currentSlide < slideCount - 1
  const progressPercent = slideCount > 0 ? ((currentSlide + 1) / slideCount) * 100 : 0

  function goToSlide(index: number) {
    const safeIndex = Math.max(0, Math.min(slideCount - 1, index))
    setCurrentSlide(safeIndex)
    rootRef.current?.style.setProperty('--sprite-fs', String(safeIndex * SPRITE_F))
  }

  function go(dir: 'prev' | 'next') {
    goToSlide(currentSlide + (dir === 'next' ? 1 : -1))
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'ArrowLeft') { event.preventDefault(); goToSlide(currentSlide - 1); return }
    if (event.key === 'ArrowRight') { event.preventDefault(); goToSlide(currentSlide + 1); return }
    if (event.key === 'Home') { event.preventDefault(); goToSlide(0); return }
    if (event.key === 'End') { event.preventDefault(); goToSlide(slideCount - 1) }
  }

  return (
    <BookShellOverlayProvider value={{ currentSlide, setRightOverlay }}>
      <div
        ref={rootRef}
        className={`bs-root ${className ?? ''}`.trim()}
        style={{ '--slides': slideCount } as React.CSSProperties}
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
            aria-label="菜谱翻页区域"
            onKeyDown={handleKeyDown}
          >
            {slides.map((slide, index) => {
              const isActive = index === currentSlide
              const shouldMount = Math.abs(index - currentSlide) <= MOUNTED_SLIDE_RADIUS

              return (
                <div
                  key={`slide-${index}`}
                  className="bs-slide-wrapper"
                  data-active={isActive ? 'true' : undefined}
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

          {rightOverlay ? <div className="bs-shell-right-overlay">{rightOverlay}</div> : null}

          <div className="bs-nav" aria-label="翻页控制">
          <button
            type="button"
            className="bs-nav-btn"
            onClick={() => go('prev')}
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
            onClick={() => go('next')}
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
