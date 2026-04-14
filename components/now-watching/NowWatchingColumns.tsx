'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Lenis from 'lenis'
import { ArrowLeft } from 'lucide-react'
import styles from './NowWatchingColumns.module.css'
import type { NowWatchingPoster, PagedNowWatchingPosters } from '@/lib/now-watching'

const COLUMN_COUNT = 3
const LOAD_MORE_PER_PAGE = 9 // 每批次额外加载，每列 3 张

interface NowWatchingColumnsProps {
  initialPosters: NowWatchingPoster[]
  initialPage: number
  totalCount: number
  hasMore: boolean
  perPage: number
}

function formatRating(rating: number | null) {
  if (rating == null) return null
  const clampedRating = Math.max(0, Math.min(5, Math.round(rating)))
  return '★'.repeat(clampedRating)
}

function buildMetaLabel(poster: NowWatchingPoster) {
  const parts = [poster.watchDate, formatRating(poster.rating)].filter(
    (value): value is string => Boolean(value)
  )
  return parts.join(' · ')
}

/** 将平铺的 poster 列表轮询分配到 N 列 */
function distributeToColumns(posters: NowWatchingPoster[], columnCount: number): NowWatchingPoster[][] {
  const cols: NowWatchingPoster[][] = Array.from({ length: columnCount }, () => [])
  posters.forEach((poster, index) => {
    cols[index % columnCount].push(poster)
  })
  return cols
}

export default function NowWatchingColumns({
  initialPosters,
  initialPage,
  totalCount,
  hasMore: initialHasMore,
  perPage,
}: NowWatchingColumnsProps) {
  const [columns, setColumns] = useState<NowWatchingPoster[][]>(() =>
    distributeToColumns(initialPosters, COLUMN_COUNT)
  )
  const [page, setPage] = useState(initialPage)
  const [hasMore, setHasMore] = useState(initialHasMore)
  const [isLoading, setIsLoading] = useState(false)

  const rootRef = useRef<HTMLDivElement>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const lenisRef = useRef<Lenis | null>(null)
  const isDesktop = useRef(false)

  const loadMore = useCallback(async () => {
    if (isLoading || !hasMore) return

    setIsLoading(true)
    const nextPage = page + 1

    try {
      const res = await fetch(
        `/api/now-watching/posters?page=${nextPage}&perPage=${LOAD_MORE_PER_PAGE}`
      )
      if (!res.ok) return

      const data: PagedNowWatchingPosters = await res.json()

      setColumns((prev) => {
        const next = prev.map((col) => [...col])
        data.posters.forEach((poster, index) => {
          next[index % COLUMN_COUNT].push(poster)
        })
        return next
      })

      setPage(nextPage)
      setHasMore(data.hasMore)

      // 新内容追加后刷新 ScrollTrigger 计算
      if (isDesktop.current) {
        // 等待 DOM 更新后再 refresh
        requestAnimationFrame(() => {
          ScrollTrigger.refresh()
        })
      }
    } finally {
      setIsLoading(false)
    }
  }, [isLoading, hasMore, page])

  // IntersectionObserver 监听 sentinel
  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadMore()
        }
      },
      { rootMargin: '400px' }
    )

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [loadMore])

  // GSAP 视差动画，仅桌面端，挂载一次
  useEffect(() => {
    if (!rootRef.current) return
    if (window.matchMedia('(max-width: 767px)').matches) return

    isDesktop.current = true
    gsap.registerPlugin(ScrollTrigger)

    const lenis = new Lenis()
    lenisRef.current = lenis

    const updateLenis = (time: number) => {
      lenis.raf(time * 1000)
    }

    lenis.on('scroll', ScrollTrigger.update)
    gsap.ticker.add(updateLenis)
    gsap.ticker.lagSmoothing(0)

    const context = gsap.context(() => {
      const reverseLists = gsap.utils.toArray<HTMLElement>(
        '.col-scroll__box:nth-child(odd) .col-scroll__list'
      )

      reverseLists.forEach((element) => {
        gsap.to(element, {
          yPercent: 100,
          scrollTrigger: {
            trigger: element,
            start: 0,
            // 用函数确保 refresh 后能取到最新高度
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
      lenisRef.current = null
      isDesktop.current = false
    }
  }, [])

  const isEmpty = columns.every((col) => col.length === 0)

  if (isEmpty) {
    return (
      <div className={styles.root}>
        <Link href="/" className={styles.homeButton}>
          <ArrowLeft className={styles.homeButtonIcon} aria-hidden="true" />
          <span>HOME</span>
        </Link>
        <div className={styles.emptyState}>
          <p className={styles.emptyStateText}>No portrait posters matched the now-watching metadata.</p>
        </div>
      </div>
    )
  }

  return (
    <div ref={rootRef} className={styles.root}>
      <Link href="/" className={styles.homeButton}>
        <ArrowLeft className={styles.homeButtonIcon} aria-hidden="true" />
        <span>HOME</span>
      </Link>
      <main>
        <div className="col-scroll">
          {columns.map((column, columnIndex) => (
            <div key={`now-watching-column-${columnIndex}`} className="col-scroll__box">
              <div className="col-scroll__list">
                {column.map((poster, posterIndex) => {
                  const metaLabel = buildMetaLabel(poster)
                  const shouldPrioritize = columnIndex === 0 && posterIndex < 2

                  return (
                    <figure key={`${poster.id}-${columnIndex}-${posterIndex}`} className="col-scroll__item">
                      <div className="col-scroll__imgWrapper">
                        <Image
                          className="col-scroll__img"
                          src={poster.imageUrl}
                          alt={poster.title}
                          title={poster.title}
                          fill
                          sizes="(max-width: 767px) min(calc(100vw - 1.5rem), 21rem), 18vw"
                          quality={72}
                          priority={shouldPrioritize}
                        />
                      </div>
                      <figcaption className="col-scroll__title">
                        <span className="col-scroll__titleText">{poster.displayTitle}</span>
                        {metaLabel ? <span className="col-scroll__meta">{metaLabel}</span> : null}
                      </figcaption>
                    </figure>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        {/* 无限滚动触发哨兵 */}
        <div ref={sentinelRef} className={styles.sentinel} aria-hidden="true" />
        {isLoading && <div className={styles.loadingIndicator} aria-label="加载中" />}
      </main>
    </div>
  )
}