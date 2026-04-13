'use client'

/* eslint-disable @next/next/no-img-element */

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Lenis from 'lenis'
import { ArrowLeft } from 'lucide-react'
import styles from './NowWatchingColumns.module.css'
import type { NowWatchingPoster } from '@/lib/now-watching'

interface NowWatchingColumnsProps {
  columns: NowWatchingPoster[][]
}

export default function NowWatchingColumns({ columns }: NowWatchingColumnsProps) {
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!rootRef.current || columns.every((column) => column.length === 0)) {
      return
    }

    if (window.matchMedia('(max-width: 767px)').matches) {
      return
    }

    gsap.registerPlugin(ScrollTrigger)

    const lenis = new Lenis()
    const updateLenis = (time: number) => {
      lenis.raf(time * 1000)
    }

    lenis.on('scroll', ScrollTrigger.update)
    gsap.ticker.add(updateLenis)
    gsap.ticker.lagSmoothing(0)

    const context = gsap.context(() => {
      const reverseTrigger = gsap.utils.toArray<HTMLElement>(
        '.col-scroll__box:nth-child(odd) .col-scroll__list'
      )

      reverseTrigger.forEach((element) => {
        const elementHeight = element.offsetHeight
        const viewportHeight = window.innerHeight
        const extraSpace = viewportHeight * 0.2
        const scrollDistance = elementHeight + viewportHeight + extraSpace

        gsap.to(element, {
          yPercent: 100,
          scrollTrigger: {
            trigger: element,
            start: 0,
            end: `+=${scrollDistance}`,
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
    }
  }, [columns])

  if (columns.every((column) => column.length === 0)) {
    return (
      <div className={styles.root}>
        <Link href="/" className={styles.homeButton}>
          <ArrowLeft className={styles.homeButtonIcon} aria-hidden="true" />
          <span>HOME</span>
        </Link>
        <div className={styles.emptyState}>
          <p className={styles.emptyStateText}>No posters found in obsidian-vault/now-watching.</p>
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
                {column.map((poster) => (
                  <figure key={poster.id} className="col-scroll__item">
                    <img className="col-scroll__img" src={poster.imageUrl} alt={poster.title} />
                    <figcaption className="col-scroll__title">{poster.title}</figcaption>
                  </figure>
                ))}
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}