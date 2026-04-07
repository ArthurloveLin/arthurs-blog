import { NextResponse } from 'next/server'

const client_id = process.env.SPOTIFY_CLIENT_ID
const client_secret = process.env.SPOTIFY_CLIENT_SECRET
const refresh_token = process.env.SPOTIFY_REFRESH_TOKEN

const basic = Buffer.from(`${client_id}:${client_secret}`).toString('base64')
const PLAYER_ENDPOINT = `https://api.spotify.com/v1/me/player`
const RECENTLY_PLAYED_ENDPOINT = `https://api.spotify.com/v1/me/player/recently-played?limit=1`
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

interface SpotifyPlayback {
  item: {
    id: string;
    name: string;
    album: {
      name: string;
      images: Array<{ url: string }>;
    };
    artists: Array<{ name: string }>;
    external_urls: { spotify: string };
  } | null;
  is_playing: boolean;
  device?: {
    name: string;
    type: string;
  };
}

interface RecentlyPlayed {
  items: Array<{
    track: {
      id: string;
      name: string;
      album: {
        name: string;
        images: Array<{ url: string }>;
      };
      artists: Array<{ name: string }>;
      external_urls: { spotify: string };
    };
    played_at: string;
  }>;
}

export async function GET() {
  const { access_token } = await getAccessToken()

  // 1. Try to get current playback (includes device)
  const playerRes = await fetch(PLAYER_ENDPOINT, {
    headers: { Authorization: `Bearer ${access_token}` },
  })

  let isPlaying = false
  let data: any = null

  if (playerRes.status === 200) {
    const playback: SpotifyPlayback = await playerRes.json()
    if (playback.item) {
      isPlaying = playback.is_playing
      data = {
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

  // 2. If nothing is playing, fallback to recently played
  let isRecentlyPlayed = false
  if (!data) {
    const recentRes = await fetch(RECENTLY_PLAYED_ENDPOINT, {
      headers: { Authorization: `Bearer ${access_token}` },
    })
    if (recentRes.ok) {
      const recent: RecentlyPlayed = await recentRes.json()
      const track = recent.items[0]?.track
      if (track) {
        isRecentlyPlayed = true
        data = {
          title: track.name,
          artist: track.artists.map((a) => a.name).join(', '),
          album: track.album.name,
          albumImageUrl: track.album.images[0]?.url,
          songUrl: track.external_urls.spotify,
          playedAt: recent.items[0].played_at,
          id: track.id,
        }
      }
    }
  }

  if (!data) {
    return NextResponse.json({ isPlaying: false })
  }

  // 3. Optional: Get BPM if we have a track ID
  let bpm = null
  if (data.id) {
    try {
      const audioFeaturesRes = await fetch(`${AUDIO_FEATURES_ENDPOINT}/${data.id}`, {
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
    ...data,
    isPlaying,
    isRecentlyPlayed,
    bpm,
  })
}
