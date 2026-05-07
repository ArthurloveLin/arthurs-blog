'use client'

import './book-shell.css'
import { useRef, Children, useCallback, useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface BookShellProps {
  children: React.ReactNode
  className?: string
}

export default function BookShell({ children, className }: BookShellProps) {
  const carouselRef = useRef<HTMLDivElement>(null)
  const slideCount = Children.count(children)
  const [canPrev, setCanPrev] = useState(false)
  const [canNext, setCanNext] = useState(slideCount > 1)

  const updateNavState = useCallback(() => {
    const el = carouselRef.current
    if (!el) return
    setCanPrev(el.scrollLeft > 4)
    setCanNext(el.scrollLeft < el.scrollWidth - el.clientWidth - 4)
  }, [])

  useEffect(() => {
    const el = carouselRef.current
    if (!el) return
    el.addEventListener('scroll', updateNavState, { passive: true })
    updateNavState()
    return () => el.removeEventListener('scroll', updateNavState)
  }, [updateNavState])

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
        <div
          ref={carouselRef}
          className="bs-carousel"
        >
          <div className="bs-sprite" aria-hidden="true" />
          {children}
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
      </div>
    </div>
  )
}
