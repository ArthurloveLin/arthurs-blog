'use client'

import BookSpreadOverlayMount from './BookSpreadOverlayMount'
import { useBookShellRenderMode, useOptionalBookShellSlideIndex } from './book-shell-overlay-context'

interface BookSpreadProps {
  left: React.ReactNode
  right: React.ReactNode
  rightOverlay?: React.ReactNode
  motionVariant?: 'page' | 'anchored'
}

export default function BookSpread({ left, right, rightOverlay, motionVariant = 'page' }: BookSpreadProps) {
  const renderMode = useBookShellRenderMode()
  const slideIndex = useOptionalBookShellSlideIndex()

  if (renderMode === 'page-turn' && slideIndex != null) {
    const leftPageNumber = slideIndex * 2 + 2
    const rightPageNumber = leftPageNumber + 1
    const isFirstSpread = slideIndex === 0

    return (
      <>
        <BookSpreadOverlayMount overlay={rightOverlay ?? null} />
        <div
          className={`rt-page rt-page-sheet rt-page-sheet-left page-num-${leftPageNumber}`}
          data-fallback-visible={isFirstSpread ? 'true' : undefined}
          data-page-side="left"
        >
          <div className="rt-page-surface">
            <div className="bs-left-page rt-page-pane">{left}</div>
          </div>
        </div>

        <div
          className={`rt-page rt-page-sheet rt-page-sheet-right page-num-${rightPageNumber}`}
          data-fallback-visible={isFirstSpread ? 'true' : undefined}
          data-page-side="right"
        >
          <div className="rt-page-surface">
            <div className="bs-right-page rt-page-pane">
              <div className="bs-right-page-scroll">{right}</div>
            </div>
          </div>
        </div>
      </>
    )
  }

  return (
    <div className="bs-carousel-item">
      <BookSpreadOverlayMount overlay={rightOverlay ?? null} />
      <div className="bs-page-container" data-motion={motionVariant}>
        <div className="bs-left-page">{left}</div>
        <div className="bs-right-page">
          <div className="bs-right-page-scroll">{right}</div>
        </div>
      </div>
    </div>
  )
}
