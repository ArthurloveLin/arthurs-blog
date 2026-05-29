'use client'

import { Oswald } from 'next/font/google'
import gsap from 'gsap'
import { useEffect, useRef, useState } from 'react'

const oswald = Oswald({
  subsets: ['latin'],
  weight: '700',
})

const ANIMATION_TIME_SCALE = 0.95
const ANIMATION_HOLD_DELAY = 0.55
const ANIMATION_FADE_DURATION = 0.28

const TEXT_CHARACTERS = ['f', 'o', 'r', '\u00A0', 'L', 'i', 'k', 'i', 'n', 'g', '\u00A0', 'M', 'y', '\u00A0', 'B', 'l', 'o', 'g']

type ThankYouNode =
  | SVGLineElement
  | SVGPolylineElement
  | SVGEllipseElement
  | SVGPathElement
  | SVGTextElement
  | SVGTSpanElement

interface ThankYouAnimationProps {
  onComplete: () => void
}

function addLineDecTween(
  timeline: gsap.core.Timeline,
  line: SVGLineElement,
  duration: number,
  x: number,
  y: number,
  delay: number,
) {
  timeline.to(line.x2.baseVal, { duration, value: x, ease: 'quart.inOut' }, delay)
  timeline.to(line.y2.baseVal, { duration, value: y, ease: 'quart.inOut' }, delay)
  timeline.to(line.x1.baseVal, { duration, value: x, ease: 'quart.inOut' }, delay + duration)
  timeline.to(line.y1.baseVal, { duration, value: y, ease: 'quart.inOut' }, delay + duration)
  timeline.to(line, { duration: 0.01, opacity: 1 }, delay)
  timeline.to(line, { duration: 0.01, opacity: 0 }, delay + duration * 2)
}

function addLineDecOutTween(
  timeline: gsap.core.Timeline,
  line: SVGLineElement,
  duration: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  delay: number,
) {
  timeline.to(line.x1.baseVal, { duration, value: x1, ease: 'quart.inOut' }, delay)
  timeline.to(line.y1.baseVal, { duration, value: y1, ease: 'quart.inOut' }, delay)
  timeline.to(line.x2.baseVal, { duration, value: x2, ease: 'quart.inOut' }, delay)
  timeline.to(line.y2.baseVal, { duration, value: y2, ease: 'quart.inOut' }, delay)
  timeline.to(line.x1.baseVal, { duration, value: x2, ease: 'quart.inOut' }, delay + duration)
  timeline.to(line.y1.baseVal, { duration, value: y2, ease: 'quart.inOut' }, delay + duration)
  timeline.to(line, { duration: 0.01, opacity: 1 }, delay)
  timeline.to(line, { duration: 0.01, opacity: 0 }, delay + duration * 2)
}

function addDotDecTween(
  timeline: gsap.core.Timeline,
  dot: SVGEllipseElement,
  duration: number,
  radius: number,
  delay: number,
) {
  timeline.to(dot.rx.baseVal, { duration, value: radius, ease: 'quart.out' }, delay)
  timeline.to(dot.ry.baseVal, { duration, value: radius, ease: 'quart.out' }, delay)
  timeline.to(dot.rx.baseVal, { duration, value: 0, ease: 'quart.in' }, delay + duration)
  timeline.to(dot.ry.baseVal, { duration, value: 0, ease: 'quart.in' }, delay + duration)
}

function addUnderlineTween(
  timeline: gsap.core.Timeline,
  underline: SVGLineElement,
  duration: number,
  x2: number,
  y2: number,
  x1: number,
  y1: number,
  delay: number,
) {
  timeline.to(underline.x2.baseVal, { duration, value: x2, ease: 'quad.inOut' }, delay)
  timeline.to(underline.y2.baseVal, { duration, value: y2, ease: 'quad.inOut' }, delay)
  timeline.to(underline.x1.baseVal, { duration, value: x1, ease: 'quad.inOut' }, delay + duration)
  timeline.to(underline.y1.baseVal, { duration, value: y1, ease: 'quad.inOut' }, delay + duration)
}

