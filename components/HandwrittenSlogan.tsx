'use client'

import React from 'react'
import { TegakiRenderer } from 'tegaki/react'
import caveat from 'tegaki/fonts/caveat'

interface HandwrittenSloganProps {
  text1: string
  text2?: string
  delay?: number
  speed1?: number
  speed2?: number
  onComplete?: () => void
  onLine1Complete?: () => void
  size1?: string
  size2?: string
  className?: string
  color?: string
  textAlign?: 'left' | 'center' | 'right'
}

export default function HandwrittenSlogan({
  text1,
  text2,
  delay = 0.5,
  speed1 = 1.8,
  speed2 = 1.6,
  onComplete,
  onLine1Complete,
  size1 = '68px',
  size2 = '46px',
  className = '',
  color = 'var(--ty-primary, #7c3aed)',
  textAlign = 'center',
}: HandwrittenSloganProps) {
  const [showSecondLine, setShowSecondLine] = React.useState(false)
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  const alignmentClass = {
    left: 'text-left',
    center: 'text-center',
    right: 'text-right'
  }[textAlign]

  if (!mounted) return null

  return (

    <div className={`handwritten-slogan-root relative w-full select-none pointer-events-none flex flex-col justify-center items-center ${className}`}>
      <div className={`w-full ${alignmentClass}`}>
        <TegakiRenderer 
          font={caveat} 
          time={{ mode: 'uncontrolled', speed: speed1, delay }}
          onComplete={() => {
            setShowSecondLine(true)
            onLine1Complete?.()
            if (!text2) onComplete?.()
          }}
          style={{ 
            fontSize: size1,
            color,
            fontWeight: 500,
            lineHeight: 1.1
          }}
          className="slogan-line-1"
        >
          {text1}
        </TegakiRenderer>
      </div>

      {text2 && (
        <div 
          className={`w-full ${alignmentClass}`} 
          style={{ 
            opacity: showSecondLine ? 1 : 0,
            transition: 'opacity 0.3s ease-out'
          }}
        >
          <TegakiRenderer 
            font={caveat} 
            time={{ mode: 'uncontrolled', speed: speed2, playing: showSecondLine }}
            onComplete={onComplete}
            style={{ 
              fontSize: size2,
              color,
              fontWeight: 400,
              opacity: 0.85,
              lineHeight: 1.1
            }}
            className="slogan-line-2"
          >
            {text2}
          </TegakiRenderer>
        </div>
      )}


      <style jsx>{`
        .handwritten-slogan-root {
          /* Add some vertical space if needed */
          min-height: ${text2 ? '120px' : '60px'};
        }

        @media (max-width: 768px) {
           .handwritten-slogan-root {
            min-height: ${text2 ? '80px' : '40px'};
          }
        }
      `}</style>
    </div>
  )
}
