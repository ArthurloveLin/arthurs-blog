'use client'

import React from 'react'
import { useGeniusData } from '@/hooks/useGeniusData'
import type { GeniusSongData } from '@/lib/genius-types'

interface Props {
  trackId?: string
  title: string
  artist: string
}

function AnnotationSkeleton() {
  return (
    <div className="space-y-2 animate-pulse">
      {[80, 60, 90].map((w, i) => (
        <div key={i} className="space-y-1.5 p-3 rounded-xl bg-black/5 dark:bg-white/5">
          <div className={`h-2 bg-muted rounded w-${w === 80 ? '[80%]' : w === 60 ? '[60%]' : 'full'}`} />
          <div className="h-2 bg-muted rounded w-3/4" />
          <div className="h-2 bg-muted rounded w-1/2" />
        </div>
      ))}
    </div>
  )
}

function AnnotationList({ data }: { data: GeniusSongData }) {
  if (data.annotations.length === 0) return null

  return (
    <div className="space-y-2">
      {data.annotations.slice(0, 3).map((annotation) => (
        <a
          key={annotation.id}
          href={annotation.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="block p-3 rounded-xl bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 transition-colors duration-200 group/ann"
        >
          <p className="text-[11px] leading-relaxed text-foreground/80 line-clamp-3 group-hover/ann:text-foreground transition-colors">
            {annotation.body}
          </p>
          {annotation.votes !== undefined && annotation.votes > 0 && (
            <p className="text-[9px] text-muted-foreground/50 mt-1.5">
              {annotation.votes} votes · genius.com
            </p>
          )}
        </a>
      ))}

      <a
        href={data.geniusUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="flex items-center justify-end gap-1 text-[9px] font-medium text-muted-foreground/40 hover:text-muted-foreground transition-colors pt-0.5"
      >
        <span>via Genius</span>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M7 7h10v10M7 17L17 7" />
        </svg>
      </a>
    </div>
  )
}

export default function GeniusBehindLyricsCard({ trackId, title, artist }: Props) {
  const { geniusData, loading } = useGeniusData({ trackId, title, artist })

  const hasAnnotations = geniusData && geniusData.annotations.length > 0

  if (!loading && !hasAnnotations) return null

  return (
    <div className="mt-4 animate-in fade-in slide-in-from-top-2 duration-500">
      <div className="flex items-center justify-between mb-2.5 px-1">
        <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
          Behind the Lyrics
        </h4>
        <div className="h-[1px] flex-1 bg-border/40 mx-4" />
        <span className="text-[9px] text-muted-foreground/30 font-medium">Genius</span>
      </div>

      {loading ? <AnnotationSkeleton /> : <AnnotationList data={geniusData!} />}
    </div>
  )
}
