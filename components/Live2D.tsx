'use client'

import { useEffect, useRef, useState } from 'react'
import { useSiteConfig } from './SiteDataProvider'

declare global {
  interface Window {
    loadlive2d?: (id: string, url: string) => void
  }
}

export default function Live2D() {
  const config = useSiteConfig()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const canvasWidth = Number(config.live2d_canvas_width) || 280
  const canvasHeight = Number(config.live2d_canvas_height) || 240

  const defaultPosition = { left: 50, bottom: 0 }
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
      // Migration: if it's the old format with 'top', discard it and use default
      if (parsed.top !== undefined && parsed.bottom === undefined) {
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

  useEffect(() => {
    // Initial fade in
    setTimeout(() => setOpacity(1), 500)
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

  // Live2D Initialization
  useEffect(() => {
    // Default to the R2 CDN for the core model and engine if no custom config exists
    const modelUrl = config.live2d_model_url || 'https://cdn.arthurlovegrace.top/tororo/tororo.model.json'
    const engineUrl = config.live2d_engine_js_url || 'https://cdn.arthurlovegrace.top/js/live2d.js'
    const scriptId = 'live2d-js-engine'

    const initModel = () => {
      if (window.loadlive2d && canvasRef.current) {
        try {
          // Use the constant canvas ID but dynamic model URL
          window.loadlive2d('live2d-canvas', modelUrl)
        } catch (err) {
          console.error('Live2D init error:', err)
        }
      }
    }

    let script = document.getElementById(scriptId) as HTMLScriptElement
    if (!script) {
      script = document.createElement('script')
      script.id = scriptId
      script.src = engineUrl
      script.async = true
      script.onload = initModel
      document.body.appendChild(script)
    } else {
      // If script exists, we might need to update its src if the engineUrl changed
      // but usually the engine is the same. To be safe, if engineUrl changed, 
      // we'd need to reload but that's complex. Most models use the same v2 engine.
      if (window.loadlive2d) {
        initModel()
      } else {
        script.addEventListener('load', initModel)
      }
    }
  }, [config.live2d_model_url, config.live2d_engine_js_url, config.live2d_canvas_width, config.live2d_canvas_height])

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
          className={`cursor-grab active:cursor-grabbing ${isDragging ? 'scale-110' : 'hover:scale-105'} transition-transform duration-300 origin-bottom`}
        />
        {/* Shadow */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-32 h-4 bg-black/5 blur-xl rounded-[100%] -z-10 group-hover:bg-black/10 transition-colors duration-500" />
      </div>
    </div>
  )
}
