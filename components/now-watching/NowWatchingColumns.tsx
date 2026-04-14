'use client'

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Lenis from 'lenis'
import { ArrowLeft } from 'lucide-react'
import { NowWatchingProvider, useNowWatching } from '@/components/now-watching/NowWatchingProvider'
import styles from './NowWatchingColumns.module.css'
import type { NowWatchingPoster } from '@/lib/now-watching'

interface NowWatchingColumnsProps {
  initialPosters: NowWatchingPoster[]
  initialPage: number
  hasMore: boolean
}

function formatRating(rating: number | null) {
  if (rating == null) return null
  const clampedRating = Math.max(0, Math.min(5, Math.round(rating)))
  return '★'.repeat(clampedRating)
}

function buildMetaLabel(poster: NowWatchingPoster) {
  const parts = [poster.watchDate, formatRating(poster.rating)].filter(
    (value): value is string => Boolean(value),
  )
  return parts.join(' · ')
}

function useInfiniteLoad(sentinelRef: React.RefObject<HTMLDivElement | null>, onLoadMore: () => Promise<void>) {
  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          void onLoadMore()
        }
      },
      { rootMargin: '400px' },
    )

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [onLoadMore, sentinelRef])
}

function useDesktopParallax(rootRef: React.RefObject<HTMLDivElement | null>, columnCount: number) {
  const isDesktopRef = useRef(false)

  useEffect(() => {
    if (!rootRef.current) return
    if (window.matchMedia('(max-width: 767px)').matches) return

    isDesktopRef.current = true
    gsap.registerPlugin(ScrollTrigger)

    const lenis = new Lenis()

    const updateLenis = (time: number) => {
      lenis.raf(time * 1000)
    }

    lenis.on('scroll', ScrollTrigger.update)
    gsap.ticker.add(updateLenis)
    gsap.ticker.lagSmoothing(0)

    const context = gsap.context(() => {
      const selector = Array.from({ length: columnCount }, (_, index) => index)
        .filter((index) => index % 2 === 0)
        .map((index) => `.col-scroll__box:nth-child(${index + 1}) .col-scroll__list`)
        .join(', ')

      const reverseLists = selector ? gsap.utils.toArray<HTMLElement>(selector) : []

      reverseLists.forEach((element) => {
        gsap.to(element, {
          yPercent: 100,
          scrollTrigger: {
            trigger: element,
            start: 0,
            end: () => `+=${element.offsetHeight + window.innerHeight * 1.2}`,
            scrub: true,
            pin: true,
          },
        })
      })
    }, rootRef)

    return () => {
      context.revert()
      gsap.ticker.remove(updateLenis)
      lenis.destroy()
      isDesktopRef.current = false
    }
  }, [columnCount, rootRef])

  return isDesktopRef
}

function HomeButton() {
  return (
    <Link href="/" className={styles.homeButton}>
      <ArrowLeft className={styles.homeButtonIcon} aria-hidden="true" />
      <span>HOME</span>
    </Link>
  )
}

function EmptyState() {
  return (
    <div className={styles.emptyState}>
      <p className={styles.emptyStateText}>No portrait posters matched the now-watching metadata.</p>
    </div>
  )
}

function PosterCard({ poster, prioritize }: { poster: NowWatchingPoster; prioritize: boolean }) {
  const metaLabel = buildMetaLabel(poster)

  return (
    <figure className="col-scroll__item">
      <div className="col-scroll__imgWrapper">
        <Image
          className="col-scroll__img"
          src={poster.imageUrl}
          alt={poster.title}
          title={poster.title}
          fill
          sizes="(max-width: 767px) min(calc(100vw - 1.5rem), 21rem), 18vw"
          quality={72}
          priority={prioritize}
        />
      </div>
      <figcaption className="col-scroll__title">
        <span className="col-scroll__titleText">{poster.displayTitle}</span>
        {metaLabel ? <span className="col-scroll__meta">{metaLabel}</span> : null}
      </figcaption>
    </figure>
  )
}

function PosterColumn({ column, columnIndex }: { column: NowWatchingPoster[]; columnIndex: number }) {
  return (
    <div className="col-scroll__box">
      <div className="col-scroll__list">
        {column.map((poster, posterIndex) => (
          <PosterCard
            key={`${poster.id}-${columnIndex}-${posterIndex}`}
            poster={poster}
            prioritize={columnIndex < 2 && posterIndex < 3}
          />
        ))}
      </div>
    </div>
  )
}

function PosterColumns() {
  const { state } = useNowWatching()

  return (
    <div className="col-scroll">
      {state.columns.map((column, columnIndex) => (
        <PosterColumn key={`now-watching-column-${columnIndex}`} column={column} columnIndex={columnIndex} />
      ))}
    </div>
  )
}

function LoadingSentinel({ sentinelRef }: { sentinelRef: React.RefObject<HTMLDivElement | null> }) {
  const { state } = useNowWatching()

  return (
    <>
      <div ref={sentinelRef} className={styles.sentinel} aria-hidden="true" />
      {state.isLoading ? <div className={styles.loadingIndicator} aria-label="加载中" /> : null}
    </>
  )
}

function NowWatchingFrame() {
  const { state, actions, meta } = useNowWatching()
  const rootRef = useRef<HTMLDivElement>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const isEmpty = state.columns.every((column) => column.length === 0)
  const isDesktopRef = useDesktopParallax(rootRef, meta.config.columnCount)

  useInfiniteLoad(sentinelRef, actions.loadMore)

  useEffect(() => {
    if (isDesktopRef.current) {
      requestAnimationFrame(() => ScrollTrigger.refresh())
    }
  }, [isDesktopRef, state.columns])

  return (
    <div ref={rootRef} className={styles.root}>
      <HomeButton />
      {isEmpty ? (
        <EmptyState />
      ) : (
        <main>
          <PosterColumns />
          <LoadingSentinel sentinelRef={sentinelRef} />
        </main>
      )}
    </div>
  )
}

export default function NowWatchingColumns({ initialPosters, initialPage, hasMore }: NowWatchingColumnsProps) {
  return (
    <NowWatchingProvider initialPosters={initialPosters} initialPage={initialPage} hasMore={hasMore}>
      <NowWatchingFrame />
    </NowWatchingProvider>
  )
}