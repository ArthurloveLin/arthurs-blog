'use client'

import React from 'react'
import Image from 'next/image'
import { useSpotify } from './SpotifyProvider'

export default function SpotifyNowPlaying() {
  const { data, loading } = useSpotify()

  const getTimeAgo = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)

    if (diffInSeconds < 60) return '刚刚'
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}分钟前`
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}小时前`
    return `${Math.floor(diffInSeconds / 86400)}天前`
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
  const isRecent = data.isRecentlyPlayed
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
    <a
      href={data.songUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 py-2 px-1 rounded-lg hover:bg-muted/50 transition-all duration-300 group cursor-pointer relative overflow-hidden"
    >
      {/* Premium Album Glow - Truly Visible Adaptive UI */}
      {data.albumImageUrl && (
        <div className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-30 transition-opacity duration-700 overflow-hidden">
          <Image
            src={data.albumImageUrl}
            alt=""
            fill
            className="object-cover blur-2xl scale-150"
            unoptimized
          />
        </div>
      )}

      <div className="flex items-center gap-3 min-w-0 flex-1 relative z-10">
        {/* Album Cover */}
        <div className="flex-shrink-0 w-8 h-8 rounded-lg overflow-hidden relative shadow-md group-hover:scale-105 transition-transform duration-300">
          <Image
            src={data.albumImageUrl || ''}
            alt={data.album || ''}
            fill
            className={`object-cover ${!isPlaying ? 'grayscale bg-muted opacity-80' : ''}`}
            unoptimized
          />
        </div>

        {/* Info Container */}
        <div className="flex-1 min-w-0 flex flex-col justify-center py-1">
          {/* Row 1: Song Title - Artist (Marquee) */}
          <div className="marquee-wrapper w-full overflow-hidden relative h-5 flex items-center mb-0.5">
            <div className={`marquee-content whitespace-nowrap text-sm font-medium ${isPlaying ? 'text-foreground' : 'text-muted-foreground'} transition-colors flex w-max items-center`}>
              <span className="px-1">{combinedText}</span>
              <span className="px-6 opacity-20">/</span>
              <span className="px-1">{combinedText}</span>
              <span className="px-6 opacity-20">/</span>
            </div>
          </div>

          {/* Row 2: Status & Device */}
          <div className="flex items-center gap-1.5 h-4 mt-0.5 overflow-hidden">
            <div className="flex items-center gap-1.5 shrink-0">
              <span className={`text-[10px] font-bold uppercase tracking-tight leading-none flex items-center gap-1 ${isPlaying ? 'text-[#1DB954]' : 'text-muted-foreground/60'}`}>
                {isPlaying ? (
                  <>
                    正在听
                    <span className="heartbeat-icon inline-flex items-center justify-center text-[10px] transform-gpu origin-center leading-none">
                      ❤️
                    </span>
                  </>
                ) : (
                  `${data.playedAt ? getTimeAgo(data.playedAt) : '曾经'} 听过`
                )}
              </span>
            </div>

            {/* Device Info */}
            {isPlaying && device && (
              <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-muted/60 border border-border/50 max-w-[80px] backdrop-blur-sm">
                <span className="text-[9px] text-muted-foreground/80 truncate leading-none flex items-center gap-1 font-medium">
                  {device.icon} {device.label}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* External Link */}
      <svg className="w-3 h-3 text-muted-foreground/50 flex-shrink-0 group-hover:text-[#1DB954] transition-all duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
      </svg>

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
    </a>
  )
}
