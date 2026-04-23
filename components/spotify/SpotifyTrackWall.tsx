'use client'

import { Fragment, startTransition, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Loader2, Music2 } from 'lucide-react'

import styles from './SpotifyTrackWall.module.css'

const AUTO_DRIFT_VERTICAL_RATIO = 0.6
const HOVER_INTENT_DELAY_MS = 120
const VISIBLE_ORDER_THROTTLE_MS = 180
const EXTENDED_IRREGULAR_CYCLE = 18
const MANUAL_PAN_STEP_RATIO = 0.42

type WallPreset = 'default' | 'compact'
type AxisDirection = -1 | 1
type MoveDirection = 'up' | 'down' | 'left' | 'right'

interface LayoutOptions {
  baseTileSize: number
  gap: number
  gridCols: number
  driftSpeed: number
  viewportHeight: number
  blurStrength: number
}

const LAYOUT_PRESETS: Record<WallPreset, LayoutOptions> = {
  default: {
    baseTileSize: 148,
    gap: 12,
    gridCols: 8,
    driftSpeed: 11,
    viewportHeight: 596,
    blurStrength: 16,
  },
  compact: {
    baseTileSize: 132,
    gap: 10,
    gridCols: 8,
    driftSpeed: 10,
    viewportHeight: 552,
    blurStrength: 13,
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

function getTileSpan(order: number, index: number) {
  if (order <= 3 && index % 3 === 0) {
    return { width: 2, height: 2 }
  }

  if (order <= 10 && order % 4 === 1) {
    return { width: 2, height: 1 }
  }

  if (order <= 12 && order % 5 === 2) {
    return { width: 1, height: 2 }
  }

  if (order <= 25 && order % 7 === 3) {
    return { width: 2, height: 1 }
  }

  if (order <= 30 && order % 9 === 4) {
    return { width: 1, height: 2 }
  }

  const repeatingOrder = ((order - 31) % EXTENDED_IRREGULAR_CYCLE) + 1

  if (repeatingOrder === 1 || repeatingOrder === 11 || repeatingOrder === 16) {
    return { width: 2, height: 1 }
  }

  if (repeatingOrder === 5 || repeatingOrder === 14) {
    return { width: 1, height: 2 }
  }

  if (repeatingOrder === 8) {
    return { width: 2, height: 2 }
  }

  return { width: 1, height: 1 }
}

function getTileDimensions(widthUnits: number, heightUnits: number, options: LayoutOptions) {
  return {
    width: widthUnits * options.baseTileSize + (widthUnits - 1) * options.gap,
    height: heightUnits * options.baseTileSize + (heightUnits - 1) * options.gap,
  }
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

  const occupied: boolean[][] = []
  const layoutItems: WallLayoutItem[] = []
  const searchRowLimit = Math.max(48, items.length * 6)
  let maxRow = 0

  const isFree = (row: number, col: number, widthUnits: number, heightUnits: number) => {
    if (col + widthUnits > options.gridCols) {
      return false
    }

    for (let currentRow = row; currentRow < row + heightUnits; currentRow += 1) {
      for (let currentCol = col; currentCol < col + widthUnits; currentCol += 1) {
        if (occupied[currentRow]?.[currentCol]) {
          return false
        }
      }
    }

    return true
  }

  const markOccupied = (row: number, col: number, widthUnits: number, heightUnits: number) => {
    for (let currentRow = row; currentRow < row + heightUnits; currentRow += 1) {
      if (!occupied[currentRow]) {
        occupied[currentRow] = []
      }

      for (let currentCol = col; currentCol < col + widthUnits; currentCol += 1) {
        occupied[currentRow][currentCol] = true
      }
    }

    maxRow = Math.max(maxRow, row + heightUnits)
  }

  items.forEach((item, index) => {
    const preferredSpan = getTileSpan(item.order, index)
    const candidateSpans = preferredSpan.width === 1 && preferredSpan.height === 1
      ? [preferredSpan]
      : [preferredSpan, { width: 1, height: 1 }]
    let placement: WallLayoutItem | null = null

    for (const span of candidateSpans) {
      for (let row = 0; row < searchRowLimit && !placement; row += 1) {
        for (let col = 0; col < options.gridCols && !placement; col += 1) {
          if (!isFree(row, col, span.width, span.height)) {
            continue
          }

          markOccupied(row, col, span.width, span.height)
          const dimensions = getTileDimensions(span.width, span.height, options)

          placement = {
            item,
            x: col * (options.baseTileSize + options.gap),
            y: row * (options.baseTileSize + options.gap),
            width: dimensions.width,
            height: dimensions.height,
          }
        }
      }
    }

    if (!placement) {
      const fallbackRow = maxRow
      markOccupied(fallbackRow, 0, 1, 1)

      placement = {
        item,
        x: 0,
        y: fallbackRow * (options.baseTileSize + options.gap),
        width: options.baseTileSize,
        height: options.baseTileSize,
      }
    }

    layoutItems.push(placement)
  })

  const totalRows = Math.max(maxRow, 1)
  const totalWidth = options.gridCols * options.baseTileSize + (options.gridCols - 1) * options.gap
  const totalHeight = totalRows * options.baseTileSize + (totalRows - 1) * options.gap

  return {
    items: layoutItems,
    totalWidth,
    totalHeight,
    focusPoint: {
      x: totalWidth / 2,
      y: totalHeight / 2,
    },
    options,
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function resolveLoopingAxis(value: number, min: number, max: number, direction: AxisDirection) {
  if (min === max) {
    return { value: min, direction }
  }

  if (value < min) {
    return {
      value: clamp(min + (min - value), min, max),
      direction: 1 as const,
    }
  }

  if (value > max) {
    return {
      value: clamp(max - (value - max), min, max),
      direction: -1 as const,
    }
  }

  return { value, direction }
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
  const driftDirectionRef = useRef<{ x: AxisDirection; y: AxisDirection }>({ x: -1, y: -1 })
  const animationFrameRef = useRef<number | null>(null)
  const previousFrameRef = useRef<number | null>(null)
  const tickRef = useRef<(timestamp: number) => void>(() => {})
  const hoverIntentTimeoutRef = useRef<number | null>(null)
  const suppressNextHoverRef = useRef(false)
  const hoverPausedRef = useRef(false)
  const manualPausedRef = useRef(false)
  const badgeFrameRef = useRef(0)
  const visibleOrderRef = useRef(1)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [isManualNavigation, setIsManualNavigation] = useState(false)
  const [visibleOrder, setVisibleOrder] = useState(1)
  const layout = useMemo(() => generateWallLayout(items, preset), [items, preset])
  const layoutRef = useRef(layout)
  const hoveredItem = useMemo(() => items.find((item) => item.id === hoveredId) ?? null, [hoveredId, items])
  const activeHoveredId = hoveredItem?.id ?? null

  const clearHoverIntent = useCallback(() => {
    if (hoverIntentTimeoutRef.current != null) {
      window.clearTimeout(hoverIntentTimeoutRef.current)
      hoverIntentTimeoutRef.current = null
    }
  }, [])

  const scheduleHoverIntent = useCallback((itemId: string) => {
    clearHoverIntent()
    hoverIntentTimeoutRef.current = window.setTimeout(() => {
      hoverIntentTimeoutRef.current = null
      hoverPausedRef.current = true
      previousFrameRef.current = null
      setHoveredId((currentValue) => (currentValue === itemId ? currentValue : itemId))
    }, HOVER_INTENT_DELAY_MS)
  }, [clearHoverIntent])

  const setManualPaused = useCallback((nextPaused: boolean) => {
    manualPausedRef.current = nextPaused
    setIsManualNavigation((currentValue) => (currentValue === nextPaused ? currentValue : nextPaused))
  }, [])

  const syncVisibleOrder = useCallback((
    activeLayout: WallLayout,
    viewportWidth: number,
    viewportHeight: number,
    offset: { x: number; y: number },
    shouldTransition = false
  ) => {
    const nextVisibleOrder = getNearestVisibleOrder(activeLayout, viewportWidth, viewportHeight, offset)

    if (nextVisibleOrder === visibleOrderRef.current) {
      return
    }

    visibleOrderRef.current = nextVisibleOrder

    if (shouldTransition) {
      startTransition(() => {
        setVisibleOrder((currentValue) => (currentValue === nextVisibleOrder ? currentValue : nextVisibleOrder))
      })
      return
    }

    setVisibleOrder(nextVisibleOrder)
  }, [])

  const scheduleAnimation = useCallback(() => {
    if (
      animationFrameRef.current != null ||
      layoutRef.current.items.length === 0 ||
      hoverPausedRef.current ||
      manualPausedRef.current
    ) {
      return
    }

    animationFrameRef.current = requestAnimationFrame((timestamp) => {
      tickRef.current(timestamp)
    })
  }, [])

  useEffect(() => {
    layoutRef.current = layout
  }, [layout])

  const tick = useCallback((timestamp: number) => {
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
    const centeredOffset = getFocusedOffset(viewport.clientWidth, viewport.clientHeight, activeLayout)

    let nextX = bounds.hasHorizontalOverflow ? offsetRef.current.x : centeredOffset.x
    let nextY = bounds.hasVerticalOverflow ? offsetRef.current.y : centeredOffset.y

    if (!hoverPausedRef.current && !manualPausedRef.current) {
      if (bounds.hasHorizontalOverflow) {
        nextX += driftDirectionRef.current.x * activeLayout.options.driftSpeed * delta
      }

      if (bounds.hasVerticalOverflow) {
        nextY += driftDirectionRef.current.y * activeLayout.options.driftSpeed * AUTO_DRIFT_VERTICAL_RATIO * delta
      }
    }

    const resolvedX = resolveLoopingAxis(nextX, bounds.minX, bounds.maxX, driftDirectionRef.current.x)
    const resolvedY = resolveLoopingAxis(nextY, bounds.minY, bounds.maxY, driftDirectionRef.current.y)
    driftDirectionRef.current.x = resolvedX.direction
    driftDirectionRef.current.y = resolvedY.direction
    nextX = resolvedX.value
    nextY = resolvedY.value

    const moved =
      Math.abs(nextX - offsetRef.current.x) > 0.08 || Math.abs(nextY - offsetRef.current.y) > 0.08

    offsetRef.current = { x: nextX, y: nextY }

    if (moved) {
      wall.style.transform = `translate3d(${nextX}px, ${nextY}px, 0)`
    }

    if (moved && timestamp - badgeFrameRef.current > VISIBLE_ORDER_THROTTLE_MS) {
      badgeFrameRef.current = timestamp
      syncVisibleOrder(activeLayout, viewport.clientWidth, viewport.clientHeight, offsetRef.current, true)
    }

    const hasRemainingDrift =
      !hoverPausedRef.current &&
      !manualPausedRef.current &&
      (bounds.hasHorizontalOverflow || bounds.hasVerticalOverflow)

    if (hasRemainingDrift) {
      animationFrameRef.current = requestAnimationFrame((nextTimestamp) => {
        tickRef.current(nextTimestamp)
      })
      return
    }

    previousFrameRef.current = null
  }, [syncVisibleOrder])

  useEffect(() => {
    tickRef.current = tick
  }, [tick])

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

    clearHoverIntent()
    suppressNextHoverRef.current = false
    hoverPausedRef.current = false
    manualPausedRef.current = false
    previousFrameRef.current = null
    badgeFrameRef.current = 0
    driftDirectionRef.current = { x: -1, y: -1 }
    offsetRef.current = getFocusedOffset(viewport.clientWidth, viewport.clientHeight, layout)
    wall.style.transform = `translate3d(${offsetRef.current.x}px, ${offsetRef.current.y}px, 0)`
    visibleOrderRef.current = getNearestVisibleOrder(
      layout,
      viewport.clientWidth,
      viewport.clientHeight,
      offsetRef.current
    )

    const handleResize = () => {
      const resizedViewport = viewportRef.current
      const resizedWall = wallRef.current
      if (!resizedViewport || !resizedWall) {
        return
      }

      offsetRef.current = getFocusedOffset(resizedViewport.clientWidth, resizedViewport.clientHeight, layoutRef.current)
      resizedWall.style.transform = `translate3d(${offsetRef.current.x}px, ${offsetRef.current.y}px, 0)`
      clearHoverIntent()
      suppressNextHoverRef.current = false
      hoverPausedRef.current = false
      setManualPaused(false)
      driftDirectionRef.current = { x: -1, y: -1 }
      previousFrameRef.current = null
      setHoveredId(null)
      syncVisibleOrder(layoutRef.current, resizedViewport.clientWidth, resizedViewport.clientHeight, offsetRef.current)
      scheduleAnimation()
    }

    window.addEventListener('resize', handleResize)
    scheduleAnimation()

    return () => {
      window.removeEventListener('resize', handleResize)
      clearHoverIntent()
      if (animationFrameRef.current != null) {
        cancelAnimationFrame(animationFrameRef.current)
      }
      animationFrameRef.current = null
      previousFrameRef.current = null
    }
  }, [clearHoverIntent, layout, scheduleAnimation, setManualPaused, syncVisibleOrder])

  const moveViewport = useCallback((direction: MoveDirection) => {
    const viewport = viewportRef.current
    const wall = wallRef.current
    const activeLayout = layoutRef.current

    if (!viewport || !wall || activeLayout.items.length === 0) {
      return
    }

    clearHoverIntent()
    suppressNextHoverRef.current = false
    hoverPausedRef.current = false
    setHoveredId(null)
    setManualPaused(true)
    previousFrameRef.current = null

    if (animationFrameRef.current != null) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }

    const bounds = getViewportBounds(viewport.clientWidth, viewport.clientHeight, activeLayout)
    const centeredOffset = getFocusedOffset(viewport.clientWidth, viewport.clientHeight, activeLayout)
    const horizontalStep = Math.max(activeLayout.options.baseTileSize * 1.9, viewport.clientWidth * MANUAL_PAN_STEP_RATIO)
    const verticalStep = Math.max(activeLayout.options.baseTileSize * 1.9, viewport.clientHeight * MANUAL_PAN_STEP_RATIO)

    const deltaX = direction === 'left' ? horizontalStep : direction === 'right' ? -horizontalStep : 0
    const deltaY = direction === 'up' ? verticalStep : direction === 'down' ? -verticalStep : 0

    const nextOffset = {
      x: bounds.hasHorizontalOverflow
        ? clamp(offsetRef.current.x + deltaX, bounds.minX, bounds.maxX)
        : centeredOffset.x,
      y: bounds.hasVerticalOverflow
        ? clamp(offsetRef.current.y + deltaY, bounds.minY, bounds.maxY)
        : centeredOffset.y,
    }

    offsetRef.current = nextOffset
    wall.style.transform = `translate3d(${nextOffset.x}px, ${nextOffset.y}px, 0)`
    syncVisibleOrder(activeLayout, viewport.clientWidth, viewport.clientHeight, nextOffset)
  }, [clearHoverIntent, setManualPaused, syncVisibleOrder])

  const resumeAutoDrift = useCallback(() => {
    clearHoverIntent()
    suppressNextHoverRef.current = false
    hoverPausedRef.current = false
    setHoveredId(null)
    setManualPaused(false)
    previousFrameRef.current = null
    scheduleAnimation()
  }, [clearHoverIntent, scheduleAnimation, setManualPaused])

  const shellClassName = preset === 'compact' ? `${styles.shell} ${styles.shellCompact}` : styles.shell
  const wallStyle = {
    '--wall-height': `${layout.options.viewportHeight}px`,
    '--tile-blur-strength': `${layout.options.blurStrength}px`,
  } as CSSProperties
  const backdropGlowClassName = activeHoveredId ? `${styles.backdropGlow} ${styles.backdropGlowActive}` : styles.backdropGlow

  if (items.length === 0) {
    return (
      <div className={shellClassName}>
        <div className={styles.empty}>{emptyMessage}</div>
      </div>
    )
  }

  return (
    <div className={shellClassName} style={wallStyle}>
      <div className={backdropGlowClassName} />

      <div
        className={styles.viewport}
        ref={viewportRef}
        onMouseLeave={() => {
          clearHoverIntent()
          suppressNextHoverRef.current = false
          hoverPausedRef.current = false
          previousFrameRef.current = null
          setHoveredId(null)
          if (!manualPausedRef.current) {
            scheduleAnimation()
          }
        }}
      >
        <div className={styles.wall} ref={wallRef} style={{ width: layout.totalWidth, height: layout.totalHeight }}>
          {layout.items.map((layoutItem) => {
            const isHovered = activeHoveredId === layoutItem.item.id
            const isDimmed = activeHoveredId !== null && activeHoveredId !== layoutItem.item.id

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
                }}
                onMouseEnter={() => {
                  clearHoverIntent()

                  if (activeHoveredId && activeHoveredId !== layoutItem.item.id) {
                    return
                  }

                  if (suppressNextHoverRef.current) {
                    suppressNextHoverRef.current = false
                    return
                  }

                  scheduleHoverIntent(layoutItem.item.id)
                }}
                onMouseLeave={() => {
                  clearHoverIntent()

                  if (activeHoveredId === layoutItem.item.id) {
                    suppressNextHoverRef.current = true
                    hoverPausedRef.current = false
                    previousFrameRef.current = null
                    setHoveredId(null)
                    if (!manualPausedRef.current) {
                      scheduleAnimation()
                    }
                  }
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
                    <div className={styles.tileInfoOrder}>#{layoutItem.item.order}</div>
                    <div className={styles.tileInfoTitle}>{layoutItem.item.title}</div>
                    <div className={styles.tileInfoArtists}>{layoutItem.item.artists}</div>
                    <div className={styles.tileInfoAlbum}>{layoutItem.item.album}</div>
                    <div className={styles.tileInfoMeta}>
                      {layoutItem.item.meta.map((value, index) => (
                        <Fragment key={`${layoutItem.item.id}-${value}`}>
                          {index > 0 ? <span className={styles.tileInfoMetaDot}>·</span> : null}
                          <span>{value}</span>
                        </Fragment>
                      ))}
                    </div>
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

        <div className={styles.viewportControls} role="group" aria-label="移动视口">
          <button
            type="button"
            className={`${styles.controlButton} ${styles.controlButtonUp}`}
            onClick={() => moveViewport('up')}
            aria-label="向上移动视口"
          >
            <ArrowUp size={16} strokeWidth={2} />
          </button>
          <button
            type="button"
            className={`${styles.controlButton} ${styles.controlButtonLeft}`}
            onClick={() => moveViewport('left')}
            aria-label="向左移动视口"
          >
            <ArrowLeft size={16} strokeWidth={2} />
          </button>
          <button
            type="button"
            className={[
              styles.controlButton,
              styles.controlButtonCenter,
              !isManualNavigation ? styles.controlButtonCenterActive : '',
            ]
              .filter(Boolean)
              .join(' ')}
            onClick={resumeAutoDrift}
            aria-label="恢复自动漂移"
            aria-pressed={!isManualNavigation}
          >
            AUTO
          </button>
          <button
            type="button"
            className={`${styles.controlButton} ${styles.controlButtonRight}`}
            onClick={() => moveViewport('right')}
            aria-label="向右移动视口"
          >
            <ArrowRight size={16} strokeWidth={2} />
          </button>
          <button
            type="button"
            className={`${styles.controlButton} ${styles.controlButtonDown}`}
            onClick={() => moveViewport('down')}
            aria-label="向下移动视口"
          >
            <ArrowDown size={16} strokeWidth={2} />
          </button>
        </div>
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

        <div className={styles.footerHint}>
          {hoveredItem
            ? `hovering #${hoveredItem.order}`
            : isManualNavigation
              ? 'manual viewport'
              : footerHint ?? `center tile #${visibleOrder}`}
        </div>
      </div>
    </div>
  )
}