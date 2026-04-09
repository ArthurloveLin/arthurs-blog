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

  function handleClick() {
    // 记录当前滚动位置，供返回时恢复
    const referrer = window.location.pathname
    sessionStorage.setItem(`scroll-restore:${referrer}`, String(window.scrollY))

    const postSlug = href.startsWith('/blog/') ? href.slice('/blog/'.length) : null
    if (postSlug) {
      sessionStorage.setItem('blog-return:post-slug', postSlug)
      sessionStorage.setItem('blog-return:pathname', referrer)
    }
  }

  return (
    <article className={className} onMouseEnter={() => router.prefetch(href)} onClick={handleClick} {...rest}>
      {children}
    </article>
  )
}
