'use client'

import { useRouter } from 'next/navigation'

interface Props {
  href: string
  className?: string
  children: React.ReactNode
}

export default function PrefetchOnHover({ href, className, children }: Props) {
  const router = useRouter()
  return (
    <article className={className} onMouseEnter={() => router.prefetch(href)}>
      {children}
    </article>
  )
}
