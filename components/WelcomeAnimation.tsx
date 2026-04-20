'use client'

import React, { useEffect, useRef, useState } from 'react'
import { TegakiRenderer } from 'tegaki/react'
import caveat from 'tegaki/fonts/caveat'
import gsap from 'gsap'

interface WelcomeAnimationProps {
  onFinish?: () => void
}

export default function WelcomeAnimation({ onFinish }: WelcomeAnimationProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [mounted, setMounted] = useState(false)
  const [showSecondLine, setShowSecondLine] = useState(false)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true)
  }, [])

  const startFadeOut = () => {
    if (!containerRef.current) return
    
    // Hold for 3 seconds after the second line is fully written, then fade out
    gsap.to(containerRef.current, {
      opacity: 0,
      duration: 1.5,
      delay: 3,
      ease: 'power2.inOut',
      onComplete: () => {
        if (containerRef.current) {
          containerRef.current.style.display = 'none'
        }
        onFinish?.()
      }
    })
  }

  if (!mounted) return null

  return (
    <div 
      ref={containerRef}
      className="thank-you-root relative w-full h-[100px] md:h-[320px] max-w-[900px] mx-auto select-none pointer-events-none flex flex-col justify-center items-center p-4 md:p-8"
    >
      <div className="w-full text-center md:text-left md:pl-28">
        <TegakiRenderer 
          font={caveat} 
          time={{ mode: 'uncontrolled', speed: 1.8, delay: 0.5 }}
          onComplete={() => setShowSecondLine(true)}
          style={{ 
            fontSize: 'max(20px, min(5vw, 28px))', 
            // We use a CSS class for responsive font size instead
            color: 'var(--ty-primary)',
            fontWeight: 500,
            lineHeight: 1.1
          }}
          className="welcome-text-line-1"
        >
          Welcome to my Blog
        </TegakiRenderer>
      </div>

      <div className="w-full text-center md:text-right md:pr-32" style={{ transform: 'translateY(-2px)', opacity: showSecondLine ? 1 : 0 }}>
        <TegakiRenderer 
          font={caveat} 
          time={{ mode: 'uncontrolled', speed: 1.6, playing: showSecondLine }}
          onComplete={startFadeOut}
          style={{ 
            fontSize: 'max(14px, min(4vw, 20px))', 
            color: 'var(--ty-primary)',
            fontWeight: 400,
            opacity: 0.85,
            lineHeight: 1.1
          }}
          className="welcome-text-line-2"
        >
          Arthur & Grace
        </TegakiRenderer>
      </div>

      <style jsx>{`
        .thank-you-root {
          /* Theme Variables */
          --ty-primary: #7c3aed;
          transform: translateY(-50px) translateX(60px);
        }

        :global(.welcome-text-line-1) { font-size: 68px !important; }
        :global(.welcome-text-line-2) { font-size: 46px !important; }

        @media (max-width: 768px) {
          .thank-you-root {
            transform: none;
          }
          :global(.welcome-text-line-1) { font-size: 40px !important; }
          :global(.welcome-text-line-2) { font-size: 24px !important; }
        }

        :global(.dark) .thank-you-root {
          --ty-primary: #a78bfa;
        }

        :global(.ocean) .thank-you-root {
          --ty-primary: #0ea5e9;
        }

        :global(.sunset) .thank-you-root {
          --ty-primary: #f97316;
        }

        :global(.forest) .thank-you-root {
          --ty-primary: #10b981;
        }
      `}</style>
    </div>
  )
}
