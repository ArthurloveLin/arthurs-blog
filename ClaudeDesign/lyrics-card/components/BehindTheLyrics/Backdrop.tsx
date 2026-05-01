// components/BehindTheLyrics/Backdrop.tsx
// Decorative: gradient wash + SVG noise grain + two soft glows.
// Server component — no interactivity needed.

import s from './lyrics.module.css'

export function Backdrop() {
  return (
    <div className={s.bg} aria-hidden="true">
      <div className={s.bgWash} />
      <div className={s.bgGrain} />
      <div className={`${s.bgGlow} ${s.bgGlow1}`} />
      <div className={`${s.bgGlow} ${s.bgGlow2}`} />
    </div>
  )
}
