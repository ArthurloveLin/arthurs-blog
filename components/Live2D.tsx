'use client'

import { useEffect, useRef, useState } from 'react'
import * as PIXI from 'pixi.js'
import { useSiteConfig } from './SiteDataProvider'

declare global {
  interface Window {
    // Cubism 2.1 WebGL core globals (Live2D, Live2DModelWebGL, UtSystem...) are
    // installed onto window by the external core script. pixi-live2d-display's
    // /cubism2 runtime hooks into them; it does NOT bundle the core itself.
    Live2D?: unknown
    PIXI?: unknown
  }
}

/**
 * Loads the Cubism 2.1 core script (live2d.min.js) exactly once and resolves
 * when the global runtime is available. The engine URL must point to a Cubism 2
 * *core* build that exposes the `Live2D` / `Live2DModelWebGL` globals — the
 * legacy `loadlive2d` widget wrapper is unnecessary here (pixi-live2d-display
 * drives the model via PixiJS, not via loadlive2d).
 */
let cubism2CorePromise: Promise<void> | null = null
function ensureCubism2Core(engineUrl: string): Promise<void> {
  if (typeof window !== 'undefined' && window.Live2D) return Promise.resolve()
  if (cubism2CorePromise) return cubism2CorePromise

  cubism2CorePromise = new Promise<void>((resolve, reject) => {
    const scriptId = 'live2d-cubism2-core'
    const existing = document.getElementById(scriptId) as HTMLScriptElement | null
    if (existing) {
      if (window.Live2D) {
        resolve()
      } else {
        existing.addEventListener('load', () => resolve())
        existing.addEventListener('error', () => reject(new Error('Live2D core failed to load')))
      }
      return
    }

    const script = document.createElement('script')
    script.id = scriptId
    script.src = engineUrl
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => {
      // Allow a future mount to retry from scratch.
      cubism2CorePromise = null
      reject(new Error('Live2D core failed to load'))
    }
    document.body.appendChild(script)
  })

  return cubism2CorePromise
}

