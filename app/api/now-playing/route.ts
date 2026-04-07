import { NextResponse } from 'next/server'

const client_id = process.env.SPOTIFY_CLIENT_ID
const client_secret = process.env.SPOTIFY_CLIENT_SECRET
const refresh_token = process.env.SPOTIFY_REFRESH_TOKEN

const basic = Buffer.from(`${client_id}:${client_secret}`).toString('base64')
const PLAYER_ENDPOINT = `https://api.spotify.com/v1/me/player`
const RECENTLY_PLAYED_ENDPOINT = `https://api.spotify.com/v1/me/player/recently-played?limit=10`
const AUDIO_FEATURES_ENDPOINT = `https://api.spotify.com/v1/audio-features`
const TOKEN_ENDPOINT = `https://accounts.spotify.com/api/token`

const getAccessToken = async () => {
  const response = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refresh_token!,
    }),
  })

  return response.json()
}

export const dynamic = 'force-dynamic'

interface SpotifyTrack {
  id: string;
  name: string;
  album: {
    name: string;
    images: Array<{ url: string }>;
  };
  artists: Array<{ name: string }>;
  external_urls: { spotify: string };
}

interface SpotifyPlayback {
  item: SpotifyTrack | null;
  is_playing: boolean;
  device?: {
    name: string;
    type: string;
  };
}

interface RecentlyPlayed {
  items: Array<{
    track: SpotifyTrack;
    played_at: string;
  }>;
}

export async function GET() {
  const { access_token } = await getAccessToken()

  // 1. Try to get current playback
  const playerRes = await fetch(PLAYER_ENDPOINT, {
    headers: { Authorization: `Bearer ${access_token}` },
  })

  let isPlaying = false
  let currentTrack: any = null

  if (playerRes.status === 200) {
    const playback: SpotifyPlayback = await playerRes.json()
    if (playback.item) {
      isPlaying = playback.is_playing
      currentTrack = {
        title: playback.item.name,
        artist: playback.item.artists.map((a) => a.name).join(', '),
        album: playback.item.album.name,
        albumImageUrl: playback.item.album.images[0]?.url,
        songUrl: playback.item.external_urls.spotify,
        deviceName: playback.device?.name,
        deviceType: playback.device?.type,
        playedAt: playback.is_playing ? undefined : new Date().toISOString(),
        id: playback.item.id,
      }
    }
  }

  // 2. Always fetch recently played to populate history
  const recentRes = await fetch(RECENTLY_PLAYED_ENDPOINT, {
    headers: { Authorization: `Bearer ${access_token}` },
  })
  
  let recentTracks: any[] = []
  if (recentRes.ok) {
    const recent: RecentlyPlayed = await recentRes.json()
    
    // Map to simplified structure and remove duplicates by track ID
    const seenIds = new Set()
    if (currentTrack?.id) seenIds.add(currentTrack.id)
    
    recent.items.forEach(item => {
      if (!seenIds.has(item.track.id) && recentTracks.length < 5) {
        seenIds.add(item.track.id)
        recentTracks.push({
          id: item.track.id,
          title: item.track.name,
          artist: item.track.artists.map((a) => a.name).join(', '),
          album: item.track.album.name,
          albumImageUrl: item.track.album.images[0]?.url,
          songUrl: item.track.external_urls.spotify,
          playedAt: item.played_at,
        })
      }
    })
  }

  // 3. Fallback: If nothing is playing, currentTrack uses the latest from recentTracks
  let isRecentlyPlayedFiltered = false
  if (!currentTrack && recentTracks.length > 0) {
    isRecentlyPlayedFiltered = true
    currentTrack = recentTracks.shift()
  }

  if (!currentTrack) {
    return NextResponse.json({ isPlaying: false })
  }

  // 4. Optional: Get BPM for current track
  let bpm = null
  if (currentTrack.id) {
    try {
      const audioFeaturesRes = await fetch(`${AUDIO_FEATURES_ENDPOINT}/${currentTrack.id}`, {
        headers: { Authorization: `Bearer ${access_token}` },
      })
      if (audioFeaturesRes.ok) {
        const features = await audioFeaturesRes.json()
        bpm = features.tempo
      }
    } catch (e) {
      console.error('Failed to fetch audio features', e)
    }
  }

  return NextResponse.json({
    ...currentTrack,
    isPlaying,
    isRecentlyPlayed: isRecentlyPlayedFiltered,
    bpm,
    recentTracks, 
  })
}
