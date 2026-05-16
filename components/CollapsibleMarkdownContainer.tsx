'use client'

import { useRef, useEffect, useCallback } from 'react'

const COLLAPSIBLE_TAGS = new Set(['H2', 'H3', 'H4'])

function getLevel(el: Element): number {
  return parseInt(el.tagName[1])
}

function getSectionSiblings(heading: Element): Element[] {
  const level = getLevel(heading)
  const siblings: Element[] = []
  let next = heading.nextElementSibling
  while (next) {
    if (COLLAPSIBLE_TAGS.has(next.tagName) && getLevel(next) <= level) break
    siblings.push(next)
    next = next.nextElementSibling
  }
  return siblings
}

// Walk up the DOM to find and expand any collapsed ancestor section bodies
function expandAncestors(heading: Element) {
  let node: Element | null = heading.parentElement
  while (node) {
    if (node.classList.contains('md-section-body-inner')) {
      const body = node.parentElement
      if (body?.classList.contains('md-section-body') && body.classList.contains('collapsed')) {
        const parentHeading = body.previousElementSibling
        parentHeading?.classList.remove('collapsed')
        body.classList.remove('collapsed')
      }
    }
    node = node.parentElement
  }
}

export default function CollapsibleMarkdownContainer({ children }: { children: React.ReactNode }) {
  const containerRef = useRef<HTMLDivElement>(null)

  const expandSection = useCallback((headingId: string) => {
    const container = containerRef.current
    if (!container) return
    const heading = container.querySelector<Element>(`h2[id="${headingId}"], h3[id="${headingId}"], h4[id="${headingId}"]`)
    if (!heading) return

    // Expand this heading's section body
    const body = heading.nextElementSibling
    if (body?.classList.contains('md-section-body')) {
      heading.classList.remove('collapsed')
      body.classList.remove('collapsed')
    }

    // Expand any collapsed ancestor section (e.g. H2 wrapping this H3)
    expandAncestors(heading)
  }, [])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    // Snapshot the heading list before any DOM manipulation
    const headings = Array.from(container.querySelectorAll<Element>('h2[id], h3[id], h4[id]'))

    headings.forEach((heading) => {
      const siblings = getSectionSiblings(heading)
      if (siblings.length === 0) return

      // Build the collapsible wrapper
      const body = document.createElement('div')
      body.className = 'md-section-body'
      const inner = document.createElement('div')
      inner.className = 'md-section-body-inner'
      body.appendChild(inner)
      siblings.forEach((el) => inner.appendChild(el))
      heading.insertAdjacentElement('afterend', body)

      // Mark heading as interactive
      heading.classList.add('md-heading-collapsible')

      let collapsed = false

      heading.addEventListener('click', () => {
        collapsed = !collapsed
        heading.classList.toggle('collapsed', collapsed)
        body.classList.toggle('collapsed', collapsed)
      })
    })

    const handleExpand = (e: Event) => {
      const { id } = (e as CustomEvent<{ id: string }>).detail
      expandSection(id)
    }
    window.addEventListener('expand-heading', handleExpand)
    return () => window.removeEventListener('expand-heading', handleExpand)
  }, [expandSection])

  return <div ref={containerRef}>{children}</div>
}
