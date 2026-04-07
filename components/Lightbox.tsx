'use client'

import { useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'

interface LightboxProps {
  imageUrl: string
  detailUrl: string
  onClose: () => void
  onPrev?: () => void
  onNext?: () => void
}

export default function Lightbox({ imageUrl, detailUrl, onClose, onPrev, onNext }: LightboxProps) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') onPrev?.()
      if (e.key === 'ArrowRight') onNext?.()
    }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose, onPrev, onNext])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
      onClick={onClose}
    >
      {/* Prev */}
      {onPrev && (
        <button
          onClick={(e) => { e.stopPropagation(); onPrev() }}
          className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center rounded-full bg-white/10 text-white text-xl hover:bg-white/20 transition-colors"
        >
          ‹
        </button>
      )}

      {/* Image */}
      <div
        className="relative w-full max-w-lg mx-12 aspect-square"
        onClick={(e) => e.stopPropagation()}
      >
        <Image
          src={imageUrl}
          alt="查看大图"
          fill
          className="object-contain"
          sizes="(max-width: 640px) 100vw, 512px"
          priority
        />
      </div>

      {/* Next */}
      {onNext && (
        <button
          onClick={(e) => { e.stopPropagation(); onNext() }}
          className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center rounded-full bg-white/10 text-white text-xl hover:bg-white/20 transition-colors"
        >
          ›
        </button>
      )}

      {/* Top bar */}
      <div className="absolute top-4 right-4 flex gap-2">
        {detailUrl && (
          <Link
            href={detailUrl}
            onClick={(e) => e.stopPropagation()}
            className="px-3 py-1.5 bg-white/10 text-white text-xs rounded-full hover:bg-white/20 transition-colors"
          >
            查看详情
          </Link>
        )}
        <button
          onClick={onClose}
          className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
        >
          ×
        </button>
      </div>
    </div>
  )
}
