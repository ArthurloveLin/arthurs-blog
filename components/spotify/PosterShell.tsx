'use client'

import type { CSSProperties, ReactNode } from 'react'

import { usePosterHover } from './usePosterHover'
import styles from './PosterShell.module.css'

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
  const { surfaceRef, paperRef, handleMouseEnter, handleMouseLeave } = usePosterHover(rotation)

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
