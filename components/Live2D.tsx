'use client'

import { useEffect, useRef, useState } from 'react'

declare global {
  interface Window {
    loadlive2d?: (id: string, url: string) => void
  }
}

export default function Live2D() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState(() => {
    if (typeof window === 'undefined') {
      return { left: 80, top: 40 }
    }

    const savedPos = window.localStorage.getItem('tororo-pos')
    if (!savedPos) {
      return { left: 80, top: 40 }
    }

    try {
      return JSON.parse(savedPos)
    } catch (error) {
      console.error('Failed to parse saved position', error)
      return { left: 80, top: 40 }
    }
  })
  const [isDragging, setIsDragging] = useState(false)
  const [isVisible, setIsVisible] = useState(true)
  const [opacity, setOpacity] = useState(0)
  const dragStartPos = useRef({ x: 0, y: 0, left: 0, top: 0 })

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
    const modelUrl = '/live2d/tororo/tororo.model.json'
    const scriptId = 'live2d-js-engine'
    
    const initModel = () => {
      if (window.loadlive2d && canvasRef.current) {
        try {
          window.loadlive2d('live2d-tororo', modelUrl)
        } catch (err) {
          console.error('Live2D init error:', err)
        }
      }
    }

    let script = document.getElementById(scriptId) as HTMLScriptElement
    if (!script) {
      script = document.createElement('script')
      script.id = scriptId
      script.src = '/live2d/js/live2d.js'
      script.async = true
      script.onload = initModel
      document.body.appendChild(script)
    } else if (window.loadlive2d) {
      initModel()
    } else {
      script.addEventListener('load', initModel)
    }
  }, [])

  // Dragging Logic
  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDragging(true)
    dragStartPos.current = {
      x: e.clientX,
      y: e.clientY,
      left: pos.left,
      top: pos.top
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
    let newTop = dragStartPos.current.top + deltaY
    
    // Bounds check
    // Allow exceeding top (no min check for top)
    // But don't allow exceeding bottom (cap at 85% to keep cat sitting on the line)
    newLeft = Math.max(-20, Math.min(100, newLeft)) 
    newTop = Math.min(85, newTop) 
    
    setPos({ left: newLeft, top: newTop })
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
        top: `${pos.top}%`,
        opacity: isVisible ? opacity : 0,
        transition: isDragging ? 'none' : 'left 0.5s ease-out, top 0.5s ease-out, opacity 0.5s ease-in-out',
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
          id="live2d-tororo"
          ref={canvasRef}
          width={280}
          height={240}
          className={`cursor-grab active:cursor-grabbing ${isDragging ? 'scale-110' : 'hover:scale-105'} transition-transform duration-300 origin-bottom`}
        />
        {/* Shadow */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-32 h-4 bg-black/5 blur-xl rounded-[100%] -z-10 group-hover:bg-black/10 transition-colors duration-500" />
      </div>
    </div>
  )
}
