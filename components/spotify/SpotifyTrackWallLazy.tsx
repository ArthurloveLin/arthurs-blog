'use client'

import dynamic from 'next/dynamic'
import type { ComponentProps } from 'react'

import type SpotifyTrackWall from './SpotifyTrackWall'

type WallProps = ComponentProps<typeof SpotifyTrackWall>

// The wall runs a heavy synchronous layout (generateWallLayout) and mounts
// ~100-140 absolutely-positioned tiles. It is a fully client-driven, interactive
// component (the SSR pass is thrown away and recomputed on mount once the real
// viewport is measured), so rendering it on the server only inflates the HTML and
// burns server CPU. Load it client-side only.
//
// Fallback height = viewportHeight (LAYOUT_PRESETS in SpotifyTrackWall) + ~62px
// footer, so the reserved space matches the mounted wall and there is no layout shift.
const FALLBACK_HEIGHT: Record<'default' | 'compact', number> = {
  default: 680 + 62,
  compact: 616 + 62,
}

const LazyTrackWall = dynamic(() => import('./SpotifyTrackWall'), { ssr: false })

export default function SpotifyTrackWallLazy(props: WallProps) {
  const minHeight = FALLBACK_HEIGHT[props.preset ?? 'default']

  return (
    <div style={{ minHeight }}>
      <LazyTrackWall {...props} />
    </div>
  )
}
