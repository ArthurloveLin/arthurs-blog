'use client'

import { SpotifyProvider } from '@/components/SpotifyProvider'
import SpotifyWidePlayer from './SpotifyWidePlayer'

export default function SpotifyLivePlayerPanel() {
  return (
    <SpotifyProvider>
      <SpotifyWidePlayer />
    </SpotifyProvider>
  )
}