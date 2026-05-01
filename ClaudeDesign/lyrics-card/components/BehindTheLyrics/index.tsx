'use client'
// components/BehindTheLyrics/index.tsx
// Main state container — all interaction logic lives here.
// Child components are pure/display-only, driven by props.

import { useCallback, useEffect, useRef, useState } from 'react'
import { Track, AnnotationMap, ReaderConfig } from '@/lib/types'
import { getAnnotationOrder } from '@/data/track'
import { Backdrop } from './Backdrop'
import { Header } from './Header'
import { Phrase } from './Phrase'
import { AnnotationCard } from './AnnotationCard'
import { Popover } from './Popover'
import s from './lyrics.module.css'

// Stash mouse events on the anchor element as a side-channel for the Popover.
type AnchorEl = HTMLElement & { _mouseEvent?: MouseEvent }

interface Props {
  track: Track
  annotations: AnnotationMap
  config?: Partial<ReaderConfig>
}

const DEFAULT_CONFIG: ReaderConfig = {
  highlightStyle:   'dashed',
  popoverPosition:  'follow',
  showSectionLabels: true,
  lyricSize:        22,
}

export function BehindTheLyricsPage({ track, annotations, config: configOverride }: Props) {
  const config: ReaderConfig = { ...DEFAULT_CONFIG, ...configOverride }

  // ── State ──────────────────────────────────────────────────────────────
  const [hoveredPhrase, setHoveredPhrase] = useState<string | null>(null)
  const [pinnedId,      setPinnedId]      = useState<string | null>(null)
  const [anchorEl,      setAnchorEl]      = useState<AnchorEl | null>(null)

  const cardRefs = useRef<Record<string, HTMLElement>>({})

  const activeId = pinnedId ?? hoveredPhrase

  // Document order of annotation refs — stable reference.
  const order = getAnnotationOrder(track)

  // ── Phrase handlers ────────────────────────────────────────────────────
  const handlePhraseEnter = useCallback(
    (id: string, el: HTMLElement, e: MouseEvent) => {
      if (pinnedId) return
      ;(el as AnchorEl)._mouseEvent = e
      setHoveredPhrase(id)
      setAnchorEl(el as AnchorEl)
    },
    [pinnedId],
  )

  const handlePhraseLeave = useCallback(
    (_id: string) => {
      if (pinnedId) return
      setHoveredPhrase(null)
      setAnchorEl(null)
    },
    [pinnedId],
  )

  const handlePhraseClick = useCallback((id: string) => {
    setPinnedId((prev) => (prev === id ? null : id))
    const el = document.querySelector<HTMLElement>(`[data-phrase="${id}"]`)
    if (el) setAnchorEl(el as AnchorEl)
    // Scroll matching card into view
    const card = cardRefs.current[id]
    if (card) card.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [])

  // ── Card handlers ──────────────────────────────────────────────────────
  const handleCardEnter = useCallback(
    (id: string) => {
      if (pinnedId) return
      setHoveredPhrase(id)
      const phraseEl = document.querySelector<HTMLElement>(`[data-phrase="${id}"]`)
      if (phraseEl) {
        setAnchorEl(phraseEl as AnchorEl)
        phraseEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
      }
    },
    [pinnedId],
  )

  const handleCardLeave = useCallback(() => {
    if (pinnedId) return
    setHoveredPhrase(null)
  }, [pinnedId])

  const handleCardClick = useCallback((id: string) => {
    setPinnedId((prev) => (prev === id ? null : id))
    const phraseEl = document.querySelector<HTMLElement>(`[data-phrase="${id}"]`)
    if (phraseEl) {
      setAnchorEl(phraseEl as AnchorEl)
      phraseEl.scrollIntoView({ block: 'center', behavior: 'smooth' })
    }
  }, [])

  // ── Keyboard ───────────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPinnedId(null)
        setHoveredPhrase(null)
        setAnchorEl(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // ── CSS variable injection from album palette ──────────────────────────
  const paletteVars = {
    '--bg':          track.palette.bg,
    '--bg-deep':     track.palette.bgDeep,
    '--paper':       track.palette.paper,
    '--ink':         track.palette.ink,
    '--ink-2':       track.palette.ink2,
    '--ink-3':       track.palette.ink3,
    '--accent':      track.palette.accent,
    '--accent-soft': track.palette.accentSoft,
    '--accent-2':    track.palette.accent2,
    '--warm':        track.palette.warm,
    '--line':        track.palette.line,
    '--lyric-size':  `${config.lyricSize}px`,
  } as React.CSSProperties

  const popData = activeId ? annotations[activeId] : null

  return (
    <div className={s.page} style={paletteVars}>
      <Backdrop />

      <main className={s.reader}>
        <Header
          track={track}
          pinnedId={pinnedId}
          onClearPin={() => { setPinnedId(null); setHoveredPhrase(null); setAnchorEl(null) }}
        />

        <div className={s.grid}>
          {/* Left: lyrics */}
          <section className={s.lyrics} aria-label="Lyrics">
            {track.sections.map((sec, si) => (
              <div className={s.section} key={si}>
                {sec.label && config.showSectionLabels && (
                  <div className={s.sectionLabel}>
                    <span className={s.sectionRule} />
                    <span>{sec.label}</span>
                  </div>
                )}
                {sec.lines.map((line, li) => (
                  <p className={s.line} key={li}>
                    {line.map((seg, i) =>
                      seg.ref ? (
                        <Phrase
                          key={i}
                          id={seg.ref}
                          text={seg.text}
                          highlightStyle={config.highlightStyle}
                          isActive={activeId === seg.ref}
                          isPinned={pinnedId === seg.ref}
                          onEnter={handlePhraseEnter}
                          onLeave={handlePhraseLeave}
                          onClick={handlePhraseClick}
                        />
                      ) : (
                        <span key={i}>{seg.text}</span>
                      ),
                    )}
                  </p>
                ))}
              </div>
            ))}
          </section>

          {/* Right: annotation rail */}
          <aside className={s.rail} aria-label="Annotations">
            <div className={s.railHd}>
              <span className={s.railEyebrow}>Track Insights</span>
              <span className={s.railCount}>{order.length} annotations</span>
            </div>
            <div className={s.railList}>
              {order.map((id, idx) => (
                <div
                  key={id}
                  ref={(el) => { if (el) cardRefs.current[id] = el }}
                >
                  <AnnotationCard
                    id={id}
                    index={idx + 1}
                    data={annotations[id]}
                    isActive={activeId === id}
                    isPinned={pinnedId === id}
                    isDimmed={!!activeId && activeId !== id}
                    onEnter={handleCardEnter}
                    onLeave={handleCardLeave}
                    onClick={handleCardClick}
                  />
                </div>
              ))}
            </div>
          </aside>
        </div>
      </main>

      <Popover
        open={!!activeId && !!anchorEl}
        anchor={anchorEl}
        data={popData}
        pinned={!!pinnedId}
        position={config.popoverPosition}
        onClose={() => { setPinnedId(null); setHoveredPhrase(null); setAnchorEl(null) }}
      />
    </div>
  )
}
