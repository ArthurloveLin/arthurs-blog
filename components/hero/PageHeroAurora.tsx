'use client'

import { useMemo, useState } from 'react'
import HandwrittenSloganClient from '@/components/HandwrittenSloganClient'
import { EYEBROW } from '@/components/cardSurface'
import type { PageHeroProps } from '@/components/hero/page-hero-props'

const SLOGAN_SIGNATURE_SEPARATOR = '::'

export default function PageHeroAurora({
  title,
  subtitle,
  description,
  slogan,
  blobColors = ['bg-primary/10', 'bg-secondary/10'],
  containerClass = 'site-shell',
}: PageHeroProps) {
  const sloganSignature = useMemo(
    () => slogan ? [slogan.text1, slogan.text2, slogan.size1, slogan.size2].join(SLOGAN_SIGNATURE_SEPARATOR) : null,
    [slogan],
  )
  const [completedSloganSignature, setCompletedSloganSignature] = useState<string | null>(null)
  const isSloganActive = Boolean(sloganSignature) && completedSloganSignature !== sloganSignature

  return (
    <div className="relative border-b border-border bg-background overflow-hidden">
      <div className={`absolute top-0 left-1/4 w-72 h-72 ${blobColors[0]} rounded-full filter blur-2xl opacity-40 animate-blob pointer-events-none`}></div>
      <div className={`absolute -top-10 right-1/4 w-72 h-72 ${blobColors[1]} rounded-full filter blur-2xl opacity-40 animate-blob animation-delay-2000 pointer-events-none`}></div>

      <div className={`${containerClass} relative pt-14 pb-12 lg:pt-20 lg:pb-16 z-10`}>
        {slogan && (
          <div className="pointer-events-none relative z-0 mb-4 flex h-[84px] items-center justify-center overflow-hidden md:absolute md:inset-0 md:mb-0 md:h-full">
            <HandwrittenSloganClient
              text1={slogan.text1}
              text2={slogan.text2}
              onComplete={() => setCompletedSloganSignature(sloganSignature)}
              size1={slogan.size1 || "max(32px, min(6vw, 68px))"}
              size2={slogan.size2 || "max(20px, min(4vw, 46px))"}
            />
          </div>
        )}

        <div className="relative z-10">
          {subtitle && (
             <p className={`mb-4 ${EYEBROW} text-[11px] transition-opacity duration-700 ${isSloganActive ? 'max-md:opacity-0' : 'max-md:opacity-100'}`}>
               {subtitle}
             </p>
          )}
          <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-[2.75rem] max-w-lg leading-[1.2]">
            {title}
          </h1>
          {description && (
             <p className="mt-4 text-sm leading-relaxed text-muted-foreground max-w-2xl">
               {description}
             </p>
          )}
        </div>
      </div>
    </div>
  )
}