function updatePolyline(
  line: SVGPolylineElement,
  points:
    | { x0: number; y0: number; x1: number; y1: number; x2: number; y2: number }
    | { x0: number; y0: number; x1: number; y1: number; x2: number; y2: number; x3: number; y3: number },
) {
  if ('x3' in points) {
    line.setAttribute(
      'points',
      `${points.x0},${points.y0} ${points.x1},${points.y1} ${points.x2},${points.y2} ${points.x3},${points.y3}`,
    )
    return
  }

  line.setAttribute('points', `${points.x0},${points.y0} ${points.x1},${points.y1} ${points.x2},${points.y2}`)
}

export default function ThankYouAnimation({ onComplete }: ThankYouAnimationProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const nodesRef = useRef<Record<string, ThankYouNode | null>>({})
  const fadeRef = useRef<gsap.core.Tween | null>(null)
  const onCompleteRef = useRef(onComplete)
  const [mobileWidth, setMobileWidth] = useState<number | null>(null)

  useEffect(() => {
    onCompleteRef.current = onComplete
  }, [onComplete])

  useEffect(() => {
    function updateMobileWidth() {
      setMobileWidth(window.innerWidth < 600 ? window.innerWidth : null)
    }

    updateMobileWidth()
    window.addEventListener('resize', updateMobileWidth, { passive: true })

    return () => {
      window.removeEventListener('resize', updateMobileWidth)
    }
  }, [])

  useEffect(() => {
    const node = <T extends ThankYouNode>(name: string) => nodesRef.current[name] as T | null
    const requiredNames = [
      't1', 't2', 'h1', 'h2', 'h3', 'a1', 'a2', 'n1', 'k1', 'k2', 'y1', 'y2', 'o1', 'u1', 'e1', 'e2',
      'underline1', 'underline2', 'underline3', 'underline4',
    ]

    if (requiredNames.some((name) => !node(name)) || !containerRef.current) {
      return
    }

    const t1 = node<SVGLineElement>('t1')
    const t2 = node<SVGLineElement>('t2')
    const t2d = ['t2d1', 't2d2', 't2d3'].map((name) => node<SVGLineElement>(name))
    const t1d = ['t1d1', 't1d2'].map((name) => node<SVGLineElement>(name))

    const h1 = node<SVGLineElement>('h1')
    const h2 = node<SVGLineElement>('h2')
    const h2d = ['h2d1', 'h2d2', 'h2d3'].map((name) => node<SVGLineElement>(name))
    const h3 = node<SVGLineElement>('h3')
    const h3d = ['h3d1', 'h3d2', 'h3d3', 'h3d4'].map((name) => node<SVGEllipseElement>(name))

    const a1 = node<SVGPolylineElement>('a1')
    const a2 = node<SVGLineElement>('a2')
    const a2d = ['a2d1', 'a2d2', 'a2d3'].map((name) => node<SVGLineElement>(name))

    const n1 = node<SVGPolylineElement>('n1')
    const n1d = ['n1d1', 'n1d2', 'n1d3', 'n1d4', 'n1d5'].map((name) => node<SVGLineElement>(name))

    const k1 = node<SVGLineElement>('k1')
    const k1d1 = node<SVGLineElement>('k1d1')
    const k2 = node<SVGPolylineElement>('k2')
    const k2d = ['k2d1', 'k2d2', 'k2d3', 'k2d4'].map((name) => node<SVGEllipseElement>(name))

    const y1 = node<SVGLineElement>('y1')
    const y1d = ['y1d1', 'y1d2'].map((name) => node<SVGLineElement>(name))
    const y2 = node<SVGLineElement>('y2')
    const y2d = ['y2d1', 'y2d2'].map((name) => node<SVGEllipseElement>(name))

    const o1 = node<SVGEllipseElement>('o1')
    const o1d = ['o1d1', 'o1d2', 'o1d3', 'o1d4'].map((name) => node<SVGEllipseElement>(name))

    const u1 = node<SVGPathElement>('u1')
    const u1d = ['u1d1', 'u1d2'].map((name) => node<SVGLineElement>(name))

    const e1 = node<SVGLineElement>('e1')
    const e1d = ['e1d1', 'e1d2', 'e1d3'].map((name) => node<SVGLineElement>(name))
    const e2 = node<SVGEllipseElement>('e2')

    const tspans = TEXT_CHARACTERS.map((_, index) => node<SVGTSpanElement>(`text-${index}`))
    const underlines = ['underline1', 'underline2', 'underline3', 'underline4'].map((name) => node<SVGLineElement>(name))

    if (
      [
        t1, t2, h1, h2, h3, a1, a2, n1, k1, k1d1, k2, y1, y2, o1, u1, e1, e2,
        ...t2d, ...t1d, ...h2d, ...h3d, ...a2d, ...n1d, ...k2d, ...y1d, ...y2d, ...o1d, ...u1d, ...e1d,
        ...tspans, ...underlines,
      ].some((entry) => !entry)
    ) {
      return
    }

    const firstTextSpan = tspans[0]
    const firstDx = firstTextSpan?.dx.baseVal.numberOfItems ? firstTextSpan.dx.baseVal.getItem(0) : null
    const firstDy = firstTextSpan?.dy.baseVal.numberOfItems ? firstTextSpan.dy.baseVal.getItem(0) : null

    gsap.set(containerRef.current, { opacity: 1 })

    const mainTimeline = gsap.timeline({
      onComplete: () => {
        fadeRef.current = gsap.to(containerRef.current, {
          opacity: 0,
          duration: ANIMATION_FADE_DURATION,
          delay: ANIMATION_HOLD_DELAY,
          ease: 'power1.out',
          onComplete: () => {
            onCompleteRef.current()
          },
        })
      },
    })

    const tline = gsap.timeline()
    tline
      .to(t2!.x2.baseVal, { duration: 0.4, value: 200.6, ease: 'back.inOut' }, 0)
      .to(t2!.y2.baseVal, { duration: 0.4, value: 58.6, ease: 'back.inOut' }, 0)
      .to(t1!.y2.baseVal, { duration: 0.5, value: 156.4, ease: 'back.inOut' }, 0.1)
      .to(t2!, { duration: 0.01, opacity: 1 }, 0)
      .to(t1!, { duration: 0.01, opacity: 1 }, 0.3)
    addLineDecTween(tline, t2d[0]!, 0.2, 200, 51, 0.1)
    addLineDecTween(tline, t2d[1]!, 0.2, 170, 48, 0.2)
    addLineDecTween(tline, t2d[2]!, 0.2, 150, 44, 0.3)
    addLineDecTween(tline, t1d[0]!, 0.2, 160, 159, 0.2)
    addLineDecTween(tline, t1d[1]!, 0.2, 165, 130, 0.3)
    mainTimeline.add(tline, 0.5)

    const hline = gsap.timeline()
    hline
      .to(h1!.y2.baseVal, { duration: 0.5, value: 145.4, ease: 'back.inOut' }, 0)
      .to(h2!.x2.baseVal, { duration: 0.4, value: 217.1, ease: 'back.inOut' }, 0.2)
      .to(h2!.y2.baseVal, { duration: 0.4, value: 102.6, ease: 'back.inOut' }, 0.2)
      .to(h3!.y2.baseVal, { duration: 0.5, value: 130.4, ease: 'back.inOut' }, 0.3)
      .to(h1!, { duration: 0.01, opacity: 1 }, 0)
      .to(h2!, { duration: 0.01, opacity: 1 }, 0.2)
      .to(h3!, { duration: 0.01, opacity: 1 }, 0.3)
    addDotDecTween(hline, h3d[0]!, 0.25, 2, 0.2)
    addDotDecTween(hline, h3d[1]!, 0.25, 2, 0.4)
    addDotDecTween(hline, h3d[2]!, 0.25, 2, 0.6)
    addDotDecTween(hline, h3d[3]!, 0.25, 2, 0.8)
    addLineDecTween(hline, h2d[0]!, 0.3, 270, 93, 0.1)
    addLineDecTween(hline, h2d[1]!, 0.3, 256, 104, 0.2)
    addLineDecTween(hline, h2d[2]!, 0.3, 242, 114, 0.3)
    mainTimeline.add(hline, 0.9)

    const aline = gsap.timeline()
    if (a1!.points[0]) {
      aline
        .to(a1!.points[0], { duration: 0.2, x: 305.6, y: 138.6, ease: 'quad.in' }, 0)
        .to(a1!.points[0], { duration: 0.5, x: 282.6, ease: 'back.out(1)' }, 'a1')
        .to(a1!.points[2], { duration: 0.2, x: 305.6, y: 138.6, ease: 'quad.in' }, 0)
        .to(a1!.points[2], { duration: 0.5, x: 330.6, ease: 'back.out(1)' }, 'a1')
    } else {
      const apoly = { x0: 305.6, y0: 51.6, x1: 305.6, y1: 51.6, x2: 305.6, y2: 51.6 }
      aline
        .to(apoly, {
          duration: 0.2,
          x0: 305.6,
          y0: 138.6,
          x2: 305.6,
          y2: 138.6,
          ease: 'quad.in',
          onUpdate: () => updatePolyline(a1!, apoly),
        }, 0)
        .to(apoly, {
          duration: 0.5,
          x0: 282.6,
          x2: 330.6,
          ease: 'back.out(1)',
          onUpdate: () => updatePolyline(a1!, apoly),
        }, 'a1')
    }
    aline
      .to(a2!.x1.baseVal, { duration: 0.4, value: 319.6, ease: 'back.inOut' }, 0.2)
      .to(a1!, { duration: 0.01, opacity: 1 }, 0)
      .to(a2!, { duration: 0.01, opacity: 1 }, 0.2)
    addLineDecOutTween(aline, a2d[0]!, 0.2, 295, 120, 319, 120, 0.2)
    addLineDecOutTween(aline, a2d[1]!, 0.2, 293, 127, 321, 127, 0.3)
    addLineDecOutTween(aline, a2d[2]!, 0.2, 291, 134, 322, 134, 0.4)
    mainTimeline.add(aline, 1.2)

    const nline = gsap.timeline()
    if (n1!.points[1]) {
      nline
        .to(n1!.points[1], { duration: 0.2, y: 51.6, ease: 'quad.out' }, 0)
        .to(n1!.points[3], { duration: 0.2, y: 51.6, ease: 'quad.out' }, 0)
        .to(n1!.points[2], { duration: 0.2, x: 391.6, y: 138.6 }, 'n1')
        .to(n1!.points[3], { duration: 0.2, x: 391.6, y: 62.4, ease: 'quad.out' }, 0.4)
    } else {
      const npoly = { x0: 352, y0: 147, x1: 358, y1: 147, x2: 363, y2: 147, x3: 365, y3: 74 }
      nline
        .to(npoly, {
          duration: 0.2,
          y1: 51.6,
          y3: 51.6,
          ease: 'quad.out',
          onUpdate: () => updatePolyline(n1!, npoly),
        }, 0)
        .to(npoly, {
          duration: 0.2,
          x2: 391.6,
          x3: 391.6,
          y2: 138.6,
          y3: 62.4,
          ease: 'quad.out',
          onUpdate: () => updatePolyline(n1!, npoly),
        }, 0.2)
    }
    nline.to(n1!, { duration: 0.01, opacity: 1 }, 0)
    addLineDecTween(nline, n1d[0]!, 0.3, 352, 70, 0.1)
    addLineDecTween(nline, n1d[1]!, 0.3, 358, 102, 0.2)
    addLineDecTween(nline, n1d[2]!, 0.3, 363, 124, 0.3)
    addLineDecTween(nline, n1d[3]!, 0.3, 385, 80, 0.4)
    addLineDecTween(nline, n1d[4]!, 0.3, 385, 74, 0.5)
    mainTimeline.add(nline, 1.5)

    const kline = gsap.timeline()
    if (k2!.points[0]) {
      kline
        .to(k2!.points[0], { duration: 0.2, x: 452.6, y: 51.6, ease: 'back.out(1)' }, 0.2)
        .to(k2!.points[2], { duration: 0.2, x: 452.6, y: 145.6, ease: 'back.out(1)' }, 0.3)
    } else {
      const kpoly = { x0: 414.1, y0: 97.6, x1: 414.1, y1: 97.6, x2: 414.1, y2: 97.6 }
      kline.to(kpoly, {
        duration: 0.2,
        x0: 452.6,
        y0: 51.6,
        x2: 452.6,
        y2: 145.6,
        ease: 'back.out(1)',
        onUpdate: () => updatePolyline(k2!, kpoly),
      }, 0.2)
    }
    kline
      .to(k1!.y2.baseVal, { duration: 0.4, value: 138.4, ease: 'back.inOut' }, 0)
      .to(k1!, { duration: 0.01, opacity: 1 }, 0)
      .to(k2!, { duration: 0.01, opacity: 1 }, 0.2)
    addLineDecTween(kline, k1d1!, 0.3, 419, 139, 0.1)
    addDotDecTween(kline, k2d[0]!, 0.25, 2, 0.2)
    addDotDecTween(kline, k2d[1]!, 0.25, 2, 0.4)
    addDotDecTween(kline, k2d[2]!, 0.25, 2, 0.6)
    addDotDecTween(kline, k2d[3]!, 0.25, 2, 0.8)
    mainTimeline.add(kline, 1.7)

    const yline = gsap.timeline()
    yline
      .to(y1!.x2.baseVal, { duration: 0.3, value: 493.6, ease: 'back.out(1)' }, 0)
      .to(y1!.y2.baseVal, { duration: 0.3, value: 112.6, ease: 'back.out(1)' }, 0)
      .to(y2!.x2.baseVal, { duration: 0.4, value: 472.6, ease: 'back.out(1)' }, 0.15)
      .to(y2!.y2.baseVal, { duration: 0.4, value: 168.6, ease: 'back.out(1)' }, 0.15)
      .to(y1!, { duration: 0.01, opacity: 1 }, 0)
      .to(y2!, { duration: 0.01, opacity: 1 }, 0.15)
    addLineDecTween(yline, y1d[0]!, 0.3, 470, 155, 0.3)
    addLineDecTween(yline, y1d[1]!, 0.3, 478, 120, 0.4)
    addDotDecTween(yline, y2d[0]!, 0.25, 2, 0.1)
    addDotDecTween(yline, y2d[1]!, 0.25, 2, 0.2)
    mainTimeline.add(yline, 2)

    const oline = gsap.timeline()
    o1!.style.opacity = '1'
    oline
      .to(o1!.rx.baseVal, { duration: 0.5, value: 27, ease: 'back.out(1)' }, 0)
      .to(o1!.ry.baseVal, { duration: 0.5, value: 40.5, ease: 'back.out(1)' }, 0)
      .to(o1d[0]!.rx.baseVal, { duration: 0.6, value: 27, ease: 'back.out(1)' }, 0.1)
      .to(o1d[0]!.ry.baseVal, { duration: 0.6, value: 40.5, ease: 'back.out(1)' }, 0.1)
      .to(o1d[1]!.rx.baseVal, { duration: 0.6, value: 27, ease: 'quad.out' }, 0.2)
      .to(o1d[1]!.ry.baseVal, { duration: 0.6, value: 40.5, ease: 'quad.out' }, 0.2)
      .to(o1d[2]!.rx.baseVal, { duration: 0.6, value: 27, ease: 'quad.out' }, 0.3)
      .to(o1d[2]!.ry.baseVal, { duration: 0.6, value: 40.5, ease: 'quad.out' }, 0.3)
      .to(o1d[3]!.rx.baseVal, { duration: 0.6, value: 27, ease: 'quad.out' }, 0.4)
      .to(o1d[3]!.ry.baseVal, { duration: 0.6, value: 40.5, ease: 'quad.out' }, 0.4)
    mainTimeline.add(oline, 2.2)

    const uline = gsap.timeline()
    const length = u1!.getTotalLength()
    u1!.style.opacity = '1'
    u1!.style.strokeDasharray = `${length}`
    u1!.style.strokeDashoffset = `${length}`
    uline.to(u1!, { duration: 0.5, strokeDashoffset: 0, ease: 'quad.inOut' }, 0)
    addLineDecTween(uline, u1d[0]!, 0.3, 626, 60, 0.3)
    addLineDecTween(uline, u1d[1]!, 0.3, 620, 60, 0.4)
    mainTimeline.add(uline, 2.4)

    const eline = gsap.timeline()
    e2!.style.opacity = '1'
    eline
      .to(e2!.rx.baseVal, { duration: 0.3, value: 6, ease: 'back.out(1)' }, 0.3)
      .to(e2!.ry.baseVal, { duration: 0.3, value: 6, ease: 'back.out(1)' }, 0.3)
      .to(e1!.x2.baseVal, { duration: 0.3, value: 658.6, ease: 'back.inOut' }, 0)
      .to(e1!.y2.baseVal, { duration: 0.3, value: 130.6, ease: 'back.inOut' }, 0)
      .to(e1!, { duration: 0.01, opacity: 1 }, 0)
    addLineDecTween(eline, e1d[0]!, 0.3, 653, 118, 0.1)
    addLineDecTween(eline, e1d[1]!, 0.3, 650, 110, 0.2)
    addLineDecTween(eline, e1d[2]!, 0.3, 673, 86, 0.3)
    mainTimeline.add(eline, 2.6)

    const textTl = gsap.timeline()
    if (firstDx && firstDy) {
      textTl.to(firstDx, { duration: 0.6, value: 0, ease: 'cubic.out' }, 1)
      textTl.to(firstDy, { duration: 0.6, value: -1, ease: 'cubic.out' }, 1)
    } else if (firstTextSpan) {
      firstTextSpan.setAttribute('dx', '0')
      firstTextSpan.setAttribute('dy', '0')
    }

    for (let index = tspans.length - 1; index >= 0; index -= 1) {
      textTl.to(tspans[index]!, { duration: 0.3, opacity: 1 }, 1 + (tspans.length - 1 - index) * 0.05)
    }

    addUnderlineTween(textTl, underlines[0]!, 0.5, 664, 153, 370, 167, 0.2)
    addUnderlineTween(textTl, underlines[1]!, 0.51, 670, 160, 370, 175, 0.3)
    addUnderlineTween(textTl, underlines[2]!, 0.52, 678, 168, 370, 183, 0.4)
    addUnderlineTween(textTl, underlines[3]!, 0.53, 686, 176, 370, 191, 0.5)
    mainTimeline.add(textTl, 2)

    mainTimeline.timeScale(ANIMATION_TIME_SCALE)

    return () => {
      fadeRef.current?.kill()
      mainTimeline.kill()
    }
  }, [])

  function setNodeRef(name: string) {
    return (node: ThankYouNode | null) => {
      nodesRef.current[name] = node
    }
  }

  return (
    <div
      ref={containerRef}
      className={`${oswald.className} thank-you-root pointer-events-none select-none`}
      style={{ width: mobileWidth ? `${mobileWidth}px` : 'min(700px, calc(100vw - 2rem))' }}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 800 280"
        preserveAspectRatio="xMidYMid meet"
        className="block w-full"
        role="presentation"
      >
        <line ref={setNodeRef('underline1')} className="underline plum" x1="146" y1="176" x2="146" y2="176" />
        <line ref={setNodeRef('underline2')} className="underline blue" x1="146" y1="184" x2="146" y2="184" />
        <line ref={setNodeRef('underline3')} className="underline purple" x1="146" y1="192" x2="146" y2="192" />
        <line ref={setNodeRef('underline4')} className="underline lime" x1="146" y1="200" x2="146" y2="200" />

        <line ref={setNodeRef('t1')} x1="151.6" y1="68.4" x2="151.6" y2="68.4" />
        <line ref={setNodeRef('t1d1')} className="dec blue" x1="159" y1="70" x2="159" y2="70" />
        <line ref={setNodeRef('t1d2')} className="dec lime" x1="165" y1="70" x2="165" y2="70" />
        <line ref={setNodeRef('t2')} x1="113.6" y1="70.6" x2="113.6" y2="70.6" />
        <line ref={setNodeRef('t2d1')} className="dec purple" x1="106" y1="62" x2="106" y2="62" />
        <line ref={setNodeRef('t2d2')} className="dec lime" x1="102" y1="55" x2="102" y2="55" />
        <line ref={setNodeRef('t2d3')} className="dec plum" x1="98" y1="50" x2="98" y2="50" />

        <line ref={setNodeRef('h1')} x1="214.6" y1="51.4" x2="214.6" y2="51.4" />
        <line ref={setNodeRef('h2')} x1="267.6" y1="86.6" x2="267.6" y2="86.6" />
        <line ref={setNodeRef('h2d1')} className="dec purple" x1="220" y1="109" x2="220" y2="109" />
        <line ref={setNodeRef('h2d2')} className="dec plum" x1="220" y1="115" x2="220" y2="115" />
        <line ref={setNodeRef('h2d3')} className="dec lime" x1="220" y1="121" x2="220" y2="121" />
        <line ref={setNodeRef('h3')} x1="264.6" y1="47.4" x2="264.6" y2="47.4" />
        <ellipse ref={setNodeRef('h3d1')} className="dec dot blue" cx="256" cy="51" rx="0" ry="0" />
        <ellipse ref={setNodeRef('h3d2')} className="dec dot plum" cx="256" cy="61" rx="0" ry="0" />
        <ellipse ref={setNodeRef('h3d3')} className="dec dot purple" cx="256" cy="71" rx="0" ry="0" />
        <ellipse ref={setNodeRef('h3d4')} className="dec dot lime" cx="256" cy="81" rx="0" ry="0" />

        <polyline ref={setNodeRef('a1')} points="305.6,51.6 305.6,51.6 305.6,51.6" />
        <line ref={setNodeRef('a2')} x1="293.6" y1="101.4" x2="293.6" y2="101.4" />
        <line ref={setNodeRef('a2d1')} className="dec blue" x1="307" y1="120" x2="307" y2="120" />
        <line ref={setNodeRef('a2d2')} className="dec lime" x1="307" y1="127" x2="307" y2="127" />
        <line ref={setNodeRef('a2d3')} className="dec plum" x1="307" y1="134" x2="307" y2="134" />

        <line ref={setNodeRef('n1d1')} className="dec purple" x1="352" y1="147" x2="352" y2="147" />
        <line ref={setNodeRef('n1d2')} className="dec blue" x1="358" y1="147" x2="358" y2="147" />
        <line ref={setNodeRef('n1d3')} className="dec plum" x1="363" y1="147" x2="363" y2="147" />
        <line ref={setNodeRef('n1d4')} className="dec lime" x1="369" y1="80" x2="369" y2="80" />
        <line ref={setNodeRef('n1d5')} className="dec plum" x1="365" y1="74" x2="365" y2="74" />
        <polyline ref={setNodeRef('n1')} points="345.6,145.4 345.6,145.4 345.6,145.4 345.6,145.4" />

        <line ref={setNodeRef('k1d1')} className="dec blue" x1="419" y1="60" x2="419" y2="60" />
        <line ref={setNodeRef('k1')} x1="411.6" y1="56.4" x2="411.6" y2="56.4" />
        <polyline ref={setNodeRef('k2')} points="414.1,97.6 414.1,97.6 414.1,97.6" />
        <ellipse ref={setNodeRef('k2d1')} className="dec dot blue" cx="430" cy="103" rx="0" ry="0" />
        <ellipse ref={setNodeRef('k2d2')} className="dec dot plum" cx="439" cy="112" rx="0" ry="0" />
        <ellipse ref={setNodeRef('k2d3')} className="dec dot purple" cx="447" cy="121" rx="0" ry="0" />
        <ellipse ref={setNodeRef('k2d4')} className="dec dot lime" cx="455" cy="130" rx="0" ry="0" />

        <line ref={setNodeRef('y1d1')} className="dec plum" x1="510" y1="56" x2="510" y2="56" />
        <line ref={setNodeRef('y1d2')} className="dec blue" x1="502" y1="60" x2="502" y2="60" />
        <line ref={setNodeRef('y1')} x1="463.6" y1="62.6" x2="463.6" y2="62.6" />
        <line ref={setNodeRef('y2')} x1="517.6" y1="56.6" x2="517.6" y2="56.6" />
        <ellipse ref={setNodeRef('y2d1')} className="dec dot purple" cx="459" cy="75" rx="0" ry="0" />
        <ellipse ref={setNodeRef('y2d2')} className="dec dot lime" cx="465" cy="84" rx="0" ry="0" />

        <ellipse ref={setNodeRef('o1d1')} className="dec dot purple" cx="544.6" cy="110.1" rx="0" ry="0" />
        <ellipse ref={setNodeRef('o1d2')} className="dec dot plum" cx="544.6" cy="110.1" rx="0" ry="0" />
        <ellipse ref={setNodeRef('o1d3')} className="dec dot blue" cx="544.6" cy="110.1" rx="0" ry="0" />
        <ellipse ref={setNodeRef('o1d4')} className="dec dot lime" cx="544.6" cy="110.1" rx="0" ry="0" />
        <ellipse ref={setNodeRef('o1')} cx="544.6" cy="110.1" rx="0" ry="0" />

        <path ref={setNodeRef('u1')} d="M580.6,63.4v43.1c0,0,3.2,42,26.2,44s26.8-43.5,26.8-43.5V63.4" />
        <line ref={setNodeRef('u1d1')} className="dec purple" x1="626" y1="114" x2="626" y2="114" />
        <line ref={setNodeRef('u1d2')} className="dec plum" x1="620" y1="106" x2="620" y2="106" />

        <line ref={setNodeRef('e1')} x1="669.6" y1="56.6" x2="669.6" y2="56.6" />
        <line ref={setNodeRef('e1d1')} className="dec lime" x1="662" y1="56" x2="662" y2="56" />
        <line ref={setNodeRef('e1d2')} className="dec blue" x1="658" y1="56" x2="658" y2="56" />
        <line ref={setNodeRef('e1d3')} className="dec plum" x1="677" y1="56" x2="677" y2="56" />
        <ellipse ref={setNodeRef('e2')} cx="655" cy="150" rx="0" ry="0" />

        <text ref={setNodeRef('text')} x="150" y="203" fontSize="30">
          {TEXT_CHARACTERS.map((character, index) => (
            <tspan
              key={`${character}-${index}`}
              ref={setNodeRef(`text-${index}`)}
              dx={index === 0 ? '-380' : undefined}
              dy={index === 0 ? '20' : '-0.7'}
            >
              {character}
            </tspan>
          ))}
        </text>
      </svg>

      <style jsx>{`
        .thank-you-root {
          /* Consume the active site theme — auto-adapts to light/dark and all 8 hues */
          --ty-primary: var(--primary);
          --ty-accent-1: var(--accent-glow-1);
          --ty-accent-2: var(--accent-glow-2);
          --ty-accent-3: var(--accent-glow-3);
        }

        svg :global(text) {
          fill: var(--ty-primary);
          font-family: inherit;
          font-weight: 700;
        }

        svg :global(tspan) {
          opacity: 0;
        }

        svg :global(line),
        svg :global(polyline),
        svg :global(ellipse),
        svg :global(path) {
          stroke: var(--ty-primary);
          fill: none;
          stroke-linecap: round;
          stroke-linejoin: round;
          stroke-width: 6;
          opacity: 0;
          stroke-miterlimit: 10;
        }

        svg :global(.dec) {
          stroke-width: 3;
        }

        svg :global(.underline) {
          stroke-width: 6;
          stroke-linecap: butt;
          opacity: 1;
        }

        svg :global(.dot) {
          opacity: 1;
        }

        svg :global(.purple) {
          stroke: var(--ty-accent-1);
        }

        svg :global(.lime) {
          stroke: var(--ty-accent-2);
        }

        svg :global(.plum) {
          stroke: var(--ty-primary);
        }

        svg :global(.blue) {
          stroke: var(--ty-accent-3);
        }
      `}</style>
    </div>
  )
}