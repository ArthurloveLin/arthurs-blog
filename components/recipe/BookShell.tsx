'use client'

import './book-shell.css'
import { useRef, Children, useCallback, useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

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
  const [canPrev, setCanPrev] = useState(false)
  const [canNext, setCanNext] = useState(slideCount > 1)
  const [currentSlide, setCurrentSlide] = useState(0)

  const updateNavState = useCallback(() => {
    const el = carouselRef.current
    if (!el) return
    setCanPrev(el.scrollLeft > 4)
    setCanNext(el.scrollLeft < el.scrollWidth - el.clientWidth - 4)
    if (el.clientWidth > 0) {
      setCurrentSlide(Math.round(el.scrollLeft / el.clientWidth))
    }
  }, [])

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
    el.scrollTo({ left: el.clientWidth * index, behavior: 'smooth' })
  }

  function scrollBy(dir: 'prev' | 'next') {
    const el = carouselRef.current
    if (!el) return
    el.scrollBy({ left: dir === 'next' ? el.clientWidth : -el.clientWidth, behavior: 'smooth' })
  }

  return (
    <div
      className={`bs-root ${className ?? ''}`}
      style={{ '--slides': slideCount } as React.CSSProperties}
    >
      <div className="bs-book">
        {/* Sprite is a sibling of the carousel (not inside it) so carousel
            overflow:auto never clips it, and z-index:-1 works correctly
            within the isolation:isolate stacking context on .bs-book */}
        <div className="bs-sprite" aria-hidden="true" />

        <div ref={carouselRef} className="bs-carousel">
          {slides.map((slide, index) => {
            const shouldMount = Math.abs(index - currentSlide) <= MOUNTED_SLIDE_RADIUS

            return shouldMount ? (
              slide
            ) : (
              <div key={`placeholder-${index}`} className="bs-carousel-item" aria-hidden="true" />
            )
          })}
        </div>

        <div className="bs-nav">
          <button
            className="bs-nav-btn"
            onClick={() => scrollBy('prev')}
            disabled={!canPrev}
            aria-label="上一页"
          >
            <ChevronLeft size={18} />
          </button>
          <div className="bs-progress" role="progressbar" aria-label="阅读进度" />
          <button
            className="bs-nav-btn"
            onClick={() => scrollBy('next')}
            disabled={!canNext}
            aria-label="下一页"
          >
            <ChevronRight size={18} />
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
  )
}
