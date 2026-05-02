'use client'

import { SpotifyProvider } from '@/components/SpotifyProvider'
import SpotifyGeniusLiveCard from './SpotifyGeniusLiveCard'
import SpotifyLivePlayerPanel from './SpotifyLivePlayerPanel'
import type { SpotifyWidePlayerStats } from './SpotifyWidePlayer'

export default function SpotifyLiveNowPlayingSection({ stats }: { stats?: SpotifyWidePlayerStats }) {
  return (
    <SpotifyProvider>
      <SpotifyLivePlayerPanel stats={stats} />

      <div className="mt-4">
        <SpotifyGeniusLiveCard />
      </div>
    </SpotifyProvider>
  )
}