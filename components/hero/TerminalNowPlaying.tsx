'use client'

import { SpotifyProvider, useSpotify } from '@/components/SpotifyProvider'

// Terminal-styled now-playing chip. Wraps its own SpotifyProvider so the hero
// stays decoupled from the dashboard's provider — the provider's smart polling
// (pause when idle, refresh near track end) comes along for free. Lazy-loaded
// ssr:false by the terminal hero, so a missing worker URL can't break SSR.
function NowPlayingLine() {
  const { state: { data } } = useSpotify()

  if (!data) {
    return (
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
        <span className="text-muted-foreground/50">♫</span>
        <span className="text-muted-foreground/60">idle — nothing playing</span>
      </span>
    )
  }

  const playing = data.isPlaying

  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap max-w-full">
      <span
        aria-hidden
        className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
        style={{ backgroundColor: playing ? '#1DB954' : 'var(--muted-foreground)' }}
      />
      <span className="shrink-0" style={{ color: playing ? '#1DB954' : undefined }}>
        {playing ? 'now playing' : 'last played'}
      </span>
      <span className="text-muted-foreground/40">:</span>
      <span className="truncate text-foreground/80">
        {data.title}
        <span className="text-muted-foreground/50"> — {data.artist}</span>
      </span>
    </span>
  )
}

export default function TerminalNowPlaying() {
  return (
    <SpotifyProvider>
      <NowPlayingLine />
    </SpotifyProvider>
  )
}
