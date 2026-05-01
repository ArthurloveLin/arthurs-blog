'use client'
// components/BehindTheLyrics/AnnotationCard.tsx

import { Annotation } from '@/lib/types'
import s from './lyrics.module.css'

interface Props {
  id: string
  index: number           // 1-based display number
  data: Annotation
  isActive: boolean
  isPinned: boolean
  isDimmed: boolean
  onEnter: (id: string) => void
  onLeave: () => void
  onClick: (id: string) => void
}

export function AnnotationCard({ id, index, data, isActive, isPinned, isDimmed, onEnter, onLeave, onClick }: Props) {
  const classes = [
    s.ann,
    isActive ? s.annActive : '',
    isPinned ? s.annPinned : '',
    isDimmed ? s.annDimmed : '',
  ].filter(Boolean).join(' ')

  return (
    <article
      data-card={id}
      className={classes}
      onMouseEnter={() => onEnter(id)}
      onMouseLeave={() => onLeave()}
      onClick={() => onClick(id)}
    >
      <header className={s.annHd}>
        <span className={s.annNum}>{String(index).padStart(2, '0')}</span>
        <span className={s.annQuote}>{data.quote}</span>
      </header>
      <p className={s.annBody}>{data.body}</p>
      <footer className={s.annFt}>
        <span className={s.annHelpful}>↑ {data.helpful}</span>
        <span className={s.annMeta}>Annotation · Genius</span>
      </footer>
    </article>
  )
}
