import type { ReactNode, Ref } from 'react'

/**
 * Shared chrome for the homepage/blog sidebar widget cards
 * (categories, archive, recent posts, tags, tools).
 *
 * Owns the card surface (border, radius, shadow, hover lift) and the mono
 * uppercase section title so the long Tailwind string isn't copy-pasted into
 * every widget. Pass `titleAccessory` for a control rendered on the title row
 * (e.g. the tag cloud's expand toggle); content goes in `children`.
 */

const CARD_CLASS =
  'bg-card text-card-foreground rounded-2xl shadow-[3px_5px_30px_rgba(0,0,0,0.04)] dark:shadow-none border border-border/50 dark:border-white/10 transition duration-300 hover:-translate-y-1 hover:shadow-[3px_8px_36px_rgba(0,0,0,0.08)] dark:hover:border-white/20 p-5'

const TITLE_CLASS = 'font-mono text-[10px] tracking-[0.18em] text-muted-foreground uppercase'

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
