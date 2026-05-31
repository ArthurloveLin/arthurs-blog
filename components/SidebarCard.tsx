import type { ReactNode, Ref } from 'react'
import { CARD_SURFACE, EYEBROW } from './cardSurface'

/**
 * Shared chrome for the homepage/blog sidebar widget cards
 * (categories, archive, recent posts, tags, tools).
 *
 * Owns the card surface (border, radius, shadow, hover lift) and the mono
 * uppercase section title so the long Tailwind string isn't copy-pasted into
 * every widget. Pass `titleAccessory` for a control rendered on the title row
 * (e.g. the tag cloud's expand toggle); content goes in `children`.
 */

const CARD_CLASS = `${CARD_SURFACE} p-5`

const TITLE_CLASS = EYEBROW

interface SidebarCardProps {
  title?: ReactNode
  /** Optional control aligned to the right of the title (e.g. an expand button). */
  titleAccessory?: ReactNode
  className?: string
  children: ReactNode
  ref?: Ref<HTMLDivElement>
}

export default function SidebarCard({
  title,
  titleAccessory,
  className,
  children,
  ref,
}: SidebarCardProps) {
  return (
    <div ref={ref} className={className ? `${CARD_CLASS} ${className}` : CARD_CLASS}>
      {title != null &&
        (titleAccessory != null ? (
          <div className="flex items-center justify-between mb-4">
            <h3 className={TITLE_CLASS}>{title}</h3>
            {titleAccessory}
          </div>
        ) : (
          <h3 className={`${TITLE_CLASS} mb-3`}>{title}</h3>
        ))}
      {children}
    </div>
  )
}
