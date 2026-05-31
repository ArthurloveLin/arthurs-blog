/**
 * Shared visual primitives for card surfaces and section labels.
 *
 * Before this existed, PostCard, SidebarCard and the spotify/memo panels each
 * hand-rolled a slightly different border + shadow + hover string (and the
 * blog cards carried an unmotivated 3px x-offset shadow). Route surfaces
 * through CARD_SURFACE so elevation reads as one family across the site;
 * dark mode drops the shadow and brightens the border instead.
 */

export const CARD_SURFACE =
  'bg-card text-card-foreground rounded-2xl border border-border/50 dark:border-white/10 shadow-[0_4px_24px_rgba(0,0,0,0.06)] dark:shadow-none transition duration-300 hover:-translate-y-1 hover:shadow-[0_10px_36px_rgba(0,0,0,0.10)] dark:hover:border-white/20'

/**
 * Canonical mono-uppercase eyebrow / section label. Replaces the ~16 different
 * letter-spacing values that the same label pattern had drifted into.
 */
export const EYEBROW =
  'font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground'
