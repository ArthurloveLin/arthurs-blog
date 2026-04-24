'use client'

import { Fragment, startTransition, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Loader2, Music2 } from 'lucide-react'

import styles from './SpotifyTrackWall.module.css'

const HOVER_INTENT_DELAY_MS = 120
const VISIBLE_ORDER_THROTTLE_MS = 180
const MANUAL_PAN_STEP_RATIO = 0.42
const SMOOTH_PAN_DURATION = 480
const FEATURED_ORDER_COUNT = 3
const LISSAJOUS_AMP_X_RATIO = 1.4
const LISSAJOUS_AMP_Y_RATIO = 1.0
const LISSAJOUS_PERIOD_X = 28
const LISSAJOUS_PERIOD_Y = 19
const DRIFT_WARMUP_SECONDS = 1.1
const MANUAL_RESUME_IDLE_MS = 4000
const RESUME_TRANSITION_MS = 680

type WallPreset = 'default' | 'compact'
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
    baseTileSize: 172,
    gap: 12,
    gridCols: 6,
    driftSpeed: 11,
    viewportHeight: 680,
    blurStrength: 9,
  },
  compact: {
    baseTileSize: 152,
    gap: 10,
    gridCols: 6,
    driftSpeed: 10,
    viewportHeight: 616,
    blurStrength: 8,
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

function isFeaturedOrder(order: number) {
  return order <= FEATURED_ORDER_COUNT
}

function getTileSpan(order: number, _index: number) {
  return isFeaturedOrder(order) ? { width: 2, height: 2 } : { width: 1, height: 1 }
}

function getTileDimensions(widthUnits: number, heightUnits: number, options: LayoutOptions) {
  return {
    width: widthUnits * options.baseTileSize + (widthUnits - 1) * options.gap,
    height: heightUnits * options.baseTileSize + (heightUnits - 1) * options.gap,
  }
}

function buildCenterFirstCells(gridCols: number, rowLimit: number, centerRow: number) {
  const centerCol = (gridCols - 1) / 2
  const cells: Array<{ row: number; col: number; dist: number }> = []

  for (let row = 0; row < rowLimit; row++) {
    for (let col = 0; col < gridCols; col++) {
      const dist = Math.abs(col - centerCol) + Math.abs(row - centerRow)
      cells.push({ row, col, dist })
    }
  }

  cells.sort((a, b) => a.dist - b.dist)
  return cells
}

function getFeaturedAnchorCells(centerRow: number) {
  return [
    { row: centerRow, col: 2 },
    { row: centerRow, col: 0 },
    { row: centerRow, col: 4 },
  ]
}

function generateWallLayout(items: SpotifyTrackWallItem[], preset: WallPreset): WallLayout {
  const options = LAYOUT_PRESETS[preset]
  const rankedItems = [...items].sort((left, right) => left.order - right.order)

  if (rankedItems.length === 0) {
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
  const searchRowLimit = Math.max(48, rankedItems.length * 6)
  const estimatedCenterRow = Math.max(2, Math.round(rankedItems.length / (options.gridCols * 2)))
  const featuredAnchorCells = getFeaturedAnchorCells(estimatedCenterRow)
  const searchCells = buildCenterFirstCells(options.gridCols, searchRowLimit, estimatedCenterRow)
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

  rankedItems.forEach((item, index) => {
    const span = getTileSpan(item.order, index)
    let placement: WallLayoutItem | null = null
    const preferredCells = isFeaturedOrder(item.order)
      ? [featuredAnchorCells[item.order - 1], ...searchCells.filter(({ row, col }) => !(row === featuredAnchorCells[item.order - 1].row && col === featuredAnchorCells[item.order - 1].col))]
      : searchCells

    for (const { row, col } of preferredCells) {
      if (isFree(row, col, span.width, span.height)) {
        markOccupied(row, col, span.width, span.height)
        const dimensions = getTileDimensions(span.width, span.height, options)

        placement = {
          item,
          x: col * (options.baseTileSize + options.gap),
          y: row * (options.baseTileSize + options.gap),
          width: dimensions.width,
          height: dimensions.height,
        }
        break
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

  const firstItem = layoutItems.find(li => li.item.order === 1)
  const focusPoint = firstItem
    ? {
        x: firstItem.x + firstItem.width / 2,
        y: firstItem.y + firstItem.height / 2,
      }
    : { x: totalWidth / 2, y: totalHeight / 2 }

  return {
    items: layoutItems,
    totalWidth,
    totalHeight,
    focusPoint,
    options,
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function applyWallOffset(wall: HTMLDivElement, offset: { x: number; y: number }) {
  wall.style.transform = `translate3d(${offset.x}px, ${offset.y}px, 0)`
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

function getDriftOffset(
  viewportWidth: number,
  viewportHeight: number,
  layout: WallLayout,
  timeSeconds: number,
  strength: number
) {
  const bounds = getViewportBounds(viewportWidth, viewportHeight, layout)
  const centeredOffset = getFocusedOffset(viewportWidth, viewportHeight, layout)
  const halfRangeX = (bounds.maxX - bounds.minX) / 2
  const halfRangeY = (bounds.maxY - bounds.minY) / 2
  const Ax = Math.min(layout.options.baseTileSize * LISSAJOUS_AMP_X_RATIO, halfRangeX) * strength
  const Ay = Math.min(layout.options.baseTileSize * LISSAJOUS_AMP_Y_RATIO, halfRangeY) * strength
  const freqX = (2 * Math.PI) / LISSAJOUS_PERIOD_X
  const freqY = (2 * Math.PI) / LISSAJOUS_PERIOD_Y

  return {
    bounds,
    offset: {
      x: clamp(centeredOffset.x + Ax * Math.sin(freqX * timeSeconds), bounds.minX, bounds.maxX),
      y: clamp(centeredOffset.y + Ay * Math.sin(freqY * timeSeconds + Math.PI / 4), bounds.minY, bounds.maxY),
    },
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
  const oscillationTimeRef = useRef<number>(0)
  const animationFrameRef = useRef<number | null>(null)
  const previousFrameRef = useRef<number | null>(null)
  const tickRef = useRef<(timestamp: number) => void>(() => {})
  const resumeAutoDriftRef = useRef<(fromManual?: boolean) => void>(() => {})
  const driftStrengthRef = useRef(0)
  const hoverIntentTimeoutRef = useRef<number | null>(null)
  const manualResumeTimerRef = useRef<number | null>(null)
  const isResumingRef = useRef(false)
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
      manualPausedRef.current ||
      isResumingRef.current
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

    if (!hoverPausedRef.current && !manualPausedRef.current) {
      oscillationTimeRef.current += delta
      driftStrengthRef.current = Math.min(1, driftStrengthRef.current + delta / DRIFT_WARMUP_SECONDS)
    }

    const { bounds, offset } = getDriftOffset(
      viewport.clientWidth,
      viewport.clientHeight,
      activeLayout,
      oscillationTimeRef.current,
      driftStrengthRef.current,
    )
    const nextX = offset.x
    const nextY = offset.y

    const moved =
      Math.abs(nextX - offsetRef.current.x) > 0.08 || Math.abs(nextY - offsetRef.current.y) > 0.08

    offsetRef.current = { x: nextX, y: nextY }

    if (moved) {
      applyWallOffset(wall, offsetRef.current)
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

    if (manualResumeTimerRef.current != null) {
      window.clearTimeout(manualResumeTimerRef.current)
      manualResumeTimerRef.current = null
    }

    clearHoverIntent()
    suppressNextHoverRef.current = false
    hoverPausedRef.current = false
    manualPausedRef.current = false
    isResumingRef.current = false
    previousFrameRef.current = null
    badgeFrameRef.current = 0
    oscillationTimeRef.current = 0
    driftStrengthRef.current = 0
    offsetRef.current = getFocusedOffset(viewport.clientWidth, viewport.clientHeight, layout)
    applyWallOffset(wall, offsetRef.current)
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

      if (manualResumeTimerRef.current != null) {
        window.clearTimeout(manualResumeTimerRef.current)
        manualResumeTimerRef.current = null
      }
      offsetRef.current = getFocusedOffset(resizedViewport.clientWidth, resizedViewport.clientHeight, layoutRef.current)
      applyWallOffset(resizedWall, offsetRef.current)
      driftStrengthRef.current = 0
      clearHoverIntent()
      suppressNextHoverRef.current = false
      hoverPausedRef.current = false
      isResumingRef.current = false
      setManualPaused(false)
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
      if (manualResumeTimerRef.current != null) {
        window.clearTimeout(manualResumeTimerRef.current)
        manualResumeTimerRef.current = null
      }
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
    wall.style.transition = ''

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

    wall.style.transition = `transform ${SMOOTH_PAN_DURATION}ms cubic-bezier(0.25, 0.46, 0.45, 0.94)`
    applyWallOffset(wall, nextOffset)
    wall.addEventListener('transitionend', () => {
      wall.style.transition = ''
    }, { once: true })

    syncVisibleOrder(activeLayout, viewport.clientWidth, viewport.clientHeight, nextOffset)

    if (manualResumeTimerRef.current != null) {
      window.clearTimeout(manualResumeTimerRef.current)
    }
    manualResumeTimerRef.current = window.setTimeout(() => {
      manualResumeTimerRef.current = null
      resumeAutoDriftRef.current(true)
    }, MANUAL_RESUME_IDLE_MS)
  }, [clearHoverIntent, setManualPaused, syncVisibleOrder])

  const resumeAutoDrift = useCallback((fromManual = false) => {
    const viewport = viewportRef.current
    const wall = wallRef.current

    if (manualResumeTimerRef.current != null) {
      window.clearTimeout(manualResumeTimerRef.current)
      manualResumeTimerRef.current = null
    }

    clearHoverIntent()
    suppressNextHoverRef.current = false
    hoverPausedRef.current = false
    setHoveredId(null)
    previousFrameRef.current = null

    if ((fromManual || manualPausedRef.current) && viewport && wall) {
      isResumingRef.current = true
      oscillationTimeRef.current = 0
      driftStrengthRef.current = 0
      setManualPaused(false)

      const target = getFocusedOffset(viewport.clientWidth, viewport.clientHeight, layoutRef.current)
      offsetRef.current = target
      syncVisibleOrder(layoutRef.current, viewport.clientWidth, viewport.clientHeight, target)

      wall.style.transition = `transform ${RESUME_TRANSITION_MS}ms cubic-bezier(0.4, 0, 0.2, 1)`
      applyWallOffset(wall, target)

      wall.addEventListener('transitionend', () => {
        wall.style.transition = ''
        isResumingRef.current = false
        scheduleAnimation()
      }, { once: true })
    } else {
      if (wall) wall.style.transition = ''
      setManualPaused(false)
      scheduleAnimation()
    }
  }, [clearHoverIntent, scheduleAnimation, setManualPaused, syncVisibleOrder])

  useEffect(() => {
    resumeAutoDriftRef.current = resumeAutoDrift
  }, [resumeAutoDrift])

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
        <div className={styles.wall} style={{ width: layout.totalWidth, height: layout.totalHeight }}>
          <div className={styles.wallMotion} ref={wallRef}>
            {layout.items.map((layoutItem) => {
              const isHovered = activeHoveredId === layoutItem.item.id
              const isDimmed = activeHoveredId !== null && activeHoveredId !== layoutItem.item.id

              return (
                <div
                  key={layoutItem.item.id}
                  className={[
                    styles.tile,
                    isFeaturedOrder(layoutItem.item.order) ? styles.tileFeatured : '',
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

                    suppressNextHoverRef.current = false
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
                    <div className={styles.tileShade} />
                    <span className={styles.tileIndex}>#{layoutItem.item.order}</span>
                    <div className={styles.tileHoverContent}>
                      <div className={styles.tileHoverTitle}>{layoutItem.item.title}</div>
                      <div className={styles.tileHoverArtists}>{layoutItem.item.artists}</div>
                      <div className={styles.tileHoverAlbum}>{layoutItem.item.album}</div>
                      <div className={styles.tileHoverMeta}>
                        {layoutItem.item.meta.map((value, index) => (
                          <Fragment key={`${layoutItem.item.id}-${value}`}>
                            {index > 0 ? <span className={styles.tileHoverMetaDot}>·</span> : null}
                            <span>{value}</span>
                          </Fragment>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className={`${styles.fade} ${styles.fadeTop}`} />
        <div className={`${styles.fade} ${styles.fadeBottom}`} />
        <div className={`${styles.fade} ${styles.fadeLeft}`} />
        <div className={`${styles.fade} ${styles.fadeRight}`} />

        <button
          type="button"
          className={styles.edgeButtonTop}
          onClick={() => moveViewport('up')}
          aria-label="向上移动视口"
        >
          <ArrowUp size={16} strokeWidth={2} />
        </button>
        <button
          type="button"
          className={styles.edgeButtonBottom}
          onClick={() => moveViewport('down')}
          aria-label="向下移动视口"
        >
          <ArrowDown size={16} strokeWidth={2} />
        </button>
        <button
          type="button"
          className={styles.edgeButtonLeft}
          onClick={() => moveViewport('left')}
          aria-label="向左移动视口"
        >
          <ArrowLeft size={16} strokeWidth={2} />
        </button>
        <button
          type="button"
          className={styles.edgeButtonRight}
          onClick={() => moveViewport('right')}
          aria-label="向右移动视口"
        >
          <ArrowRight size={16} strokeWidth={2} />
        </button>
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

        <button
          type="button"
          className={[styles.autoButton, !isManualNavigation ? styles.autoButtonActive : ''].filter(Boolean).join(' ')}
          onClick={() => resumeAutoDrift(isManualNavigation)}
          aria-label="恢复自动漂移"
          aria-pressed={!isManualNavigation}
        >
          AUTO
        </button>
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