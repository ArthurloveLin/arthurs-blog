'use client'

import { useState, useTransition } from 'react'

import type { SpotifySectionCopy } from '@/lib/spotify-page-copy'
import type { SpotifyRecentlyPlayedTrack } from '@/lib/spotify-types'

import RecentlyPlayedViewToggle from './RecentlyPlayedViewToggle'
import SpotifyRecentlyPlayedDeck from './SpotifyRecentlyPlayedDeck'

type RecentlyPlayedView = 'timeline' | 'chart'

export default function SpotifyRecentlyPlayedSection({
  items,
  copy,
}: {
  items: SpotifyRecentlyPlayedTrack[]
  copy: SpotifySectionCopy
}) {
  const [isPending, startTransition] = useTransition()
  const [view, setView] = useState<RecentlyPlayedView>('timeline')

  return (
    <section
      id="recently-played"
      className="scroll-mt-24 rounded-[28px] border border-border/60 bg-card/95 p-4 shadow-[0_18px_60px_rgba(0,0,0,0.05)] sm:p-6"
    >
      <div className="flex flex-col gap-4">
        <div className="w-full min-w-0">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground whitespace-nowrap">{copy.eyebrow}</p>
          <div className="mt-1 flex items-start justify-between gap-4">
            <h3 className="text-2xl font-semibold tracking-tight text-foreground">{copy.title}</h3>
            <div className="shrink-0">
              <RecentlyPlayedViewToggle
                view={view}
                onChange={(nextView) => {
                  startTransition(() => {
                    setView(nextView)
                  })
                }}
              />
            </div>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{copy.description}</p>
        </div>
      </div>

      <div className={`mt-6 transition-opacity duration-200 ${isPending ? 'opacity-70' : 'opacity-100'}`}>
        <SpotifyRecentlyPlayedDeck items={items} view={view} onViewChange={setView} />
      </div>
    </section>
  )
}