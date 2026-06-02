import type { ReactNode } from 'react'

/**
 * Props for the generic page header (PageHero) and its variant skins. Kept in a
 * standalone module so the dispatcher and both skins can share the type without
 * import cycles.
 */
export interface PageHeroProps {
  /** The main h1 title of the page */
  title: ReactNode
  /** Prefix text above the title */
  subtitle?: string
  /** Description below the title */
  description?: ReactNode
  /** Optional Slogan settings (aurora skin only — the terminal skin omits it) */
  slogan?: {
    text1: string
    text2?: string
    size1?: string
    size2?: string
  }
  /** Two classes for the background blobs (aurora skin only) */
  blobColors?: [string, string]
  /** Container class — `site-shell` (single column) or `site-shell-triad` (3-col) */
  containerClass?: string
  /** Filename shown in the terminal skin's `cat <filename>` command, e.g. "MEMO.md" */
  filename?: string
}
