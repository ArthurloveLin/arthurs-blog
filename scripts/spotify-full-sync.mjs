import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'

// Configuration from .env.local
const {
  SPOTIFY_CLIENT_ID,
  SPOTIFY_CLIENT_SECRET,
  SPOTIFY_REFRESH_TOKEN,
  R2_ACCOUNT_ID,
  R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY,
  R2_SPOTIFY_BUCKET
} = process.env

if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET || !SPOTIFY_REFRESH_TOKEN) {
  console.error('Missing Spotify credentials in .env.local')
  process.exit(1)
}

if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_SPOTIFY_BUCKET) {
  console.error('Missing R2 credentials in .env.local')
  process.exit(1)
}

const r2Client = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
  forcePathStyle: true,
})

const SPOTIFY_TOKEN_ENDPOINT = 'https://accounts.spotify.com/api/token'
const SPOTIFY_SAVED_TRACKS_ENDPOINT = 'https://api.spotify.com/v1/me/tracks'
const SPOTIFY_SAVED_ALBUMS_ENDPOINT = 'https://api.spotify.com/v1/me/albums'
const SPOTIFY_FOLLOWED_ARTISTS_ENDPOINT = 'https://api.spotify.com/v1/me/following'

const SPOTIFY_SAVED_TRACKS_KEY = 'spotify/collection/saved-tracks.json'
const SPOTIFY_SAVED_ALBUMS_KEY = 'spotify/collection/saved-albums.json'
const SPOTIFY_FOLLOWED_ARTISTS_KEY = 'spotify/collection/followed-artists.json'

async function getAccessToken() {
  const basic = Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64')
  const response = await fetch(SPOTIFY_TOKEN_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: SPOTIFY_REFRESH_TOKEN,
    }),
  })

  if (!response.ok) {
    throw new Error(`Failed to refresh token: ${response.statusText}`)
  }

  const data = await response.json()
  return data.access_token
}

async function fetchSpotify(accessToken, url) {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` }
  })
  if (!response.ok) {
    console.error(`Spotify Request Failed: ${url}`, await response.text())
    throw new Error(`Spotify request failed: ${response.statusText}`)
  }
  return response.json()
}

function toTrackSummary(track) {
  return {
    id: track.id || track.uri || track.name,
    title: track.name,
    artists: track.artists.map((a) => a.name),
    album: track.album.name,
    albumId: track.album.id,
    albumImageUrl: track.album.images[0]?.url || null,
    songUrl: track.external_urls?.spotify || '',
    durationMs: track.duration_ms,
    popularity: track.popularity || null,
  }
}

function toAlbumSummary(album) {
  return {
    id: album.id || album.name,
    name: album.name,
    imageUrl: album.images[0]?.url || null,
    url: album.external_urls?.spotify || '',
    artists: album.artists.map((a) => a.name),
    releaseDate: album.release_date || null,
    totalTracks: album.total_tracks || null,
  }
}

function toFollowedArtist(artist) {
  return {
    id: artist.id || artist.name,
    name: artist.name,
    imageUrl: artist.images?.[0]?.url || null,
    url: artist.external_urls?.spotify || '',
    genres: artist.genres || [],
    followers: artist.followers?.total || null,
  }
}

async function getAllSavedTracks(accessToken) {
  console.log('Fetching all Saved Tracks...')
  const items = []
  let nextUrl = `${SPOTIFY_SAVED_TRACKS_ENDPOINT}?limit=50`
  let total = 0

  while (nextUrl) {
    const data = await fetchSpotify(accessToken, nextUrl)
    total = data.total
    items.push(...data.items.filter(i => i.track).map(i => ({
      addedAt: i.added_at,
      track: toTrackSummary(i.track)
    })))
    nextUrl = data.next
    console.log(`  Fetched ${items.length} / ${total} tracks...`)
  }
  return { total, items }
}

async function getAllSavedAlbums(accessToken) {
  console.log('Fetching all Saved Albums...')
  const items = []
  let nextUrl = `${SPOTIFY_SAVED_ALBUMS_ENDPOINT}?limit=50`
  let total = 0

  while (nextUrl) {
    const data = await fetchSpotify(accessToken, nextUrl)
    total = data.total
    items.push(...data.items.map(i => ({
      addedAt: i.added_at,
      album: toAlbumSummary(i.album)
    })))
    nextUrl = data.next
    console.log(`  Fetched ${items.length} / ${total} albums...`)
  }
  return { total, items }
}

async function getAllFollowedArtists(accessToken) {
  console.log('Fetching all Followed Artists...')
  const items = []
  let nextUrl = `${SPOTIFY_FOLLOWED_ARTISTS_ENDPOINT}?type=artist&limit=50`
  let total = 0

  while (nextUrl) {
    const data = await fetchSpotify(accessToken, nextUrl)
    total = data.artists.total
    items.push(...data.artists.items.map(toFollowedArtist))
    nextUrl = data.artists.next
    console.log(`  Fetched ${items.length} / ${total} artists...`)
  }
  return { total, items }
}

async function uploadToR2(key, data) {
  console.log(`Uploading to R2: ${key} (${JSON.stringify(data).length} bytes)`)
  const command = new PutObjectCommand({
    Bucket: R2_SPOTIFY_BUCKET,
    Key: key,
    Body: JSON.stringify(data, null, 2),
    ContentType: 'application/json; charset=utf-8',
    CacheControl: 'no-store',
  })
  await r2Client.send(command)
}

async function main() {
  try {
    const accessToken = await getAccessToken()
    
    const savedTracks = await getAllSavedTracks(accessToken)
    await uploadToR2(SPOTIFY_SAVED_TRACKS_KEY, savedTracks)

    const savedAlbums = await getAllSavedAlbums(accessToken)
    await uploadToR2(SPOTIFY_SAVED_ALBUMS_KEY, savedAlbums)

    const followedArtists = await getAllFollowedArtists(accessToken)
    await uploadToR2(SPOTIFY_FOLLOWED_ARTISTS_KEY, followedArtists)

    console.log('\n✅ Full Library Sync Complete!')
  } catch (error) {
    console.error('\n❌ Sync Failed:', error)
    process.exit(1)
  }
}

main()
