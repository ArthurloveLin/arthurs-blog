'use client'

import { useEffect, useRef } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import gsap from 'gsap'

import styles from './PosterShell.module.css'

const RESTING_SHADOW =
  '0 14px 22px -10px rgba(15, 10, 0, 0.28), inset 0 20px 28px -10px rgba(0, 0, 0, 0.22)'
const LIFTED_SHADOW =
  '-2px 22px 48px -6px rgba(0, 0, 0, 0.2), inset 0 16px 22px -10px rgba(0, 0, 0, 0.18)'

interface PosterShellProps {
  rotation: number
  pinColor?: string
  tapeRotation?: number
  width?: number
  children: ReactNode
}

export default function PosterShell({
  rotation,
  pinColor = '#c0392b',
  tapeRotation = -1.5,
  width = 158,
  children,
}: PosterShellProps) {
  const surfaceRef = useRef<HTMLDivElement>(null)
  const paperRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!surfaceRef.current) return
    gsap.set(surfaceRef.current, { rotation })
  }, [rotation])

  function handleMouseEnter() {
    const surface = surfaceRef.current
    const paper = paperRef.current
    if (!surface || !paper) return

    gsap.killTweensOf(surface)
    gsap.killTweensOf(paper)

    const tl = gsap.timeline()
    tl.to(surface, { rotateX: 6, duration: 0.22 })
      .to(paper, { boxShadow: LIFTED_SHADOW, duration: 0.22 }, 0)
      .to(
        surface,
        {
          rotation: rotation * 0.25,
          rotateX: 4,
          scale: 1.04,
          y: -8,
          ease: 'elastic.out(0.75, 0.5)',
          duration: 0.65,
        },
        0.14
      )
      .to(paper, { boxShadow: LIFTED_SHADOW, ease: 'elastic.out(0.75, 0.5)', duration: 0.65 }, 0.14)
  }

  function handleMouseLeave() {
    const surface = surfaceRef.current
    const paper = paperRef.current
    if (!surface || !paper) return

    gsap.killTweensOf(surface)
    gsap.killTweensOf(paper)

    const tl = gsap.timeline()
    tl.to(surface, { rotateX: 12, duration: 0.18 })
      .to(paper, { boxShadow: RESTING_SHADOW, duration: 0.18 }, 0)
      .to(
        surface,
        {
          rotation,
          rotateX: 0,
          scale: 1,
          y: 0,
          ease: 'elastic.out(0.8, 0.5)',
          duration: 0.6,
        },
        0.12
      )
      .to(paper, { boxShadow: RESTING_SHADOW, ease: 'elastic.out(0.8, 0.5)', duration: 0.6 }, 0.12)
  }

  const pinStyle: CSSProperties = {
    background: `radial-gradient(circle at 38% 35%, ${pinColor}cc 0%, ${pinColor} 55%, ${pinColor}aa 100%)`,
  }

  const tapeStyle: CSSProperties = {
    transform: `translateX(-50%) translateY(-46%) rotate(${tapeRotation}deg)`,
  }

  return (
    <div className={styles.posterWrap} style={{ width: `${width}px` }}>
      <div className={styles.pin} style={pinStyle} />
      <div className={styles.tape} style={tapeStyle} />
      <div
        ref={surfaceRef}
        className={styles.posterSurface}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <div ref={paperRef} className={styles.poster}>
          {children}
        </div>
      </div>
    </div>
  )
}
