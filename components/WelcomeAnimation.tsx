'use client'

import React, { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { useSiteConfig } from '@/components/SiteDataProvider'
import HandwrittenSloganClient from '@/components/HandwrittenSloganClient'

interface WelcomeAnimationProps {
  onFinish?: () => void
}

export default function WelcomeAnimation({ onFinish }: WelcomeAnimationProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [mounted, setMounted] = useState(false)
  const siteConfig = useSiteConfig()

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
      <HandwrittenSloganClient 
        text1={siteConfig.site_slogan_1 || "Welcome to my Blog"}
        text2={siteConfig.site_slogan_2 || "Arthur & Grace"}
        onComplete={startFadeOut}
        className="welcome-slogan-wrapper"
        // We do not pass size1/size2 because we will override them with !important
        // to strictly match the original responsive sizes in CSS
      />

      <style jsx>{`
        .thank-you-root {
          /* Theme Variables */
          --ty-primary: #7c3aed;
          transform: translateY(-50px) translateX(60px);
        }

        /* 
          Override HandwrittenSlogan inline styles to perfectly match
          the old WelcomeAnimation responsive layout 
        */
        :global(.welcome-slogan-wrapper .slogan-line-1) { 
          font-size: 68px !important; 
          color: var(--ty-primary) !important;
        }
        :global(.welcome-slogan-wrapper .slogan-line-2) { 
          font-size: 46px !important; 
          color: var(--ty-primary) !important;
        }

        /* Desktop specific alignment */
        @media (min-width: 768px) {
          :global(.welcome-slogan-wrapper > div:nth-child(1)) {
            text-align: left !important;
            padding-left: 7rem !important; /* md:pl-28 */
          }
          :global(.welcome-slogan-wrapper > div:nth-child(2)) {
            text-align: right !important;
            padding-right: 8rem !important; /* md:pr-32 */
            transform: translateY(-2px) !important;
          }
        }

        @media (max-width: 767px) {
          .thank-you-root {
            transform: none;
          }
          :global(.welcome-slogan-wrapper .slogan-line-1) { font-size: 40px !important; }
          :global(.welcome-slogan-wrapper .slogan-line-2) { font-size: 24px !important; }
          /* On mobile, HandwrittenSlogan defaults to text-center, which matches original */
          :global(.welcome-slogan-wrapper > div:nth-child(2)) {
            transform: translateY(-2px) !important;
          }
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
