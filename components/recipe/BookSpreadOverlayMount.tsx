'use client'

import { useEffect } from 'react'
import { useBookShellOverlay, useBookShellSlideIndex } from './book-shell-overlay-context'

interface Props {
  overlay: React.ReactNode | null
}

export default function BookSpreadOverlayMount({ overlay }: Props) {
  const { currentSlide, setRightOverlay } = useBookShellOverlay()
  const slideIndex = useBookShellSlideIndex()

  useEffect(() => {
    if (currentSlide === slideIndex) {
      setRightOverlay(overlay)
    }

    return () => {
      if (currentSlide === slideIndex) {
        setRightOverlay(null)
      }
    }
  }, [currentSlide, overlay, setRightOverlay, slideIndex])

  return null
}