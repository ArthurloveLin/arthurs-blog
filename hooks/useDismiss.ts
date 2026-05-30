import { useEffect, useRef, type RefObject } from 'react'

type AnyRef = RefObject<HTMLElement | null> | RefObject<HTMLElement>

interface UseDismissOptions {
  /** When false the listeners are not attached and scroll is not locked. Defaults to true. */
  enabled?: boolean
  /** Called when the user presses Escape or presses outside every ref in `refs`. */
  onDismiss: () => void
  /**
   * Pointer/mouse presses outside of *all* of these elements trigger `onDismiss`.
   * Omit to disable outside-press dismissal (Escape only).
   */
  refs?: AnyRef[]
  /** Lock `document.body` scroll while enabled. Defaults to false. */
  lockScroll?: boolean
  /** Event used to detect an outside press. Defaults to 'pointerdown'. */
  outsideEvent?: 'pointerdown' | 'mousedown'
}

/**
 * Dismissable-overlay primitive: closes a popover/menu/modal on Escape and,
 * optionally, on a pointer press outside the given element(s), with optional
 * body scroll lock. Replaces the hand-rolled keydown/pointerdown effects that
 * were duplicated across overlays.
 *
 * The latest `onDismiss` and `refs` are read from refs at event time, so callers
 * may pass inline callbacks/arrays without re-running the effect every render.
 */
export function useDismiss({
  enabled = true,
  onDismiss,
  refs,
  lockScroll = false,
  outsideEvent = 'pointerdown',
}: UseDismissOptions) {
  const onDismissRef = useRef(onDismiss)
  onDismissRef.current = onDismiss
  const refsRef = useRef(refs)
  refsRef.current = refs

  useEffect(() => {
    if (!enabled) return

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onDismissRef.current()
    }

    function handleOutside(event: Event) {
      const target = event.target as Node
      const current = refsRef.current
      if (current && current.some((ref) => ref.current?.contains(target))) return
      onDismissRef.current()
    }

    document.addEventListener('keydown', handleKeyDown)
    const useOutside = Boolean(refs)
    if (useOutside) document.addEventListener(outsideEvent, handleOutside)

    let previousOverflow: string | undefined
    if (lockScroll) {
      previousOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      if (useOutside) document.removeEventListener(outsideEvent, handleOutside)
      if (lockScroll) document.body.style.overflow = previousOverflow ?? ''
    }
    // `refs`/`onDismiss` are read via refs; only structural options belong here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, lockScroll, outsideEvent, Boolean(refs)])
}
