'use client'

import { SpotifyProvider } from '@/components/SpotifyProvider'
import SpotifyWidePlayer, { type SpotifyWidePlayerStats } from './SpotifyWidePlayer'

export default function SpotifyLivePlayerPanel({ stats }: { stats?: SpotifyWidePlayerStats }) {
  return (
    <SpotifyProvider>
      <SpotifyWidePlayer stats={stats} />
    </SpotifyProvider>
  )
}