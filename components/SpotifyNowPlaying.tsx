'use client'

import React from 'react'
import Image from 'next/image'
import { useSpotify } from './SpotifyProvider'

export default function SpotifyNowPlaying() {
  const { data, loading } = useSpotify()

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

  if (!data?.isPlaying) {
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

  const combinedText = `${data.title} - ${data.artist}`

  return (
    <a
      href={data.songUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 py-2 px-1 rounded-lg hover:bg-muted transition-colors duration-150 group cursor-pointer"
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {/* Album Cover */}
        <div className="flex-shrink-0 w-8 h-8 rounded-lg overflow-hidden relative shadow-sm group-hover:scale-105 transition-transform">
          <Image
            src={data.albumImageUrl || ''}
            alt={data.album || ''}
            fill
            className="object-cover"
            unoptimized
          />
        </div>

        {/* Info Container */}
        <div className="flex-1 min-w-0 flex flex-col justify-center py-1">
          {/* Row 1: Song Title - Artist (Marquee) */}
          <div className="marquee-wrapper w-full overflow-hidden relative h-5 flex items-center mb-0.5">
            <div className="marquee-content whitespace-nowrap text-sm font-medium text-foreground group-hover:text-primary transition-colors flex w-max items-center">
              <span className="px-1">{combinedText}</span>
              <span className="px-6 opacity-20">/</span>
              <span className="px-1">{combinedText}</span>
              <span className="px-6 opacity-20">/</span>
            </div>
          </div>

          {/* Row 2: Label and Heart */}
          <div className="flex items-center gap-1.5 opacity-80 h-4 mt-0.5">
            <div className="flex items-center gap-1 shrink-0">
              <span className="text-[10px] font-bold text-[#1DB954] uppercase tracking-tight leading-none">
                我正在听
              </span>
              <span className="animate-heartbeat flex items-center justify-center text-[11px] leading-none transform-gpu origin-center">
                ❤️
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* External Link Icon - Consistent with ToolsCard news style */}
      <svg className="w-3 h-3 text-muted-foreground flex-shrink-0 group-hover:text-[#1DB954] transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
      </svg>

      <style jsx>{`
        .animate-heartbeat {
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
