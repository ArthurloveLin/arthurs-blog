'use client'

import React, { useState, startTransition, unstable_ViewTransition as ViewTransition } from 'react'
import Image from 'next/image'
import { useSpotify } from './SpotifyProvider'

export default function SpotifyNowPlaying({ id = 'default' }: { id?: string }) {
  const { data, loading } = useSpotify()
  const [isExpanded, setIsExpanded] = useState(false)

  const getTimeAgo = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)

    if (diffInSeconds < 60) return '刚刚'
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}分钟前`
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}小时前`
    return `${Math.floor(diffInSeconds / 86400)}天前`
  }

  const toggleExpand = (e: React.MouseEvent) => {
    e.stopPropagation()
    // If clicking a link inside the expanded view, don't toggle
    if ((e.target as HTMLElement).closest('a')) return
    
    startTransition(() => {
      setIsExpanded(!isExpanded)
    })
  }

  if (loading) {
    return (
      <div className="flex items-center gap-3 py-2 px-1 rounded-lg animate-pulse">
        <div className="w-8 h-8 bg-muted rounded-lg shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-2 bg-muted rounded w-3/4" />
          <div className="h-1.5 bg-muted rounded w-1/2" />
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex items-center gap-3 py-2 px-1 rounded-lg opacity-50 grayscale hover:grayscale-0 transition-all duration-300 overflow-hidden">
        <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-muted-foreground">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground leading-none mb-0.5">Spotify</p>
          <p className="text-[11px] text-muted-foreground leading-none">Not Playing</p>
        </div>
      </div>
    )
  }

  const isPlaying = data.isPlaying
  const combinedText = `${data.title} - ${data.artist}`

  const getDeviceLabel = () => {
    if (!data.deviceName || !data.deviceType) return null
    const name = data.deviceName.toLowerCase()
    const type = data.deviceType.toLowerCase()

    if (type === 'computer' || name.includes('mac') || name.includes('desktop') || name.includes('pc')) return { label: 'PC', icon: '💻' }
    if (name.includes('iphone') || name.includes('ipad')) return { label: 'iOS', icon: '📱' }
    if (name.includes('android')) return { label: 'Android', icon: '📱' }
    if (type === 'smartphone') return { label: 'Mobile', icon: '📱' }
    if (type === 'speaker') return { label: 'Speaker', icon: '🔈' }
    return { label: 'Device', icon: '🔈' }
  }

  const device = getDeviceLabel()

  return (
    <ViewTransition name={`spotify-card-${id}`}>
      <div
        onClick={toggleExpand}
        className={`relative overflow-hidden transition-all duration-500 cursor-pointer group ${
          isExpanded 
            ? 'rounded-2xl p-4 shadow-xl border border-black/5 dark:border-white/10 bg-white/80 dark:bg-black backdrop-blur-md dark:backdrop-blur-none z-20' 
            : 'rounded-lg py-2 px-1 hover:bg-muted/50'
        }`}
      >
        {/* Album Glow / Background Dye */}
        {data.albumImageUrl && (
          <div className={`absolute inset-0 pointer-events-none transition-opacity duration-700 overflow-hidden ${isExpanded ? 'opacity-20' : 'opacity-0 group-hover:opacity-30'}`}>
            <Image
              src={data.albumImageUrl}
              alt=""
              fill
              className="object-cover blur-3xl scale-150"
              unoptimized
            />
          </div>
        )}

        {/* --- Card Header (Always Visible) --- */}
        <div className={`flex items-center gap-3 relative z-10 transition-all duration-500 ${isExpanded ? 'mb-6' : ''}`}>
          {/* Album Cover */}
          <ViewTransition name={`spotify-album-${id}`}>
            <div className={`flex-shrink-0 overflow-hidden relative shadow-md transition-all duration-500 ${isExpanded ? 'w-12 h-12 rounded-xl' : 'w-8 h-8 rounded-lg group-hover:scale-105'}`}>
              <Image
                src={data.albumImageUrl || ''}
                alt={data.album || ''}
                fill
                className={`object-cover ${!isPlaying ? 'grayscale bg-muted opacity-80' : ''}`}
                unoptimized
              />
            </div>
          </ViewTransition>

          {/* Info Container */}
          <div className="flex-1 min-w-0 flex flex-col justify-center py-1">
            {/* Row 1: Song Title - Artist */}
            <div className={`marquee-wrapper w-full overflow-hidden relative flex items-center mb-0.5 ${isExpanded ? 'h-6' : 'h-5'}`}>
              <div className={`marquee-content whitespace-nowrap font-medium ${isPlaying ? 'text-foreground' : 'text-muted-foreground'} transition-all flex w-max items-center ${isExpanded ? 'text-base' : 'text-sm'}`}>
                <span className="px-1">{combinedText}</span>
                {!isExpanded && (
                  <>
                    <span className="px-6 opacity-20">/</span>
                    <span className="px-1">{combinedText}</span>
                    <span className="px-6 opacity-20">/</span>
                  </>
                )}
              </div>
            </div>

            {/* Row 2: Status & Device */}
            <div className="flex items-center gap-1.5 h-4 mt-0.5 overflow-hidden">
              <span className={`text-[10px] font-bold uppercase tracking-tight leading-none flex items-center gap-1 ${isPlaying ? 'text-[#1DB954]' : 'text-muted-foreground/60'}`}>
                {isPlaying ? (
                  <>
                    正在播放
                    <span className="heartbeat-icon inline-flex items-center justify-center text-[10px]">❤️</span>
                  </>
                ) : (
                  `${data.playedAt ? getTimeAgo(data.playedAt) : '曾经'} 听过`
                )}
              </span>
              {isPlaying && device && (
                <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-muted/60 border border-border/50 backdrop-blur-sm">
                  <span className="text-[9px] text-muted-foreground/80 truncate leading-none flex items-center gap-1 font-medium">
                    {device.icon} {device.label}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Action Icon */}
          {!isExpanded ? (
            <svg className="w-3 h-3 text-muted-foreground/50 flex-shrink-0 group-hover:text-[#1DB954] transition-all duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          ) : null}
        </div>

        {/* --- Expanded Content (Recently Played) --- */}
        {isExpanded && (
          <div className="relative z-10 animate-in fade-in slide-in-from-top-4 duration-700 ease-out">
            <div className="flex items-center justify-between mb-3 px-1">
              <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">最近播放</h4>
              <div className="h-[1px] flex-1 bg-border/40 mx-4" />
            </div>
            
            <div className="space-y-1">
              {(data.recentTracks || []).slice(0, 5).map((track, i) => (
                <div
                  key={`${track.id}-${i}`}
                  className="flex items-center gap-3 p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition-all duration-200 group/item"
                >
                  <div className="relative w-8 h-8 rounded-lg overflow-hidden shrink-0 shadow-sm group-hover/item:shadow-md transition-shadow">
                    <Image
                      src={track.albumImageUrl}
                      alt={track.album}
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground truncate group-hover/item:text-primary transition-colors">
                      {track.title}
                    </p>
                    <p className="text-[10px] text-muted-foreground truncate flex items-center gap-1.5">
                      {track.artist}
                      <span className="w-0.5 h-0.5 rounded-full bg-muted-foreground/30" />
                      {getTimeAgo(track.playedAt)}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <button 
              onClick={(e) => { e.stopPropagation(); startTransition(() => setIsExpanded(false)) }}
              className="w-full mt-4 py-2 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground transition-colors"
            >
              收起详情
            </button>
          </div>
        )}

        <style jsx>{`
          .heartbeat-icon {
            animation: heartbeat 1.2s ease-in-out infinite;
          }
          @keyframes heartbeat {
            0%, 100% { transform: scale(0.9); opacity: 0.8; }
            50% { transform: scale(1.15); opacity: 1; }
          }

          .marquee-wrapper {
            mask-image: linear-gradient(to right, transparent, black 10%, black 90%, transparent);
          }
          
          .marquee-content {
            animation: marquee-scroll 25s linear infinite;
            animation-play-state: ${isExpanded ? 'paused' : 'running'};
            line-height: normal;
          }
          @keyframes marquee-scroll {
            0% { transform: translateX(0); }
            100% { transform: translateX(-50%); }
          }

          .group:hover .marquee-content {
            animation-play-state: paused;
          }
        `}</style>
      </div>
    </ViewTransition>
  )
}
