'use client'

import dynamic from 'next/dynamic'
import React from 'react'

const HandwrittenSlogan = dynamic(() => import('./HandwrittenSlogan'), {
  ssr: false,
})

interface HandwrittenSloganClientProps {
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

export default function HandwrittenSloganClient(props: HandwrittenSloganClientProps) {
  return <HandwrittenSlogan {...props} />
}
