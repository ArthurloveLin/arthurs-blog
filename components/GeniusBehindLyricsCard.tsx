'use client'

import React, { useState } from 'react'
import { useGeniusData } from '@/hooks/useGeniusData'

interface Props {
  trackId?: string
  title: string
  artist: string
}

function AnnotationSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-pulse">
      <div className="md:col-span-2 space-y-2">
        <div className="h-4 bg-muted rounded w-full" />
        <div className="h-4 bg-muted rounded w-5/6" />
        <div className="h-4 bg-muted rounded w-4/6" />
        <div className="h-4 bg-muted rounded w-full" />
      </div>
      <div className="space-y-3">
        <div className="h-20 bg-muted rounded-xl w-full" />
        <div className="h-20 bg-muted rounded-xl w-full" />
      </div>
    </div>
  )
}

export default function GeniusBehindLyricsCard({ trackId, title, artist }: Props) {
  const { geniusData, loading } = useGeniusData({ trackId, title, artist })
  const [isHovering, setIsHovering] = useState(false)

  const hasAnnotations = geniusData && geniusData.annotations.length > 0
  const hasLyrics = geniusData && !!geniusData.lyrics

  if (!loading && !hasAnnotations) return null

  return (
    <div 
      className="mt-6 group/genius animate-in fade-in slide-in-from-top-2 duration-700"
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4 px-1">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-yellow-400 shadow-[0_0_8px_rgba(250,204,21,0.6)]" />
          <h4 className="text-[10px] font-bold uppercase tracking-widest text-foreground/70">
            Behind the Lyrics
          </h4>
        </div>
        <div className="h-[1px] flex-1 bg-gradient-to-r from-border/60 to-transparent mx-4" />
        <a 
          href={geniusData?.geniusUrl} 
          target="_blank" 
          className="text-[9px] text-muted-foreground/40 hover:text-yellow-500 transition-colors font-medium"
        >
          GENIUS.COM
        </a>
      </div>

      {loading ? (
        <AnnotationSkeleton />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Left: Lyrics */}
          <div className="md:col-span-2 relative overflow-hidden rounded-2xl bg-black/5 dark:bg-white/5 border border-white/5 p-4 md:p-5">
            <div className="max-h-[320px] overflow-y-auto scrollbar-hide pr-2">
              {hasLyrics ? (
                <p className="text-[13px] leading-relaxed text-foreground/90 whitespace-pre-line font-medium tracking-tight">
                  {geniusData.lyrics}
                </p>
              ) : (
                <p className="text-[13px] italic text-muted-foreground/60 py-10 text-center">
                  Lyrics preview not available
                </p>
              )}
            </div>
            {/* Bottom Gradient Fade */}
            <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-black/5 dark:from-white/5 to-transparent pointer-events-none" />
          </div>

          {/* Right: Annotations */}
          <div 
            className={`space-y-3 transition-all duration-500 transform ${
              isHovering ? 'opacity-100 translate-x-0' : 'opacity-40 translate-x-1 md:opacity-50'
            }`}
          >
            <div className="max-h-[320px] overflow-y-auto scrollbar-hide pr-1 space-y-3">
              {geniusData?.annotations.slice(0, 8).map((annotation, index) => (
                <div
                  key={annotation.id}
                  className="p-3.5 rounded-xl bg-black/5 dark:bg-white/[0.03] border border-white/5 hover:bg-yellow-400/10 hover:border-yellow-400/20 transition-all duration-300 cursor-default group/item"
                  style={{ transitionDelay: `${index * 50}ms` }}
                >
                  <p className="text-[11px] leading-relaxed text-foreground/80 group-hover/item:text-foreground">
                    {annotation.body}
                  </p>
                  {annotation.votes !== undefined && annotation.votes > 0 && (
                    <div className="flex items-center gap-1.5 mt-2.5 opacity-40 group-hover/item:opacity-70 transition-opacity">
                      <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                      </svg>
                      <span className="text-[9px] font-bold">{annotation.votes}</span>
                    </div>
                  )}
                </div>
              ))}
              
              {geniusData && geniusData.annotations.length > 8 && (
                <a 
                  href={geniusData.geniusUrl}
                  target="_blank"
                  className="block text-center py-2 text-[10px] text-muted-foreground/40 hover:text-yellow-500 transition-colors"
                >
                  + {geniusData.annotations.length - 8} more on Genius
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
