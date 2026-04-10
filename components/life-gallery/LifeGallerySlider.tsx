'use client'

import { useEffect, useRef, useState } from 'react'
import { gsap } from 'gsap'
import type { LifeGalleryRound, LifeGallerySlide } from '@/lib/life-gallery'
import styles from './LifeGallerySlider.module.css'

const AUTOPLAY_DELAY = 4000
const NAVIGATION_LOCK_MS = 1800

function throttle<T extends (...args: never[]) => void>(callback: T, limit: number) {
  let waiting = false

  return (...args: Parameters<T>) => {
    if (waiting) return

    callback(...args)
    waiting = true

    window.setTimeout(() => {
      waiting = false
    }, limit)
  }
}

function debounce<T extends (...args: never[]) => void>(callback: T, wait: number) {
  let timeoutId: number | null = null

  return (...args: Parameters<T>) => {
    if (timeoutId !== null) {
      window.clearTimeout(timeoutId)
    }

    timeoutId = window.setTimeout(() => callback(...args), wait)
  }
}

function isLifeGalleryRound(value: unknown): value is LifeGalleryRound {
  return Boolean(
    value &&
      typeof value === 'object' &&
      'id' in value &&
      'slides' in value &&
      Array.isArray((value as LifeGalleryRound).slides)
  )
}

function mod(index: number, total: number) {
  return ((index % total) + total) % total
}

type SlideEntry = {
  el: HTMLDivElement
  step: number
}

