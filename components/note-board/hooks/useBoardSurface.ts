import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { NotePosition, Size } from '@/components/note-board/types'
import { computeBoardLayout } from '@/components/note-board/utils/board'
import type { NoteMessage } from '@/lib/note-boards'

interface UseBoardSurfaceProps {
  messages: NoteMessage[]
  visibleMessages: NoteMessage[]
  initialMessages: NoteMessage[]
}

export function useBoardSurface({
  messages,
  visibleMessages,
  initialMessages,
}: UseBoardSurfaceProps) {
  const [containerElement, setContainerElement] = useState<HTMLDivElement | null>(null)
  const [editorSectionElement, setEditorSectionElement] = useState<HTMLElement | null>(null)
  const [size, setSize] = useState<Size>({ width: 0, height: 0 })
  const [measuredHeights, setMeasuredHeights] = useState<Record<string, number>>({})
  const [customPositions, setCustomPositions] = useState<Record<string, NotePosition>>({})
  const [cardZIndices, setCardZIndices] = useState<Record<string, number>>(() =>
    Object.fromEntries(initialMessages.map((message, index) => [message.id, initialMessages.length - index + 1])),
  )
  const [isScattered, setIsScattered] = useState(false)
  const [mobileView, setMobileView] = useState<'stack' | 'list'>('stack')

  const zIndexCounterRef = useRef(initialMessages.length + 2)
  const recordedHeightIdsRef = useRef<Set<string>>(new Set())
  const customPositionsRef = useRef<Record<string, NotePosition>>({})
  const cardZIndicesRef = useRef<Record<string, number>>(
    Object.fromEntries(initialMessages.map((message, index) => [message.id, initialMessages.length - index + 1])),
  )
  const getTargetPositionRef = useRef<(index: number) => NotePosition>(() => ({ x: 0, y: 0, rotation: 0 }))

  const messageIdsSignature = useMemo(() => visibleMessages.map((message) => message.id).join('|'), [visibleMessages])

  const { cardWidth, height, layouts } = useMemo(
    () => computeBoardLayout(visibleMessages, size.width, measuredHeights),
    [visibleMessages, size.width, measuredHeights],
  )

  const hasMeasured = size.width > 0 && size.height > 0
  const canInitializeSurface = hasMeasured && (visibleMessages.length === 0 || visibleMessages.every((message) => measuredHeights[message.id] > 0))

  const bindContainer = useCallback((node: HTMLDivElement | null) => {
    setContainerElement(node)
  }, [])

  const bindEditorSection = useCallback((node: HTMLElement | null) => {
    setEditorSectionElement(node)
  }, [])

  const toggleMobileView = useCallback(() => {
    setMobileView((current) => current === 'stack' ? 'list' : 'stack')
  }, [])

  const setCardPosition = useCallback((id: string, nextPosition: NotePosition) => {
    setCustomPositions((current) => {
      const next = { ...current, [id]: nextPosition }
      customPositionsRef.current = next
      return next
    })
  }, [])

  const bringCardToFront = useCallback((id: string) => {
    setCardZIndices((current) => {
      const next = { ...current, [id]: zIndexCounterRef.current++ }
      cardZIndicesRef.current = next
      return next
    })
  }, [])

  const handleCardHeightChange = useCallback((id: string, nextHeight: number) => {
    setMeasuredHeights((current) => {
      if (current[id] === nextHeight) {
        return current
      }

      if (!recordedHeightIdsRef.current.has(id)) {
        recordedHeightIdsRef.current.add(id)
      }

      return { ...current, [id]: nextHeight }
    })
  }, [])

  const getTargetPosition = useCallback((index: number): NotePosition => {
    const layout = layouts[index]
    const fallbackX = Math.max((size.width - cardWidth) / 2, 0) + Math.min(index, 4) * 2
    const fallbackY = 22 + Math.min(index, 4) * 4

    return {
      x: layout?.x ?? fallbackX,
      y: layout?.y ?? fallbackY,
      rotation: layout?.rotation ?? (index % 2 === 0 ? -2 : 2),
    }
  }, [cardWidth, layouts, size.width])

  useEffect(() => {
    customPositionsRef.current = customPositions
  }, [customPositions])

  useEffect(() => {
    getTargetPositionRef.current = getTargetPosition
  }, [getTargetPosition])

  useEffect(() => {
    cardZIndicesRef.current = cardZIndices
  }, [cardZIndices])

  useEffect(() => {
    const element = containerElement
    if (!element) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSize({ width: 0, height: 0 })
      return
    }

    const update = () => {
      setSize({ width: element.clientWidth, height: element.clientHeight })
    }

    update()

    const observer = new ResizeObserver(update)
    observer.observe(element)

    return () => observer.disconnect()
  }, [containerElement])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMeasuredHeights((current) => {
      const nextEntries = Object.entries(current).filter(([id]) => messages.some((message) => message.id === id))

      if (nextEntries.length === Object.keys(current).length) {
        return current
      }

      return Object.fromEntries(nextEntries)
    })
  }, [messages])

  useEffect(() => {
    if (!canInitializeSurface) return

    const frame = window.requestAnimationFrame(() => setIsScattered(true))
    return () => window.cancelAnimationFrame(frame)
  }, [canInitializeSurface])

  useEffect(() => {
    if (!canInitializeSurface) return

    setCustomPositions((current) => {
      let changed = false
      const next = { ...current }

      visibleMessages.forEach((message, index) => {
        if (next[message.id]) {
          return
        }

        next[message.id] = getTargetPositionRef.current(index)
        changed = true
      })

      if (changed) {
        customPositionsRef.current = next
      }

      return changed ? next : current
    })
  }, [canInitializeSurface, messageIdsSignature, visibleMessages])

  useEffect(() => {
    setCardZIndices((current) => {
      const next: Record<string, number> = {}

      for (const message of messages) {
        next[message.id] = current[message.id] ?? zIndexCounterRef.current++
      }

      cardZIndicesRef.current = next

      return next
    })
  }, [messages])

  return {
    editorSectionElement,
    size,
    measuredHeights,
    customPositions,
    cardZIndices,
    isScattered,
    mobileView,
    cardWidth,
    height,
    layouts,
    hasMeasured,
    getTargetPosition,
    bindContainer,
    bindEditorSection,
    toggleMobileView,
    setCardPosition,
    bringCardToFront,
    handleCardHeightChange,
    setMeasuredHeights,
    setCustomPositions,
    setCardZIndices,
    zIndexCounterRef,
    recordedHeightIdsRef,
    customPositionsRef,
    cardZIndicesRef,
  }
}
