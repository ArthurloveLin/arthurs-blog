'use client'

import { SpotifyProvider, useSpotify } from '@/components/SpotifyProvider'
import { useGeniusData } from '@/hooks/useGeniusData'
import type { GeniusSongData } from '@/lib/genius-types'

function AnnotationSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      {[null, null, null].map((_, i) => (
        <div key={i} className="p-4 rounded-[18px] bg-muted/40 space-y-2">
          <div className="h-2.5 bg-muted rounded-full w-full" />
          <div className="h-2.5 bg-muted rounded-full w-4/5" />
          <div className="h-2.5 bg-muted rounded-full w-3/5" />
        </div>
      ))}
    </div>
  )
}

function AnnotationList({ data }: { data: GeniusSongData }) {
  return (
    <div className="space-y-3">
      {data.annotations.slice(0, 3).map((ann) => (
        <a
          key={ann.id}
          href={ann.url}
          target="_blank"
          rel="noopener noreferrer"
          className="block p-4 rounded-[18px] bg-muted/40 hover:bg-muted/70 border border-border/40 hover:border-border/80 transition-all duration-200 group/ann"
        >
          <p className="text-sm leading-relaxed text-foreground/80 line-clamp-4 group-hover/ann:text-foreground transition-colors">
            {ann.body}
          </p>
          {ann.votes !== undefined && ann.votes > 0 && (
            <p className="mt-2 text-[10px] text-muted-foreground/50">
              {ann.votes} upvotes · genius.com ↗
            </p>
          )}
        </a>
      ))}

      <div className="flex items-center justify-end pt-1">
        <a
          href={data.geniusUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[11px] font-medium text-muted-foreground/50 hover:text-muted-foreground transition-colors flex items-center gap-1"
        >
          在 Genius 查看完整注释
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M7 7h10v10M7 17L17 7" />
          </svg>
        </a>
      </div>
    </div>
  )
}

function GeniusCardInner() {
  const { state: { data } } = useSpotify()

  const isPlaying = data?.isPlaying === true
  const track = isPlaying && data?.title && data?.artist
    ? {
        trackId: data.songUrl?.split('/track/')?.[1]?.split('?')?.[0],
        title: data.title,
        artist: data.artist,
      }
    : null

  const { geniusData, loading } = useGeniusData(track)

  // 未播放时不占位
  if (!isPlaying) return null

  // 加载中或有数据才渲染卡片外壳
  const hasAnnotations = geniusData && geniusData.annotations.length > 0
  if (!loading && !hasAnnotations) return null

  return (
    <div className="rounded-[28px] border border-border/60 bg-card/95 p-4 sm:p-6 shadow-[0_18px_60px_rgba(0,0,0,0.05)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
            Now Playing
          </p>
          <h3 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
            Behind the Lyrics
          </h3>
          {geniusData && (
            <p className="mt-1 text-sm text-muted-foreground">
              {geniusData.title}
              <span className="mx-1.5 opacity-40">·</span>
              {geniusData.artist}
              {geniusData.releaseDate && (
                <span className="ml-1.5 opacity-40">{geniusData.releaseDate}</span>
              )}
            </p>
          )}
        </div>
        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/30 bg-muted/40 px-3 py-1.5 rounded-full">
          Genius
        </span>
      </div>

      {loading ? <AnnotationSkeleton /> : <AnnotationList data={geniusData!} />}
    </div>
  )
}

export default function SpotifyGeniusLiveCard() {
  return (
    <SpotifyProvider>
      <GeniusCardInner />
    </SpotifyProvider>
  )
}