export default function Live2D() {
  const config = useSiteConfig()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [isDesktop] = useState(() => window.matchMedia('(min-width: 1024px)').matches)

  const canvasWidth = Number(config.live2d_canvas_width) || 280
  const canvasHeight = Number(config.live2d_canvas_height) || 240

  const defaultPosition = { left: 4, bottom: -2 }
  const [pos, setPos] = useState(() => {
    if (typeof window === 'undefined') {
      return defaultPosition
    }

    const savedPos = window.localStorage.getItem('tororo-pos')
    if (!savedPos) {
      return defaultPosition
    }

    try {
      const parsed = JSON.parse(savedPos)
      // Migration: if it's the old format with 'top', discard it and use default.
      // v2 migration: coordinates changed from column-relative to full-hero-relative;
      // any left > 30 is almost certainly a stale column-relative value, discard it.
      if (parsed.top !== undefined && parsed.bottom === undefined) {
        return defaultPosition
      }
      if (typeof parsed.left === 'number' && parsed.left > 30) {
        return defaultPosition
      }
      return parsed
    } catch (error) {
      console.error('Failed to parse saved position', error)
      return defaultPosition
    }
  })
  const [isDragging, setIsDragging] = useState(false)
  const [isVisible, setIsVisible] = useState(true)
  const [opacity, setOpacity] = useState(0)
  const dragStartPos = useRef({ x: 0, y: 0, left: 0, bottom: 0 })

  // PixiJS application handle + latest visibility, read by async init / effects.
  const appRef = useRef<PIXI.Application | null>(null)
  const isVisibleRef = useRef(isVisible)
  // Latest cursor position (client coords). Written by a passive global listener
  // doing zero layout work; consumed once per frame inside the ticker.
  const pointerRef = useRef<{ x: number; y: number } | null>(null)
  useEffect(() => {
    isVisibleRef.current = isVisible
  }, [isVisible])

  useEffect(() => {
    // Initial fade in
    const timer = setTimeout(() => setOpacity(1), 150)
    return () => clearTimeout(timer)
  }, [])

  // Visibility Optimization: IntersectionObserver
  useEffect(() => {
    // Use a small buffer to ensure the cat is truly out of view
    if (!containerRef.current) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting)
      },
      {
        threshold: 0,
        rootMargin: '100px' // Start loading/rendering slightly before it enters view
      }
    )
    observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [])

  // Live2D rendering via PixiJS + pixi-live2d-display (Cubism 2.1).
  // Replaces the legacy `loadlive2d` widget, whose internal rAF loop could not
  // be paused — here we own the PIXI ticker and stop it when off-screen.
  useEffect(() => {
    if (!isDesktop) return

    const modelUrl = config.live2d_model_url || 'https://cdn.arthurlovegrace.top/tororo/tororo.model.json'
    const engineUrl = config.live2d_engine_js_url || 'https://cdn.arthurlovegrace.top/js/live2d.js'

    let cancelled = false
    let app: PIXI.Application | null = null
    let cleanupPointer: (() => void) | null = null

    void (async () => {
      try {
        // Both are independent: core script download and library chunk import
        // can race in parallel, saving one full network round-trip.
        const [, { Live2DModel }] = await Promise.all([
          ensureCubism2Core(engineUrl),
          import('pixi-live2d-display/cubism2'),
        ])
        if (cancelled || !canvasRef.current) return
        // Expose PIXI so the plugin can reference window.PIXI internals.
        window.PIXI = PIXI

        app = new PIXI.Application({
          view: canvasRef.current,
          width: canvasWidth,
          height: canvasHeight,
          backgroundAlpha: 0,
          antialias: true,
          autoStart: false, // we drive start()/stop() from visibility
        })

        // autoUpdate:false → motion/physics advance only through our ticker, so
        // stopping the ticker fully pauses the model. autoInteract:false → our
        // own pointer handlers own dragging; no global listeners are added.
        const model = await Live2DModel.from(modelUrl, { autoUpdate: false, autoInteract: false })
        if (cancelled || !app) {
          model.destroy()
          return
        }

        app.stage.addChild(model)

        const scale = Math.min(canvasWidth / model.width, canvasHeight / model.height)
        model.scale.set(scale)
        model.x = (canvasWidth - model.width) / 2
        model.y = canvasHeight - model.height // bottom-align within the canvas

        // Cursor-follow: the listener only records coordinates (no layout read,
        // passive). The look-at is applied in the ticker — one update per frame,
        // and skipped entirely while off-screen since the ticker is stopped.
        const onPointerMove = (e: PointerEvent) => {
          pointerRef.current = { x: e.clientX, y: e.clientY }
        }
        window.addEventListener('pointermove', onPointerMove, { passive: true })
        cleanupPointer = () => window.removeEventListener('pointermove', onPointerMove)

        const canvas = canvasRef.current
        app.ticker.add(() => {
          const pointer = pointerRef.current
          if (pointer && canvas) {
            // Single getBoundingClientRect per frame, no interleaved DOM writes
            // (the model renders to WebGL), so this does not thrash layout.
            const rect = canvas.getBoundingClientRect()
            model.focus(pointer.x - rect.left, pointer.y - rect.top)
          }
          model.update(app!.ticker.deltaMS)
        })

        appRef.current = app
        if (isVisibleRef.current) app.start()
      } catch (err) {
        console.error('Live2D init error:', err)
      }
    })()

    return () => {
      cancelled = true
      appRef.current = null
      cleanupPointer?.()
      // removeView=false: the <canvas> is owned by React; let it unmount it.
      app?.destroy(false, { children: true, texture: true, baseTexture: true })
    }
  }, [config.live2d_model_url, config.live2d_engine_js_url, canvasWidth, canvasHeight, isDesktop])

  // Pause the render loop while the mascot is scrolled out of view.
  useEffect(() => {
    const app = appRef.current
    if (!app) return
    if (isVisible) app.start()
    else app.stop()
  }, [isVisible])

  // Dragging Logic
  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDragging(true)
    dragStartPos.current = {
      x: e.clientX,
      y: e.clientY,
      left: pos.left,
      bottom: pos.bottom
    }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return

    // Use the parent of the container for bounds calculation
    const parent = containerRef.current?.parentElement
    if (!parent) return

    const parentRect = parent.getBoundingClientRect()
    const deltaX = ((e.clientX - dragStartPos.current.x) / parentRect.width) * 100
    const deltaY = ((e.clientY - dragStartPos.current.y) / parentRect.height) * 100

    let newLeft = dragStartPos.current.left + deltaX
    // Moving mouse down (positive deltaY) should DECREASE bottom offset
    let newBottom = dragStartPos.current.bottom - deltaY

    // Bounds check
    // Allow exceeding bottom slightly? No, stick to bottom
    newLeft = Math.max(-20, Math.min(100, newLeft))
    newBottom = Math.max(-10, Math.min(85, newBottom))

    setPos({ left: newLeft, bottom: newBottom })
  }

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsDragging(false)
    e.currentTarget.releasePointerCapture(e.pointerId)
    localStorage.setItem('tororo-pos', JSON.stringify(pos))
  }

  if (!isDesktop) return null

  return (
    <div
      ref={containerRef}
      className="absolute z-10 hidden lg:block touch-none"
      style={{
        left: `${pos.left}%`,
        bottom: `${pos.bottom}%`,
        opacity: isVisible ? opacity : 0,
        transition: isDragging ? 'none' : 'left 0.5s ease-out, bottom 0.5s ease-out, opacity 0.5s ease-in-out',
        visibility: isVisible ? 'visible' : 'hidden',
        pointerEvents: 'none'
      }}
    >
      <div
        className="relative group pointer-events-auto"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <canvas
          id="live2d-canvas"
          ref={canvasRef}
          width={canvasWidth}
          height={canvasHeight}
          className={`cursor-grab active:cursor-grabbing transition-transform duration-300 origin-bottom`}
        />
        {/* Shadow */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-32 h-4 bg-black/5 blur-xl rounded-[100%] -z-10 group-hover:bg-black/10 transition-colors duration-500" />
      </div>
    </div>
  )
}
