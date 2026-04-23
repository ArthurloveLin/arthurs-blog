'use client'

import { Fragment, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { ExternalLink, Loader2, Music2 } from 'lucide-react'

import styles from './SpotifyTrackWall.module.css'

const DEFAULT_HOVER_COLOR: [number, number, number] = [16, 185, 129]
const colorCache = new Map<string, [number, number, number]>()
const CAMERA_SETTLE_RATE = 9
const MOTION_EPSILON = 2

type WallPreset = 'default' | 'compact'

interface LayoutOptions {
  baseTileSize: number
  gap: number
  colStep: number
  rowStep: number
  maxPanSpeed: number
  blurStrength: number
  viewportHeight: number
  edgeThresholdRatio: number
}

const LAYOUT_PRESETS: Record<WallPreset, LayoutOptions> = {
  default: {
    baseTileSize: 118,
    gap: 18,
    colStep: 156,
    rowStep: 126,
    maxPanSpeed: 520,
    blurStrength: 14,
    viewportHeight: 560,
    edgeThresholdRatio: 0.18,
  },
  compact: {
    baseTileSize: 100,
    gap: 16,
    colStep: 136,
    rowStep: 112,
    maxPanSpeed: 500,
    blurStrength: 12,
    viewportHeight: 520,
    edgeThresholdRatio: 0.2,
  },
}

export interface SpotifyTrackWallItem {
  id: string
  order: number
  title: string
  artists: string
  album: string
  imageUrl: string | null
  href?: string | null
  meta: string[]
}

interface SpotifyTrackWallProps {
  items: SpotifyTrackWallItem[]
  emptyMessage: string
  preset?: WallPreset
  footerStats: Array<{ label: string; value: string }>
  footerHint?: string
  loadMore?: {
    hasMore: boolean
    isLoading: boolean
    onLoadMore: () => void
    label: string
  }
}

interface WallLayoutItem {
  item: SpotifyTrackWallItem
  x: number
  y: number
  width: number
  height: number
}

interface WallLayout {
  items: WallLayoutItem[]
  totalWidth: number
  totalHeight: number
  focusPoint: { x: number; y: number }
  options: LayoutOptions
}

function tileSize(width: number, height: number) {
  return {
    width: Math.round(width),
    height: Math.round(height),
  }
}

function getTileSize(order: number, preset: WallPreset) {
  const options = LAYOUT_PRESETS[preset]

  if (order === 1) return tileSize(options.baseTileSize * 1.62, options.baseTileSize * 1.62)
  if (order <= 3) return tileSize(options.baseTileSize * 1.34, options.baseTileSize * 1.34)
  if (order <= 6) {
    return order % 2 === 0
      ? tileSize(options.baseTileSize * 1.42, options.baseTileSize * 1.06)
      : tileSize(options.baseTileSize * 1.06, options.baseTileSize * 1.42)
  }
  if (order <= 12) {
    return order % 3 === 0
      ? tileSize(options.baseTileSize * 1.2, options.baseTileSize * 1.2)
      : tileSize(options.baseTileSize, options.baseTileSize)
  }
  if (order <= 18 && order % 5 === 0) {
    return tileSize(options.baseTileSize * 1.24, options.baseTileSize * 0.94)
  }
  if (order <= 18 && order % 4 === 0) {
    return tileSize(options.baseTileSize * 0.94, options.baseTileSize * 1.24)
  }

  return tileSize(options.baseTileSize * 0.92, options.baseTileSize * 0.92)
}

function createHiveCandidates(itemCount: number, options: LayoutOptions) {
  const radius = Math.max(6, Math.ceil(Math.sqrt(itemCount + 1)) * 4)
  const candidates = [] as Array<{ centerX: number; centerY: number; distance: number }>

  for (let row = -radius; row <= radius; row += 1) {
    const rowOffset = Math.abs(row) % 2 === 0 ? 0 : options.colStep / 2

    for (let col = -radius; col <= radius; col += 1) {
      const centerX = col * options.colStep + rowOffset
      const centerY = row * options.rowStep
      candidates.push({
        centerX,
        centerY,
        distance: centerX ** 2 + centerY ** 2,
      })
    }
  }

  candidates.sort(
    (left, right) =>
      left.distance - right.distance ||
      Math.abs(left.centerY) - Math.abs(right.centerY) ||
      Math.abs(left.centerX) - Math.abs(right.centerX) ||
      left.centerY - right.centerY ||
      left.centerX - right.centerX
  )

  return candidates
}

function intersects(left: WallLayoutItem, right: WallLayoutItem, gap: number) {
  return !(
    left.x + left.width + gap <= right.x ||
    right.x + right.width + gap <= left.x ||
    left.y + left.height + gap <= right.y ||
    right.y + right.height + gap <= left.y
  )
}

function generateWallLayout(items: SpotifyTrackWallItem[], preset: WallPreset): WallLayout {
  const options = LAYOUT_PRESETS[preset]

  if (items.length === 0) {
    return {
      items: [],
      totalWidth: 0,
      totalHeight: 0,
      focusPoint: { x: 0, y: 0 },
      options,
    }
  }

  const candidates = createHiveCandidates(items.length, options)
  const layoutItems: WallLayoutItem[] = []

  items.forEach((item, index) => {
    const preferredSize = getTileSize(item.order, preset)
    let placement: WallLayoutItem | null = null

    for (const candidate of candidates) {
      const nextItem = {
        item,
        x: candidate.centerX - preferredSize.width / 2,
        y: candidate.centerY - preferredSize.height / 2,
        width: preferredSize.width,
        height: preferredSize.height,
      }

      if (layoutItems.every((placedItem) => !intersects(placedItem, nextItem, options.gap))) {
        placement = nextItem
        break
      }
    }

    if (!placement) {
      placement = {
        item,
        x: (index + 1) * options.colStep - preferredSize.width / 2,
        y: -preferredSize.height / 2,
        width: preferredSize.width,
        height: preferredSize.height,
      }
    }

    layoutItems.push(placement)
  })

  const padding = options.gap * 3
  const minX = Math.min(...layoutItems.map((layoutItem) => layoutItem.x))
  const minY = Math.min(...layoutItems.map((layoutItem) => layoutItem.y))
  const maxX = Math.max(...layoutItems.map((layoutItem) => layoutItem.x + layoutItem.width))
  const maxY = Math.max(...layoutItems.map((layoutItem) => layoutItem.y + layoutItem.height))
  const shiftX = padding - minX
  const shiftY = padding - minY
  const shiftedItems = layoutItems.map((layoutItem) => ({
    ...layoutItem,
    x: layoutItem.x + shiftX,
    y: layoutItem.y + shiftY,
  }))
  const focusItem = shiftedItems.find((layoutItem) => layoutItem.item.order === 1) ?? shiftedItems[0]

  return {
    items: shiftedItems,
    totalWidth: Math.ceil(maxX - minX + padding * 2),
    totalHeight: Math.ceil(maxY - minY + padding * 2),
    focusPoint: {
      x: focusItem.x + focusItem.width / 2,
      y: focusItem.y + focusItem.height / 2,
    },
    options,
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function getViewportBounds(viewportWidth: number, viewportHeight: number, layout: WallLayout) {
  const centeredX = (viewportWidth - layout.totalWidth) / 2
  const centeredY = (viewportHeight - layout.totalHeight) / 2
  const hasHorizontalOverflow = layout.totalWidth > viewportWidth
  const hasVerticalOverflow = layout.totalHeight > viewportHeight

  return {
    hasHorizontalOverflow,
    hasVerticalOverflow,
    minX: hasHorizontalOverflow ? viewportWidth - layout.totalWidth : centeredX,
    maxX: hasHorizontalOverflow ? 0 : centeredX,
    minY: hasVerticalOverflow ? viewportHeight - layout.totalHeight : centeredY,
    maxY: hasVerticalOverflow ? 0 : centeredY,
  }
}

function getFocusedOffset(viewportWidth: number, viewportHeight: number, layout: WallLayout) {
  const bounds = getViewportBounds(viewportWidth, viewportHeight, layout)

  return {
    x: clamp(viewportWidth / 2 - layout.focusPoint.x, bounds.minX, bounds.maxX),
    y: clamp(viewportHeight / 2 - layout.focusPoint.y, bounds.minY, bounds.maxY),
  }
}

function getEdgeFactor(position: number, viewportSize: number, thresholdRatio: number) {
  const threshold = Math.max(72, viewportSize * thresholdRatio)

  if (position <= threshold) {
    return -(1 - position / threshold)
  }

  if (position >= viewportSize - threshold) {
    return (position - (viewportSize - threshold)) / threshold
  }

  return 0
}

function getNearestVisibleOrder(
  layout: WallLayout,
  viewportWidth: number,
  viewportHeight: number,
  offset: { x: number; y: number }
) {
  const centerX = -offset.x + viewportWidth / 2
  const centerY = -offset.y + viewportHeight / 2
  let nextVisibleOrder = layout.items[0]?.item.order ?? 1
  let nearestDistance = Number.POSITIVE_INFINITY

  for (const layoutItem of layout.items) {
    const tileCenterX = layoutItem.x + layoutItem.width / 2
    const tileCenterY = layoutItem.y + layoutItem.height / 2
    const distance = (tileCenterX - centerX) ** 2 + (tileCenterY - centerY) ** 2

    if (distance < nearestDistance) {
      nearestDistance = distance
      nextVisibleOrder = layoutItem.item.order
    }
  }

  return nextVisibleOrder
}

async function extractDominantColor(url: string) {
  const cachedColor = colorCache.get(url)
  if (cachedColor) {
    return cachedColor
  }

  return new Promise<[number, number, number]>((resolve) => {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        const size = 48
        canvas.width = size
        canvas.height = size
        const context = canvas.getContext('2d')
        if (!context) {
          resolve(DEFAULT_HOVER_COLOR)
          return
        }

        context.drawImage(image, 0, 0, size, size)
        const samples = [
          [size / 2, size / 2],
          [size / 4, size / 4],
          [(size * 3) / 4, size / 4],
          [size / 4, (size * 3) / 4],
          [(size * 3) / 4, (size * 3) / 4],
        ]

        let bestScore = -1
        let bestColor = DEFAULT_HOVER_COLOR
        for (const [x, y] of samples) {
          const [red, green, blue] = context.getImageData(Math.floor(x), Math.floor(y), 1, 1).data
          const max = Math.max(red, green, blue)
          const min = Math.min(red, green, blue)
          const saturation = max === 0 ? 0 : (max - min) / max
          const score = saturation * 1.5 + (max / 255) * 0.5

          if (score > bestScore) {
            bestScore = score
            bestColor = [red, green, blue]
          }
        }

        colorCache.set(url, bestColor)
        resolve(bestColor)
      } catch {
        resolve(DEFAULT_HOVER_COLOR)
      }
    }

    image.onerror = () => resolve(DEFAULT_HOVER_COLOR)
    image.src = url
  })
}

export default function SpotifyTrackWall({
  items,
  emptyMessage,
  preset = 'default',
  footerStats,
  footerHint,
  loadMore,
}: SpotifyTrackWallProps) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const wallRef = useRef<HTMLDivElement>(null)
  const offsetRef = useRef({ x: 0, y: 0 })
  const velocityRef = useRef({ x: 0, y: 0 })
  const pointerRef = useRef({ inside: false, x: 0, y: 0 })
  const animationFrameRef = useRef<number | null>(null)
  const previousFrameRef = useRef<number | null>(null)
  const pausedRef = useRef(false)
  const badgeFrameRef = useRef(0)
  const visibleOrderRef = useRef(1)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [hoverColor, setHoverColor] = useState<[number, number, number] | null>(null)
  const [visibleOrder, setVisibleOrder] = useState(1)
  const layout = useMemo(() => generateWallLayout(items, preset), [items, preset])
  const layoutRef = useRef(layout)
  const hoveredItem = useMemo(() => items.find((item) => item.id === hoveredId) ?? null, [hoveredId, items])

  useEffect(() => {
    layoutRef.current = layout
  }, [layout])

  useEffect(() => {
    const viewport = viewportRef.current
    const wall = wallRef.current
    if (!viewport || !wall) {
      return
    }

    if (animationFrameRef.current != null) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }

    pointerRef.current.inside = false
    velocityRef.current = { x: 0, y: 0 }
    previousFrameRef.current = null
    badgeFrameRef.current = 0
    offsetRef.current = getFocusedOffset(viewport.clientWidth, viewport.clientHeight, layout)
    wall.style.transform = `translate3d(${offsetRef.current.x}px, ${offsetRef.current.y}px, 0)`

    const nextVisibleOrder = getNearestVisibleOrder(
      layout,
      viewport.clientWidth,
      viewport.clientHeight,
      offsetRef.current
    )
    visibleOrderRef.current = nextVisibleOrder
    setVisibleOrder(nextVisibleOrder)

    const handleResize = () => {
      const resizedViewport = viewportRef.current
      const resizedWall = wallRef.current
      if (!resizedViewport || !resizedWall) {
        return
      }

      offsetRef.current = getFocusedOffset(resizedViewport.clientWidth, resizedViewport.clientHeight, layoutRef.current)
      resizedWall.style.transform = `translate3d(${offsetRef.current.x}px, ${offsetRef.current.y}px, 0)`
      const resizedVisibleOrder = getNearestVisibleOrder(
        layoutRef.current,
        resizedViewport.clientWidth,
        resizedViewport.clientHeight,
        offsetRef.current
      )
      visibleOrderRef.current = resizedVisibleOrder
      setVisibleOrder(resizedVisibleOrder)
    }

    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      if (animationFrameRef.current != null) {
        cancelAnimationFrame(animationFrameRef.current)
      }
      animationFrameRef.current = null
      previousFrameRef.current = null
    }
  }, [layout])

  const tick = (timestamp: number) => {
    animationFrameRef.current = null

    const viewport = viewportRef.current
    const wall = wallRef.current
    const activeLayout = layoutRef.current

    if (!viewport || !wall || activeLayout.items.length === 0) {
      previousFrameRef.current = null
      return
    }

    if (previousFrameRef.current == null) {
      previousFrameRef.current = timestamp
    }

    const delta = Math.min((timestamp - previousFrameRef.current) / 1000, 0.04)
    previousFrameRef.current = timestamp
    const bounds = getViewportBounds(viewport.clientWidth, viewport.clientHeight, activeLayout)
    const edgeFactorX = pointerRef.current.inside && !pausedRef.current
      ? getEdgeFactor(pointerRef.current.x, viewport.clientWidth, activeLayout.options.edgeThresholdRatio)
      : 0
    const edgeFactorY = pointerRef.current.inside && !pausedRef.current
      ? getEdgeFactor(pointerRef.current.y, viewport.clientHeight, activeLayout.options.edgeThresholdRatio)
      : 0
    const desiredVelocityX = bounds.hasHorizontalOverflow ? -edgeFactorX * activeLayout.options.maxPanSpeed : 0
    const desiredVelocityY = bounds.hasVerticalOverflow ? -edgeFactorY * activeLayout.options.maxPanSpeed * 0.88 : 0
    const easing = Math.min(1, delta * CAMERA_SETTLE_RATE)

    velocityRef.current.x += (desiredVelocityX - velocityRef.current.x) * easing
    velocityRef.current.y += (desiredVelocityY - velocityRef.current.y) * easing

    let nextX = bounds.hasHorizontalOverflow
      ? offsetRef.current.x + velocityRef.current.x * delta
      : getFocusedOffset(viewport.clientWidth, viewport.clientHeight, activeLayout).x
    let nextY = bounds.hasVerticalOverflow
      ? offsetRef.current.y + velocityRef.current.y * delta
      : getFocusedOffset(viewport.clientWidth, viewport.clientHeight, activeLayout).y

    nextX = clamp(nextX, bounds.minX, bounds.maxX)
    nextY = clamp(nextY, bounds.minY, bounds.maxY)

    if (nextX === bounds.minX || nextX === bounds.maxX) {
      velocityRef.current.x *= 0.32
    }

    if (nextY === bounds.minY || nextY === bounds.maxY) {
      velocityRef.current.y *= 0.32
    }

    const moved =
      Math.abs(nextX - offsetRef.current.x) > 0.08 || Math.abs(nextY - offsetRef.current.y) > 0.08

    offsetRef.current = { x: nextX, y: nextY }

    if (moved) {
      wall.style.transform = `translate3d(${nextX}px, ${nextY}px, 0)`
    }

    if (moved && timestamp - badgeFrameRef.current > 120) {
      badgeFrameRef.current = timestamp
      const nextVisibleOrder = getNearestVisibleOrder(
        activeLayout,
        viewport.clientWidth,
        viewport.clientHeight,
        offsetRef.current
      )

      visibleOrderRef.current = nextVisibleOrder
      setVisibleOrder((currentValue) => (currentValue === nextVisibleOrder ? currentValue : nextVisibleOrder))
    }

    const hasEdgeInput = Math.abs(edgeFactorX) > 0.001 || Math.abs(edgeFactorY) > 0.001
    const hasMomentum =
      Math.abs(velocityRef.current.x) > MOTION_EPSILON || Math.abs(velocityRef.current.y) > MOTION_EPSILON

    if (hasEdgeInput || hasMomentum) {
      animationFrameRef.current = requestAnimationFrame(tick)
      return
    }

    velocityRef.current = { x: 0, y: 0 }
    previousFrameRef.current = null
  }

  const scheduleAnimation = () => {
    if (animationFrameRef.current != null || layoutRef.current.items.length === 0) {
      return
    }

    animationFrameRef.current = requestAnimationFrame(tick)
  }

  const shellClassName = preset === 'compact' ? `${styles.shell} ${styles.shellCompact}` : styles.shell
  const wallStyle = {
    '--wall-height': `${layout.options.viewportHeight}px`,
  } as CSSProperties

  const glowStyle = hoverColor
    ? {
        background: `radial-gradient(circle at center, rgba(${hoverColor[0]}, ${hoverColor[1]}, ${hoverColor[2]}, 0.48), rgba(${hoverColor[0]}, ${hoverColor[1]}, ${hoverColor[2]}, 0.12) 35%, transparent 68%)`,
        opacity: 1,
      }
    : undefined

  if (items.length === 0) {
    return (
      <div className={shellClassName}>
        <div className={styles.empty}>{emptyMessage}</div>
      </div>
    )
  }

  return (
    <div className={shellClassName} style={wallStyle}>
      <div className={styles.backdropGlow} style={glowStyle} />

      <div
        className={styles.viewport}
        ref={viewportRef}
        onMouseMove={(event) => {
          const rect = event.currentTarget.getBoundingClientRect()
          pointerRef.current = {
            inside: true,
            x: event.clientX - rect.left,
            y: event.clientY - rect.top,
          }
          scheduleAnimation()
        }}
        onMouseLeave={() => {
          pointerRef.current.inside = false
          scheduleAnimation()
        }}
      >
        <div className={styles.wall} ref={wallRef} style={{ width: layout.totalWidth, height: layout.totalHeight }}>
          {layout.items.map((layoutItem) => {
            const isHovered = hoveredId === layoutItem.item.id
            const isDimmed = hoveredId !== null && hoveredId !== layoutItem.item.id

            return (
              <div
                key={layoutItem.item.id}
                className={[
                  styles.tile,
                  isHovered ? styles.tileHovered : '',
                  isDimmed ? styles.tileMuted : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                style={{
                  transform: `translate3d(${layoutItem.x}px, ${layoutItem.y}px, 0)`,
                  width: layoutItem.width,
                  height: layoutItem.height,
                  ['--wall-blur' as string]: `${layout.options.blurStrength}px`,
                }}
                onMouseEnter={() => {
                  pausedRef.current = true
                  velocityRef.current = { x: 0, y: 0 }
                  setHoveredId(layoutItem.item.id)
                  if (layoutItem.item.imageUrl) {
                    void extractDominantColor(layoutItem.item.imageUrl).then((nextColor) => {
                      setHoverColor(nextColor)
                    })
                  } else {
                    setHoverColor(DEFAULT_HOVER_COLOR)
                  }
                }}
                onMouseLeave={() => {
                  pausedRef.current = false
                  setHoveredId((currentValue) => (currentValue === layoutItem.item.id ? null : currentValue))
                  setHoverColor(null)
                  scheduleAnimation()
                }}
              >
                <div className={styles.tileInner}>
                  {layoutItem.item.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={layoutItem.item.imageUrl}
                      alt={layoutItem.item.title}
                      className={styles.tileMedia}
                      loading="lazy"
                      decoding="async"
                      draggable="false"
                    />
                  ) : (
                    <div className={styles.tilePlaceholder}>
                      <Music2 size={24} strokeWidth={1.8} />
                    </div>
                  )}
                  <span className={styles.tileIndex}>#{layoutItem.item.order}</span>
                </div>

                {isHovered ? (
                  <div className={styles.tileInfo}>
                    <div className={styles.tileInfoOrder}>Now Focused #{layoutItem.item.order}</div>
                    <div className={styles.tileInfoTitle}>{layoutItem.item.title}</div>
                    <div className={styles.tileInfoArtists}>{layoutItem.item.artists}</div>
                    <div className={styles.tileInfoAlbum}>{layoutItem.item.album}</div>
                    <div className={styles.tileInfoMeta}>
                      {layoutItem.item.meta.map((value) => (
                        <span key={`${layoutItem.item.id}-${value}`}>{value}</span>
                      ))}
                    </div>
                    {layoutItem.item.href ? (
                      <a href={layoutItem.item.href} target="_blank" rel="noreferrer" className={styles.tileInfoLink}>
                        在 Spotify 打开
                        <ExternalLink size={14} strokeWidth={1.8} />
                      </a>
                    ) : null}
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>

        <div className={`${styles.fade} ${styles.fadeTop}`} />
        <div className={`${styles.fade} ${styles.fadeBottom}`} />
        <div className={`${styles.fade} ${styles.fadeLeft}`} />
        <div className={`${styles.fade} ${styles.fadeRight}`} />
      </div>

      <div className={styles.footer}>
        {footerStats.map((stat, index) => (
          <Fragment key={`${stat.label}-${stat.value}`}>
            <div key={`${stat.label}-${stat.value}`} className={styles.footerStat}>
              <span className={styles.footerValue}>{stat.value}</span>
              <span className={styles.footerLabel}>{stat.label}</span>
            </div>
            {index < footerStats.length - 1 ? <div className={styles.footerDivider} /> : null}
          </Fragment>
        ))}

        <div className={styles.footerSpacer} />

        {loadMore?.hasMore ? (
          <div className={styles.footerAction}>
            <button
              type="button"
              className={styles.loadMoreButton}
              onClick={loadMore.onLoadMore}
              disabled={loadMore.isLoading}
            >
              {loadMore.isLoading ? <Loader2 size={14} className="animate-spin" /> : null}
              {loadMore.label}
            </button>
          </div>
        ) : null}

        <div className={styles.footerHint}>{hoveredItem ? `hovering #${hoveredItem.order}` : footerHint ?? `center tile #${visibleOrder}`}</div>
      </div>
    </div>
  )
}