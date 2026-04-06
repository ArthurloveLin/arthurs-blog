'use client'

import React from 'react'
import { useRouter } from 'next/navigation'

interface Props extends React.HTMLAttributes<HTMLElement> {
  href: string
  className?: string
  children: React.ReactNode
}

export default function PrefetchOnHover({ href, className, children, ...rest }: Props) {
  const router = useRouter()
  return (
    <article className={className} onMouseEnter={() => router.prefetch(href)} {...rest}>
      {children}
    </article>
  )
}
