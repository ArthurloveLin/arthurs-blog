'use client'
// components/BehindTheLyrics/Popover.tsx
// Fixed-position floating annotation card.
// Follows cursor while not pinned; anchors to phrase element when pinned.

import { useEffect, useRef, useState } from 'react'
import { Annotation, PopoverPosition } from '@/lib/types'
import s from './lyrics.module.css'

// We stash the last mousemove event on the anchor element as a side-channel
// so the popover can follow the cursor without prop-drilling every mouse position.
type AnchorEl = HTMLElement & { _mouseEvent?: MouseEvent }

interface Props {
  open: boolean
  anchor: AnchorEl | null
  data: Annotation | null
  pinned: boolean
  position: PopoverPosition
  onClose: () => void
}

interface Coords { left: number; top: number }

export function Popover({ open, anchor, data, pinned, position, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [coords, setCoords] = useState<Coords | null>(null)

  useEffect(() => {
    if (!open || !anchor) { setCoords(null); return }

    const popW = 360
    const pad  = 12

    const compute = () => {
      const r = anchor.getBoundingClientRect()
      let left: number, top: number

      if (position === 'follow' && !pinned && anchor._mouseEvent) {
        left = anchor._mouseEvent.clientX + 18
        top  = anchor._mouseEvent.clientY + 18
      } else {
        left = r.right + pad
        top  = r.top - 4
      }

      // Clamp to viewport
      const vw = window.innerWidth
      const vh = window.innerHeight
      const popH = ref.current?.offsetHeight ?? 220
      if (left + popW > vw - 16) left = r.left - popW - pad
      if (left < 16) left = 16
      if (top + popH > vh - 16) top = vh - popH - 16
      if (top < 16) top = 16

      setCoords({ left, top })
    }

    compute()

    if (!pinned) {
      const onMove = (e: MouseEvent) => {
        if (anchor) anchor._mouseEvent = e
        compute()
      }
      window.addEventListener('mousemove', onMove)
      return () => window.removeEventListener('mousemove', onMove)
    }
  }, [open, anchor, pinned, position])

  if (!open || !data || !coords) return null

  return (
    <div
      ref={ref}
      className={`${s.pop} ${pinned ? s.popPinned : ''}`}
      style={{ left: coords.left, top: coords.top }}
      onMouseLeave={!pinned ? onClose : undefined}
    >
      <div className={s.popEyebrow}>
        <span className={s.popDot} />
        <span>Annotation</span>
        {pinned && (
          <button className={s.popX} onClick={onClose} aria-label="Close">✕</button>
        )}
      </div>
      <div className={s.popQuote}>"{data.quote}"</div>
      <p className={s.popBody}>{data.body}</p>
      <div className={s.popFt}>
        <span>↑ {data.helpful} found this helpful</span>
        <span className={s.popSource}>Genius</span>
      </div>
    </div>
  )
}
