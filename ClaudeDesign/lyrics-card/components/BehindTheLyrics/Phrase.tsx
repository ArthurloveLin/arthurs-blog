'use client'
// components/BehindTheLyrics/Phrase.tsx

import { useRef } from 'react'
import { HighlightStyle } from '@/lib/types'
import s from './lyrics.module.css'

interface Props {
  id: string
  text: string
  highlightStyle: HighlightStyle
  isActive: boolean
  isPinned: boolean
  onEnter: (id: string, el: HTMLElement, e: MouseEvent) => void
  onLeave: (id: string) => void
  onClick: (id: string) => void
}

const hlClass: Record<HighlightStyle, string> = {
  dashed: s.hlDashed,
  solid:  s.hlSolid,
  fill:   s.hlFill,
  edge:   s.hlEdge,
}

export function Phrase({ id, text, highlightStyle, isActive, isPinned, onEnter, onLeave, onClick }: Props) {
  const ref = useRef<HTMLSpanElement>(null)

  const classes = [
    s.phrase,
    hlClass[highlightStyle],
    isActive  ? s.active  : '',
    isPinned  ? s.pinned  : '',
  ].filter(Boolean).join(' ')

  return (
    <span
      ref={ref}
      data-phrase={id}
      className={classes}
      onMouseEnter={(e) => ref.current && onEnter(id, ref.current, e.nativeEvent)}
      onMouseMove={(e)  => ref.current && onEnter(id, ref.current, e.nativeEvent)}
      onMouseLeave={() => onLeave(id)}
      onClick={() => onClick(id)}
    >
      {text}
    </span>
  )
}
