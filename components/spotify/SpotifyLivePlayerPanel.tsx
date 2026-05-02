'use client'

import SpotifyWidePlayer, { type SpotifyWidePlayerStats } from './SpotifyWidePlayer'

export default function SpotifyLivePlayerPanel({ stats }: { stats?: SpotifyWidePlayerStats }) {
  return <SpotifyWidePlayer stats={stats} />
}