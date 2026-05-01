'use client'

import React, { useState, useEffect, useRef, useMemo } from 'react'
import { SpotifyProvider, useSpotify } from '@/components/SpotifyProvider'
import { useGeniusData } from '@/hooks/useGeniusData'

function AnnotationSkeleton() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-pulse">
      <div className="lg:col-span-2 space-y-3">
        <div className="h-4 bg-muted rounded w-full" />
        <div className="h-4 bg-muted rounded w-5/6" />
        <div className="h-4 bg-muted rounded w-4/6" />
        <div className="h-4 bg-muted rounded w-full" />
      </div>
      <div className="space-y-4">
        <div className="h-24 bg-muted/40 rounded-[22px] w-full" />
        <div className="h-24 bg-muted/40 rounded-[22px] w-full" />
      </div>
    </div>
  )
}

function GeniusCardInner() {
  const { state: { data } } = useSpotify()
  const [activeAnnId, setActiveAnnId] = useState<number | null>(null)
  const [fixedAnnId, setFixedAnnId] = useState<number | null>(null)
  const [popupTop, setPopupTop] = useState<number | null>(null)

  const isPlaying = data?.isPlaying === true
  const scrollRef = useRef<HTMLDivElement>(null)

  const track = (data?.title && data?.artist)
    ? {
        trackId: data.songUrl?.split('/track/')?.[1]?.split('?')?.[0],
        title: data.title,
        artist: data.artist,
        durationMs: data.durationMs || undefined,
      }
    : null

  // 核心逻辑：当前选中的 ID（优先悬停，其次固定）
  const currentId = activeAnnId || fixedAnnId

  useEffect(() => {
    if (currentId && scrollRef.current) {
      const activeElement = scrollRef.current.querySelector(`#ann-${currentId}`) as HTMLElement
      if (activeElement) {
        const container = scrollRef.current
        const containerRect = container.getBoundingClientRect()
        const elementRect = activeElement.getBoundingClientRect()
        
        const relativeTop = elementRect.top - containerRect.top + container.scrollTop
        const elementHeight = elementRect.height
        const containerHeight = container.clientHeight

        let scrollPosition: number
        if (elementHeight >= containerHeight - 40) {
          scrollPosition = relativeTop - 16
        } else {
          scrollPosition = relativeTop - (containerHeight / 2) + (elementHeight / 2)
        }

        container.scrollTo({
          top: Math.max(0, scrollPosition),
          behavior: 'smooth'
        })
      }
    }
  }, [currentId])

  // 切歌时清空所有选中状态（render 期间派生状态，避免 useEffect 多余渲染轮次）
  const trackKey = track ? `${track.title}-${track.artist}` : null
  const [prevTrackKey, setPrevTrackKey] = useState(trackKey)
  if (prevTrackKey !== trackKey) {
    setPrevTrackKey(trackKey)
    setActiveAnnId(null)
    setFixedAnnId(null)
    setPopupTop(null)
  }

  const { geniusData, loading } = useGeniusData(track)

  const linesWithAnnotations = useMemo(() => {
    if (!geniusData || !geniusData.lyrics) return []
    const usedAnnIds = new Set<number>()
    const normalize = (s: string) => s.toLowerCase().replace(/[^\w\s\u4e00-\u9fa5]/g, '').replace(/\s+/g, ' ').trim()

    let lastMatchedAnnId: number | null = null

    return geniusData.lyrics.split('\n')
      .filter(line => line.trim() !== '')
      .map((line) => {
        const isLabel = line.startsWith('[') && line.endsWith(']')
        const lineTrimmed = line.trim()
        const lineNorm = normalize(lineTrimmed)

        let associatedAnn = null
        if (lineNorm.length > 0 && !isLabel) {
          // 1. Try to see if this line continues the previous matched multi-line annotation
          if (lastMatchedAnnId !== null) {
            const prevAnn = geniusData.annotations.find(ann => ann.id === lastMatchedAnnId)
            if (prevAnn && prevAnn.fragment) {
              const fragNorm = normalize(prevAnn.fragment)
              if (fragNorm.includes(lineNorm) || lineNorm.includes(fragNorm)) {
                associatedAnn = prevAnn
              }
            }
          }

          // 2. If it didn't match the previous annotation, look for a new one that hasn't been consumed yet
          if (!associatedAnn) {
            associatedAnn = geniusData.annotations.find(ann => {
              if (!ann.fragment || usedAnnIds.has(ann.id)) return false
              const fragNorm = normalize(ann.fragment)
              return fragNorm.includes(lineNorm) || lineNorm.includes(fragNorm)
            }) || null

            if (associatedAnn) {
              if (lastMatchedAnnId !== null && lastMatchedAnnId !== associatedAnn.id) {
                usedAnnIds.add(lastMatchedAnnId)
              }
              lastMatchedAnnId = associatedAnn.id
            } else {
              if (lastMatchedAnnId !== null) {
                usedAnnIds.add(lastMatchedAnnId)
                lastMatchedAnnId = null
              }
            }
          }
        } else {
          if (lastMatchedAnnId !== null) {
            usedAnnIds.add(lastMatchedAnnId)
            lastMatchedAnnId = null
          }
        }

        return {
          line,
          isLabel,
          associatedAnn
        }
      })
  }, [geniusData])

  if (!track) return null
  const hasAnnotations = geniusData && geniusData.annotations.length > 0
  const hasLyrics = geniusData && !!geniusData.lyrics
  if (!loading && !hasAnnotations) return null

  const displayAnnotations = geniusData ? geniusData.annotations : []

  return (
    <div 
      className="rounded-[32px] border border-border/60 bg-card/95 p-6 sm:p-8 shadow-[0_22px_70px_rgba(0,0,0,0.05)] group/genius transition-all duration-500 overflow-hidden h-[720px] flex flex-col relative"
      onClick={() => setFixedAnnId(null)} // 点击背景取消固定
    >
      <style dangerouslySetInnerHTML={{ __html: `
        .lyrics-font {
          font-family: var(--font-caveat), 'LXGW WenKai Screen', cursive, serif;
          font-weight: 700;
        }
        .marker-highlight {
          position: relative;
          z-index: 0;
          display: inline-block;
          width: fit-content;
        }
        .marker-highlight::before {
          content: '';
          position: absolute;
          inset: -2px -12px;
          z-index: -1;
          border-radius: 3px 8px 3px 8px;
          background: 
            conic-gradient(at 0 100%, var(--primary) 1% , #fff0 3%) no-repeat 0 0 / auto 120%,
            conic-gradient(from 180deg at 100% 0, #fff0, var(--primary) 1%, #fff0 4%) no-repeat 100% 100% / auto 120%,
            linear-gradient(var(--mark-bg-angle), color-mix(in srgb, var(--primary) 60%, transparent), color-mix(in srgb, var(--primary) 20%, transparent) 75%, color-mix(in srgb, var(--primary) 55%, transparent)) no-repeat center / auto;
          opacity: var(--mark-opacity, 0);
          transition: all 0.5s cubic-bezier(0.23, 1, 0.32, 1);
          transform: skew(var(--mark-skew, -4deg)) rotate(var(--mark-rotate, 0.5deg)) scale(var(--mark-scale, 1));
          --mark-bg-angle: 50deg;
        }
        .marker-active::before {
          --mark-opacity: 0.85;
          --mark-scale: 1.05;
          --mark-rotate: 1.2deg;
        }
        .marker-fixed::before {
          --mark-opacity: 1;
          --mark-scale: 1.1;
          --mark-rotate: -0.8deg;
          --mark-color: 255 220 0;
        }
        .marker-hint::before {
          --mark-opacity: 0.15;
          --mark-scale: 0.98;
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}} />
      {/* Header */}
      <div className="flex items-center justify-between mb-8 flex-shrink-0">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground/60 flex items-center gap-2">
            <span className={`w-1 h-1 rounded-full bg-primary ${isPlaying ? 'animate-pulse' : 'opacity-40'}`} />
            {isPlaying ? 'Now Playing' : 'Recently Played'}
          </p>
          <h3 className="mt-2 text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
            Behind the Lyrics
          </h3>
          {geniusData && (
            <p className="mt-2 text-sm text-muted-foreground/70 font-medium">
              {geniusData.title}
              <span className="mx-2 text-muted-foreground/20">/</span>
              {geniusData.artist}
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="text-[10px] font-bold uppercase tracking-tighter text-muted-foreground/20 italic">Genius</span>
          <div className="flex items-center gap-1.5">
             {[1, 2, 3].map(i => (
               <div key={i} className={`w-0.5 rounded-full bg-primary/40 transition-all duration-500 ${currentId ? 'h-4' : 'h-2'}`} style={{ transitionDelay: `${i*100}ms` }} />
             ))}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex-grow">
          <AnnotationSkeleton />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-12 items-start flex-grow overflow-hidden h-full pb-8 lg:px-20">
          {/* Left: Lyrics Content (Line-by-line) */}
          <div className="lg:col-span-2 relative h-full flex flex-col overflow-hidden lg:pr-10 lg:border-r lg:border-border/40">
            <div className="flex-grow overflow-y-auto scrollbar-hide pr-4 flex flex-col gap-0 isolate text-center">
              {hasLyrics ? (
                linesWithAnnotations.map(({ line, isLabel, associatedAnn }, idx) => {
                  const isFixed = associatedAnn && fixedAnnId === associatedAnn.id
                  const isActive = associatedAnn && activeAnnId === associatedAnn.id

                  return (
                    <div 
                      key={`${geniusData!.geniusId}-${idx}`}
                      className={`px-3 py-2.5 transition-all duration-300 group/line relative select-none [transform:translateZ(0)] will-change-transform ${
                        isLabel 
                          ? `text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/30 ${idx === 0 ? 'mt-0' : 'mt-8'} mb-1` 
                          : 'text-[24px] md:text-[27px] tracking-tight leading-[1.3]'
                      } ${
                        associatedAnn ? 'cursor-pointer' : ''
                      }`}
                      onMouseEnter={(e) => {
                        if (associatedAnn) {
                          const cardEl = e.currentTarget.closest('.group\\/genius')
                          if (cardEl) {
                            const cardRect = cardEl.getBoundingClientRect()
                            const lineRect = e.currentTarget.getBoundingClientRect()
                            const topOffset = lineRect.top - cardRect.top + lineRect.height
                            setPopupTop(Math.max(80, Math.min(topOffset, 520)))
                          }
                          setActiveAnnId(associatedAnn.id)
                        }
                      }}
                      onMouseLeave={() => setActiveAnnId(null)}
                      onClick={(e) => {
                        if (associatedAnn) {
                          e.stopPropagation()
                          const cardEl = e.currentTarget.closest('.group\\/genius')
                          if (cardEl) {
                            const cardRect = cardEl.getBoundingClientRect()
                            const lineRect = e.currentTarget.getBoundingClientRect()
                            const topOffset = lineRect.top - cardRect.top + lineRect.height
                            setPopupTop(Math.max(80, Math.min(topOffset, 520)))
                          }
                          setFixedAnnId(fixedAnnId === associatedAnn.id ? null : associatedAnn.id)
                        }
                      }}
                    >
                      {isLabel ? (
                        line
                      ) : (
                        <span className="relative inline-block">
                          <span className={`lyrics-font marker-highlight ${
                            isFixed ? 'marker-fixed' : isActive ? 'marker-active' : associatedAnn ? 'marker-hint' : ''
                          }`}>
                            {line}
                          </span>
                        </span>
                      )}
                    </div>
                  )
                })
              ) : (
                <div className="py-20 text-center border-2 border-dashed border-muted/20 rounded-[24px]">
                  <p className="text-sm italic text-muted-foreground/40">Lyrics content currently unavailable</p>
                </div>
              )}
            </div>
          </div>

          {/* Right: Insights Panel */}
          <div 
            className="hidden lg:flex space-y-4 transition-all duration-500 ease-out h-full flex flex-col overflow-hidden"
          >
            <h4 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-2 px-4 flex-shrink-0 flex items-center justify-between">
              <span>{currentId ? 'Selected Insight' : 'Track Insights'}</span>
              {currentId && (
                <button 
                  onClick={(e) => { e.stopPropagation(); setFixedAnnId(null); }}
                  className="text-primary text-[9px] hover:underline"
                >
                  Clear Selection
                </button>
              )}
            </h4>
            <div ref={scrollRef} className="flex-grow overflow-y-auto scrollbar-hide space-y-4 px-4 pt-2 pb-10">
              {displayAnnotations.map((ann) => {
                const isActive = currentId === ann.id
                return (
                  <div
                    key={ann.id}
                    id={`ann-${ann.id}`}
                    className={`p-5 rounded-[26px] border transition-all duration-500 group/ann cursor-default animate-in fade-in slide-in-from-right-4 ${
                      isActive 
                        ? 'bg-card border-primary/40 shadow-lg -translate-y-1 scale-[1.01]' 
                        : 'bg-muted/10 border-border/20 hover:bg-muted/30 hover:border-border/40'
                    }`}
                  >
                    {/* Fragment Display */}
                    {ann.fragment && (
                      <div className="mb-4 pb-3 border-b border-primary/10">
                        <p className="text-[10px] font-bold text-primary/60 dark:text-primary/40 uppercase tracking-widest mb-1.5">Context</p>
                        <p className="text-[12px] italic text-foreground/60 line-clamp-2 leading-relaxed">
                          &ldquo;{ann.fragment}&rdquo;
                        </p>
                      </div>
                    )}

                    <p className={`text-[14px] leading-relaxed transition-colors ${
                      isActive ? 'text-foreground font-medium' : 'text-foreground/80'
                    }`}>
                      {ann.body}
                    </p>
                    
                    <div className={`mt-4 flex items-center justify-between transition-all duration-500 ${
                      isActive ? 'opacity-100' : 'opacity-30 group-hover/ann:opacity-100'
                    }`}>
                      <div className="flex items-center gap-2">
                         <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-tighter ${
                           isActive ? 'bg-primary text-primary-foreground' : 'bg-primary/10 text-primary'
                         }`}>
                           Annotation
                         </span>
                         {ann.votes !== undefined && ann.votes > 0 && (
                           <span className="text-[10px] font-bold text-foreground/40">{ann.votes} helpful</span>
                         )}
                      </div>
                      <a href={ann.url} target="_blank" className="p-1.5 rounded-full hover:bg-primary/20 transition-colors">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M7 7h10v10M7 17L17 7" />
                        </svg>
                      </a>
                    </div>
                  </div>
                )
              })}
              
              {!currentId && geniusData && (
                <div className="py-4 text-center">
                  <p className="text-[10px] text-muted-foreground/30 font-medium italic">Hover or click a line to see details</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Mobile/Narrow Annotation Popup */}
      {currentId && popupTop !== null && (
        <div 
          style={{ top: `${popupTop}px` }}
          className="lg:hidden absolute left-6 right-6 sm:left-auto sm:right-6 sm:w-[280px] p-4 rounded-[22px] border border-primary/30 bg-card/98 shadow-[0_10px_30px_rgba(0,0,0,0.15)] z-50 flex flex-col max-h-[360px] animate-in fade-in slide-in-from-top-1 duration-300"
        >
          {/* Close Button */}
          <div className="flex items-center justify-between mb-4 flex-shrink-0">
            <span className="text-[10px] font-bold text-primary/60 dark:text-primary/40 uppercase tracking-widest">
              Track Insight
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setFixedAnnId(null);
                setActiveAnnId(null);
                setPopupTop(null);
              }}
              className="p-1.5 rounded-full hover:bg-muted transition-colors text-muted-foreground/60 hover:text-foreground"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content area inside popup */}
          <div className="flex-grow overflow-y-auto scrollbar-hide">
            {geniusData?.annotations.filter(a => a.id === currentId).map((ann) => (
              <div key={ann.id} className="space-y-4">
                {ann.fragment && (
                  <div className="pb-3 border-b border-primary/10">
                    <p className="text-[10px] font-bold text-primary/40 dark:text-primary/30 uppercase tracking-widest mb-1.5">Context</p>
                    <p className="text-[12px] italic text-foreground/60 leading-relaxed">
                      &ldquo;{ann.fragment}&rdquo;
                    </p>
                  </div>
                )}

                <p className="text-[14px] leading-relaxed text-foreground font-medium">
                  {ann.body}
                </p>

                <div className="mt-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-tighter bg-primary text-primary-foreground">
                      Annotation
                    </span>
                    {ann.votes !== undefined && ann.votes > 0 && (
                      <span className="text-[10px] font-bold text-foreground/40">{ann.votes} helpful</span>
                    )}
                  </div>
                  <a href={ann.url} target="_blank" className="p-1.5 rounded-full hover:bg-primary/20 transition-colors">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M7 7h10v10M7 17L17 7" />
                    </svg>
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
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
