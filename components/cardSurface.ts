/**
 * Shared visual primitives for card surfaces and section labels.
 *
 * Before this existed, PostCard, SidebarCard and the spotify/memo panels each
 * hand-rolled a slightly different border + shadow + hover string (and the
 * blog cards carried an unmotivated 3px x-offset shadow). Route surfaces
 * through these so elevation reads as one family across the site; dark mode
 * drops the shadow and brightens the border instead.
 */

const SURFACE_BASE =
  'bg-card text-card-foreground rounded-2xl border border-border/50 dark:border-white/10 shadow-[0_4px_24px_rgba(0,0,0,0.06)] dark:shadow-none'

/** Interactive card: hovers with a lift + deeper shadow (lists, sidebar widgets). */
export const CARD_SURFACE = `${SURFACE_BASE} transition duration-300 hover:-translate-y-1 hover:shadow-[0_10px_36px_rgba(0,0,0,0.10)] dark:hover:border-white/20`

/** Non-interactive container card: same elevation, no hover affordance
 *  (e.g. the article body wrapper, the table-of-contents shell). */
export const CARD_SURFACE_STATIC = SURFACE_BASE

/**
 * Canonical mono-uppercase eyebrow / section label. Replaces the ~16 different
 * letter-spacing values that the same label pattern had drifted into.
 *
 * Size-free on purpose (like the typo-* roles): the same eyebrow ships at 10px
 * (sidebar / TOC) and 11px (hero / spotify panels), so the caller appends the
 * size — `${EYEBROW} text-[11px]`. Don't bake a size back in; that reintroduces
 * the text-size conflict this split removed.
 */
export const EYEBROW =
  'font-mono uppercase tracking-[0.18em] text-muted-foreground'