export default function LifeGallerySlider({ initialRound }: { initialRound: LifeGalleryRound }) {
  const rootRef = useRef<HTMLElement | null>(null)
  const backgroundLayerRef = useRef<HTMLDivElement | null>(null)
  const titleRef = useRef<HTMLHeadingElement | null>(null)
  const imagesRef = useRef<HTMLDivElement | null>(null)
  const cursorRef = useRef<HTMLDivElement | null>(null)
  const currentLineRef = useRef<HTMLDivElement | null>(null)
  const currentIndexRef = useRef(0)
  const slideEntriesRef = useRef<SlideEntry[]>([])
  const animatingRef = useRef(false)
  const cursorVisibleRef = useRef(false)
  const autoPlayTimerRef = useRef<number | null>(null)
  const reducedMotionRef = useRef(false)
  const roundRef = useRef(initialRound)
  const pendingRoundRef = useRef<LifeGalleryRound | null>(null)
  const requestInFlightRef = useRef(false)
  const advanceRef = useRef<(() => void) | null>(null)
  const [isFetchingNextRound, setIsFetchingNextRound] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)

  useEffect(() => {
    roundRef.current = initialRound
  }, [initialRound])

  useEffect(() => {
    const rootEl = rootRef.current
    const backgroundEl = backgroundLayerRef.current
    const titleEl = titleRef.current
    const imagesEl = imagesRef.current
    const cursorEl = cursorRef.current

    if (!rootEl || !backgroundEl || !titleEl || !imagesEl || !cursorEl) {
      return
    }

    const getCurrentRound = () => roundRef.current
    const getTotal = () => getCurrentRound().slides.length

    const preloadRound = (round: LifeGalleryRound) => {
      round.slides.forEach((slide) => {
        const image = new window.Image()
        image.src = slide.imageUrl
      })
    }

    const getPalette = () => {
      const computedStyle = window.getComputedStyle(rootEl)

      return [1, 2, 3, 4].map((index) => {
        const color = computedStyle.getPropertyValue(`--life-gallery-bg-${index}`).trim()
        return color || '#111111'
      })
    }

    const getThemeColor = (slide: LifeGallerySlide) => {
      const palette = getPalette()
      return palette[slide.themeIndex % palette.length]
    }

    const replaceSlideContent = (slideEl: HTMLDivElement, slide: LifeGallerySlide) => {
      let imageEl = slideEl.querySelector('img') as HTMLImageElement | null

      if (!imageEl) {
        imageEl = document.createElement('img')
        imageEl.className = styles.sliderSlideImage
        imageEl.width = 960
        imageEl.height = 720
        imageEl.decoding = 'async'
        slideEl.appendChild(imageEl)
      }

      imageEl.src = slide.imageUrl
      imageEl.alt = slide.title
      slideEl.dataset.key = slide.key
      slideEl.dataset.title = slide.title
      slideEl.dataset.themeIndex = String(slide.themeIndex)
    }

    const createSlide = (slide: LifeGallerySlide) => {
      const slideEl = document.createElement('div')
      slideEl.className = styles.sliderSlide
      replaceSlideContent(slideEl, slide)
      return slideEl
    }

    const getSlideFor = (round: LifeGalleryRound, index: number) => round.slides[mod(index, round.slides.length)]

    const setTitle = (text: string) => {
      titleEl.innerHTML = ''

      const lineEl = document.createElement('div')
      ;[...text].forEach((character) => {
        const characterEl = document.createElement('span')
        characterEl.textContent = character === ' ' ? '\u00A0' : character
        lineEl.appendChild(characterEl)
      })

      titleEl.appendChild(lineEl)
      currentLineRef.current = lineEl
    }

    const animateTitle = (text: string, direction: 'next' | 'prev') => {
      const currentLine = currentLineRef.current
      if (!currentLine) return gsap.timeline()

      const height = titleEl.offsetHeight
      const stepDirection = direction === 'next' ? 1 : -1
      const oldCharacters = Array.from(currentLine.querySelectorAll('span'))

      titleEl.style.height = `${height}px`
      currentLine.style.cssText = 'position:absolute;top:0;left:0;width:100%'

      const newLine = document.createElement('div')
      newLine.style.cssText = 'position:absolute;top:0;left:0;width:100%'
      ;[...text].forEach((character) => {
        const characterEl = document.createElement('span')
        characterEl.textContent = character === ' ' ? '\u00A0' : character
        newLine.appendChild(characterEl)
      })

      titleEl.appendChild(newLine)

      const newCharacters = Array.from(newLine.querySelectorAll('span'))
      gsap.set(newCharacters, { y: height * stepDirection })

      const timeline = gsap.timeline({
        onComplete: () => {
          currentLine.remove()
          newLine.style.cssText = ''
          gsap.set(newCharacters, { clearProps: 'all' })
          titleEl.style.height = ''
          currentLineRef.current = newLine
        },
      })

      const duration = reducedMotionRef.current ? 0.01 : 1
      const stagger = reducedMotionRef.current ? 0 : 0.04

      timeline.to(
        oldCharacters,
        {
          y: -height * stepDirection,
          stagger,
          duration,
          ease: 'expo.inOut',
        },
        0
      )

      timeline.to(
        newCharacters,
        {
          y: 0,
          stagger,
          duration,
          ease: 'expo.inOut',
        },
        0
      )

      return timeline
    }

    const getSlideProps = (step: number) => {
      const height = imagesEl.offsetHeight
      const absoluteStep = Math.abs(step)
      const positions = [
        { x: -0.35, y: -0.95, rotation: -30, scale: 1.35, blur: 16, opacity: 0 },
        { x: -0.18, y: -0.5, rotation: -15, scale: 1.15, blur: 8, opacity: 0.55 },
        { x: 0, y: 0, rotation: 0, scale: 1, blur: 0, opacity: 1 },
        { x: -0.06, y: 0.5, rotation: 15, scale: 0.75, blur: 6, opacity: 0.55 },
        { x: -0.12, y: 0.95, rotation: 30, scale: 0.55, blur: 14, opacity: 0 },
      ]

      const position = positions[Math.max(0, Math.min(4, step + 2))]

      return {
        x: position.x * height,
        y: position.y * height,
        rotation: position.rotation,
        scale: position.scale,
        blur: position.blur,
        opacity: position.opacity,
        zIndex: absoluteStep === 0 ? 3 : absoluteStep === 1 ? 2 : 1,
      }
    }

    const positionSlide = (slideEl: HTMLDivElement, step: number) => {
      const properties = getSlideProps(step)

      gsap.set(slideEl, {
        xPercent: -50,
        yPercent: -50,
        x: properties.x,
        y: properties.y,
        rotation: properties.rotation,
        scale: properties.scale,
        opacity: properties.opacity,
        filter: `blur(${properties.blur}px)`,
        zIndex: properties.zIndex,
      })
    }

    const syncVisibleSlides = (round: LifeGalleryRound, currentIndex: number) => {
      slideEntriesRef.current.forEach((entry) => {
        replaceSlideContent(entry.el, getSlideFor(round, currentIndex + entry.step))
        positionSlide(entry.el, entry.step)
      })
    }

    const buildCarousel = () => {
      if (imagesEl.offsetHeight === 0) return

      imagesEl.innerHTML = ''
      slideEntriesRef.current = []

      for (let step = -1; step <= 1; step += 1) {
        const slide = getSlideFor(getCurrentRound(), currentIndexRef.current + step)
        const slideEl = createSlide(slide)
        imagesEl.appendChild(slideEl)
        positionSlide(slideEl, step)
        slideEntriesRef.current.push({ el: slideEl, step })
      }
    }

    const stopAutoPlay = () => {
      if (autoPlayTimerRef.current !== null) {
        window.clearInterval(autoPlayTimerRef.current)
        autoPlayTimerRef.current = null
      }
    }

    const fetchNextRound = async () => {
      if (requestInFlightRef.current || pendingRoundRef.current) return

      requestInFlightRef.current = true
      setIsFetchingNextRound(true)
      setFetchError(null)

      try {
        const response = await fetch('/api/life-gallery/round', { cache: 'no-store' })
        const data: unknown = await response.json()

        if (!response.ok || !isLifeGalleryRound(data)) {
          throw new Error('Unable to load next Life Gallery round.')
        }

        pendingRoundRef.current = data
        preloadRound(data)
      } catch (error) {
        console.error('Failed to preload Life Gallery round:', error)
        setFetchError('Next round will retry on demand.')
      } finally {
        requestInFlightRef.current = false
        setIsFetchingNextRound(false)
      }
    }

    const maybePrefetchNextRound = () => {
      if (pendingRoundRef.current || requestInFlightRef.current) return

      const total = getTotal()
      if (currentIndexRef.current >= total - 2) {
        void fetchNextRound()
      }
    }

    const startAutoPlay = () => {
      stopAutoPlay()

      autoPlayTimerRef.current = window.setInterval(() => {
        if (!animatingRef.current) {
          advanceRef.current?.()
        }
      }, AUTOPLAY_DELAY)
    }

    const animateCarousel = (direction: 'next' | 'prev', targetRound: LifeGalleryRound, targetIndex: number, isBoundarySwap: boolean) => {
      if (imagesEl.offsetHeight === 0) {
        return gsap.timeline()
      }

      const shift = direction === 'next' ? -1 : 1
      const enterStep = direction === 'next' ? 2 : -2
      const newIndex = direction === 'next' ? mod(targetIndex + 1, targetRound.slides.length) : mod(targetIndex - 1, targetRound.slides.length)

      if (isBoundarySwap && direction === 'next') {
        const previewSlide = slideEntriesRef.current.find((entry) => entry.step === 1)
        if (previewSlide) {
          replaceSlideContent(previewSlide.el, targetRound.slides[targetIndex])
        }
      }

      const newSlideEl = createSlide(targetRound.slides[newIndex])
      imagesEl.appendChild(newSlideEl)
      positionSlide(newSlideEl, enterStep)
      slideEntriesRef.current.push({ el: newSlideEl, step: enterStep })

      slideEntriesRef.current.forEach((entry) => {
        entry.step += shift
      })

      const duration = reducedMotionRef.current ? 0.01 : 1.2
      const timeline = gsap.timeline({
        onComplete: () => {
          slideEntriesRef.current = slideEntriesRef.current.filter((entry) => {
            if (Math.abs(entry.step) >= 2) {
              entry.el.remove()
              return false
            }

            return true
          })

          if (isBoundarySwap) {
            currentIndexRef.current = 0
            roundRef.current = targetRound
            pendingRoundRef.current = null
            syncVisibleSlides(targetRound, 0)
            void fetchNextRound()
          } else {
            currentIndexRef.current = targetIndex
          }

          animatingRef.current = false
          maybePrefetchNextRound()
        },
      })

      slideEntriesRef.current.forEach((entry) => {
        const properties = getSlideProps(entry.step)
        entry.el.style.zIndex = String(properties.zIndex)

        timeline.to(
          entry.el,
          {
            x: properties.x,
            y: properties.y,
            rotation: properties.rotation,
            scale: properties.scale,
            opacity: properties.opacity,
            filter: `blur(${properties.blur}px)`,
            duration,
            ease: 'power3.inOut',
          },
          0
        )
      })

      return timeline
    }

    const go = (direction: 'next' | 'prev') => {
      if (animatingRef.current) return

      const currentRound = getCurrentRound()
      const total = currentRound.slides.length
      const tentativeIndex = direction === 'next' ? mod(currentIndexRef.current + 1, total) : mod(currentIndexRef.current - 1, total)
      const isBoundarySwap = direction === 'next' && tentativeIndex === 0 && pendingRoundRef.current !== null
      const targetRound = isBoundarySwap ? pendingRoundRef.current! : currentRound
      const targetIndex = isBoundarySwap ? 0 : tentativeIndex
      const targetSlide = targetRound.slides[targetIndex]

      animatingRef.current = true
      startAutoPlay()

      const timeline = gsap.timeline()
      timeline.to(
        backgroundEl,
        {
          backgroundColor: getThemeColor(targetSlide),
          duration: reducedMotionRef.current ? 0.01 : 1.2,
          ease: 'power2.inOut',
        },
        0
      )
      timeline.add(animateTitle(targetSlide.title, direction), 0)
      timeline.add(animateCarousel(direction, targetRound, targetIndex, isBoundarySwap), 0)
    }

    advanceRef.current = () => go('next')

    const wheelHandler = throttle((event: WheelEvent) => {
      if (animatingRef.current) return
      go(event.deltaY > 0 ? 'next' : 'prev')
    }, NAVIGATION_LOCK_MS)

    let touchStartY = 0
    const touchStartHandler = (event: TouchEvent) => {
      touchStartY = event.touches[0]?.clientY ?? 0
    }

    const touchEndHandler = throttle((event: TouchEvent) => {
      if (animatingRef.current) return
      const touchEndY = event.changedTouches[0]?.clientY ?? 0
      const difference = touchStartY - touchEndY
      if (Math.abs(difference) < 40) return
      go(difference > 0 ? 'next' : 'prev')
    }, NAVIGATION_LOCK_MS)

    const keydownHandler = (event: KeyboardEvent) => {
      if (animatingRef.current) return
      if (event.key === 'ArrowDown' || event.key === 'ArrowRight') go('next')
      if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') go('prev')
    }

    const cursorMoveX = gsap.quickTo(cursorEl, 'x', {
      duration: 0.5,
      ease: 'power3',
    })
    const cursorMoveY = gsap.quickTo(cursorEl, 'y', {
      duration: 0.5,
      ease: 'power3',
    })

    const mouseMoveHandler = (event: MouseEvent) => {
      if (!cursorVisibleRef.current) {
        gsap.to(cursorEl, { opacity: 1, duration: 0.3 })
        cursorVisibleRef.current = true
      }

      cursorMoveX(event.clientX)
      cursorMoveY(event.clientY)
    }

    const mouseLeaveHandler = () => {
      gsap.to(cursorEl, { opacity: 0, duration: 0.3 })
      cursorVisibleRef.current = false
    }

    const resizeHandler = debounce(() => {
      if (!animatingRef.current && imagesEl.offsetHeight > 0) {
        slideEntriesRef.current.forEach((entry) => {
          positionSlide(entry.el, entry.step)
        })
      }
    }, 300)

    const visibilityHandler = () => {
      if (document.visibilityState === 'hidden') {
        animatingRef.current = false
        stopAutoPlay()
      } else {
        startAutoPlay()
      }
    }

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    const motionChangeHandler = () => {
      reducedMotionRef.current = mediaQuery.matches
    }

    reducedMotionRef.current = mediaQuery.matches
    preloadRound(getCurrentRound())
    setTitle(getCurrentRound().slides[0].title)
    gsap.set(backgroundEl, { backgroundColor: getThemeColor(getCurrentRound().slides[0]) })
    gsap.set(cursorEl, { xPercent: -50, yPercent: -50, opacity: 0 })
    buildCarousel()
    maybePrefetchNextRound()
    startAutoPlay()

    window.addEventListener('wheel', wheelHandler, { passive: true })
    window.addEventListener('touchstart', touchStartHandler, { passive: true })
    window.addEventListener('touchend', touchEndHandler, { passive: true })
    window.addEventListener('keydown', keydownHandler)
    window.addEventListener('resize', resizeHandler, { passive: true })
    rootEl.addEventListener('mousemove', mouseMoveHandler, { passive: true })
    rootEl.addEventListener('mouseleave', mouseLeaveHandler)
    document.addEventListener('visibilitychange', visibilityHandler)
    mediaQuery.addEventListener('change', motionChangeHandler)

    return () => {
      stopAutoPlay()
      advanceRef.current = null
      window.removeEventListener('wheel', wheelHandler)
      window.removeEventListener('touchstart', touchStartHandler)
      window.removeEventListener('touchend', touchEndHandler)
      window.removeEventListener('keydown', keydownHandler)
      window.removeEventListener('resize', resizeHandler)
      rootEl.removeEventListener('mousemove', mouseMoveHandler)
      rootEl.removeEventListener('mouseleave', mouseLeaveHandler)
      document.removeEventListener('visibilitychange', visibilityHandler)
      mediaQuery.removeEventListener('change', motionChangeHandler)
      gsap.killTweensOf(backgroundEl)
      gsap.killTweensOf(cursorEl)
      slideEntriesRef.current.forEach((entry) => gsap.killTweensOf(entry.el))
    }
  }, [initialRound])

  return (
    <section ref={rootRef} className={styles.sliderRoot} aria-label="Life Gallery slider">
      <div ref={backgroundLayerRef} className={styles.backgroundLayer} aria-hidden="true" />
      <div className={styles.grainLayer} aria-hidden="true" />

      <div className={styles.sliderHeader}>
        <button
          type="button"
          className={styles.sliderMenu}
          aria-label="Next life gallery theme"
          onClick={() => advanceRef.current?.()}
        >
          <span className={styles.sliderMenuLine} />
          <span className={styles.sliderMenuLine} />
          <span className={styles.sliderMenuLine} />
        </button>
        <span className={styles.sliderLabel}>Life Gallery - Arthur and Grace</span>
      </div>

      <div className={styles.sliderBody}>
        <div className={styles.sliderLeft}>
          <h1 ref={titleRef} className={styles.sliderTitle} aria-live="polite" />
          <div className={styles.sliderFooter}>
            <p className={styles.sliderDescription}>R2 Obsidian Vault<br />Four rotating themes<br />Randomized by round</p>
            <p className={styles.sliderStatus}>
              {fetchError ? fetchError : isFetchingNextRound ? 'Loading the next round in the background.' : 'Scroll, swipe, tap, or use arrow keys.'}
            </p>
          </div>
        </div>

        <div className={styles.sliderRight}>
          <div ref={imagesRef} className={styles.sliderImages} />
        </div>
      </div>

      <div ref={cursorRef} className={styles.sliderCursor} aria-hidden="true">+</div>
    </section>
  )
}