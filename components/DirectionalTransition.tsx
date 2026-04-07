import { unstable_ViewTransition as ViewTransition } from 'react'

interface Props {
  children: React.ReactNode
}

/**
 * Wraps page content in a ViewTransition with default="none" to prevent
 * Suspense/ISR revalidation from triggering accidental animations.
 * Directional CSS animations (nav-forward / nav-back) are driven by
 * addTransitionType() calls at the navigation site + globals.css keyframes.
 */
export default function DirectionalTransition({ children }: Props) {
  return (
    <ViewTransition default="none">
      {children}
    </ViewTransition>
  )
}
