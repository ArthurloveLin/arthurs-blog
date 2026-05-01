'use client'
// components/BehindTheLyrics/Header.tsx

import { Track } from '@/lib/types'
import s from './lyrics.module.css'

interface Props {
  track: Track
  pinnedId: string | null
  onClearPin: () => void
}

export function Header({ track, pinnedId, onClearPin }: Props) {
  return (
    <header className={s.hd}>
      <div className={s.hdL}>
        <div className={s.hdEyebrow}>
          <span className={s.hdPulse} />
          <span>Now Playing</span>
        </div>
        <div className={s.hdTitleRow}>
          <h1 className={s.hdTitle}>Behind the Lyrics</h1>
          <span className={s.hdTag}>PREMIUM</span>
        </div>
        <div className={s.hdMeta}>
          <span className={s.hdTrack}>{track.title}</span>
          <span className={s.hdSep}>·</span>
          <span>{track.artist}</span>
          <span className={s.hdSep}>·</span>
          <span>{track.album}</span>
        </div>
      </div>

      <div className={s.hdR}>
        {pinnedId && (
          <button className={s.hdClear} onClick={onClearPin}>
            <span>Clear pin</span>
            <kbd>Esc</kbd>
          </button>
        )}
        <div className={s.hdBrand}>
          <span className={s.hdBrandName}>GENIUS</span>
          <span className={s.hdBrandBars}>
            <i /><i /><i />
          </span>
        </div>
      </div>
    </header>
  )
}
