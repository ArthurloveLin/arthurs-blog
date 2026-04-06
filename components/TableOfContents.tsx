'use client'

import { useEffect, useState, useRef } from 'react'

interface TocItem {
  id: string
  text: string
  level: number
}

export default function TableOfContents({ content }: { content: string }) {
  const [toc, setToc] = useState<TocItem[]>([])
  const [activeId, setActiveId] = useState<string>('')
  const observer = useRef<IntersectionObserver | null>(null)

  useEffect(() => {
    // 1. Parse headings from content
    // We match ## and ### headers
    const headingRegex = /^(#{2,3})\s+(.+)$/gm
    const headings: TocItem[] = []
    let match

    while ((match = headingRegex.exec(content)) !== null) {
      const level = match[1].length
      const text = match[2].trim()
      // Generate slug consistent with rehype-slug
      // Note: This is an approximation. react-markdown with rehype-slug 
      // uses a more robust character-to-slug mapping.
      const id = text
        .toLowerCase()
        .replace(/[^\w\s\u4e00-\u9fa5-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')

      headings.push({ id, text, level })
    }
    setToc(headings)
  }, [content])

  useEffect(() => {
    // 2. Setup IntersectionObserver to track scroll
    const handleIntersect = (entries: IntersectionObserverEntry[]) => {
      // Find the entry that is most prominent or the first one in view
      const visibleEntry = entries.find((entry) => entry.isIntersecting)
      if (visibleEntry) {
        setActiveId(visibleEntry.target.id)
      }
    }

    observer.current = new IntersectionObserver(handleIntersect, {
      rootMargin: '-10% 0px -80% 0px', // Trigger when header is near the top
      threshold: 1.0,
    })

    // Observe all headings in the article
    const headingElements = document.querySelectorAll('h2[id], h3[id]')
    headingElements.forEach((el) => observer.current?.observe(el))

    return () => observer.current?.disconnect()
  }, [toc])

  if (toc.length === 0) return null

  return (
    <div className="bg-card text-card-foreground rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none border border-border/50 dark:border-white/10 transition duration-300 hover:-translate-y-1 hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] dark:hover:border-white/20 p-5">
      <h3 className="font-mono text-[10px] tracking-[0.18em] text-muted-foreground uppercase mb-4">
        目录
      </h3>
      <nav className="max-h-[60vh] overflow-y-auto custom-scrollbar">
        <ul className="space-y-2.5">
          {toc.map((item) => (
            <li 
              key={item.id}
              style={{ marginLeft: `${(item.level - 2) * 12}px` }}
              className="leading-tight"
            >
              <a
                href={`#${item.id}`}
                onClick={(e) => {
                  e.preventDefault()
                  document.getElementById(item.id)?.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                  })
                }}
                className={`text-[13px] transition-all duration-200 block border-l-2 py-0.5 pl-3 ${
                  activeId === item.id
                    ? 'border-primary text-primary font-medium bg-primary/5 rounded-r-md'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                }`}
              >
                {item.text}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}
