import { NextResponse } from 'next/server'
import { unstable_cache } from 'next/cache'

import { getR2Object, listR2Objects } from '@/lib/r2'
import { getStoredSpotifyTrackTagStore } from '@/lib/spotify-tags'
import { SpotifyRecentlyPlayedTrack } from '@/lib/spotify-types'

export const dynamic = 'force-dynamic'
export const runtime = 'edge'

const STREAM_CLUSTERS = [
  { key: 'pop', keywords: ['pop', 'k-pop', 'j-pop', 'dream pop', 'synth pop', 'power pop', 'chamber pop', 'art pop', 'indie pop'] },
  { key: 'rock', keywords: ['rock', 'indie', 'alternative', 'punk', 'post-rock', 'indie rock', 'alternative rock', 'shoegaze', 'grunge', 'emo', 'post-punk', 'metal', 'heavy metal'] },
  { key: 'rnb', keywords: ['r&b', 'rnb', 'soul', 'neo-soul'] },
  { key: 'electronic', keywords: ['electronic', 'edm', 'dance', 'techno', 'house', 'electropop', 'ambient', 'electronica', 'idm', 'trance'] },
  { key: 'folk', keywords: ['acoustic', 'folk', 'singer-songwriter', 'country', 'americana', 'bluegrass', 'celtic'] },
  { key: 'classical', keywords: ['classical', 'orchestral', 'piano', 'instrumental'] },
  { key: 'hiphop', keywords: ['hip-hop', 'hip hop', 'rap', 'trap', 'urban'] },
  { key: 'jazz', keywords: ['jazz', 'blues', 'swing', 'bossa nova'] },
]

// Since lib/spotify doesn't export getSpotifyArchiveConfig, we inline the bucket fetch logic
function getBucket() {
  const bucket = process.env.R2_SPOTIFY_BUCKET
  if (!bucket) throw new Error('Missing R2_SPOTIFY_BUCKET')
  return bucket
}

async function readJsonIfExists<T>(bucket: string, key: string): Promise<T | null> {
  try {
    const raw = await getR2Object(bucket, key)
    return JSON.parse(raw) as T
  } catch (error: unknown) {
    if (error instanceof Error && (error.name === 'NoSuchKey' || /NoSuchKey/i.test(error.message))) return null
    throw error
  }
}

async function listAllShards(bucket: string) {
  const path = 'spotify/history/recently-played/'
  const keys = await listR2Objects(bucket, path)
  
  const days: string[] = []
  const months: string[] = []
  
  for (const key of keys) {
    const name = key.slice(path.length).replace('.json', '')
    if (/^\d{4}-\d{2}-\d{2}$/.test(name)) days.push(name)
    else if (/^\d{4}-\d{2}$/.test(name)) months.push(name)
  }
  
  return { days: days.sort().reverse(), months: months.sort().reverse() }
}

const getStreamData = unstable_cache(async () => {
  const bucket = getBucket()
  const { months } = await listAllShards(bucket)
  
  // We need roughly 12 months for Year, 35 days for Week, 7 days for Day, 2 days for 24h
  // To avoid reading too many files, we'll read the last 12 months, which covers everything.
  // Wait, if we read 12 month shards, that's up to 12 files. That is very efficient!
  // Note: Month shards contain all tracks for that month. So we only need to read month shards!
  const targetMonths = months.slice(0, 12)
  if (targetMonths.length === 0) {
    // If no month shards exist yet (e.g. fresh setup), try reading day shards
    // But syncSpotifyDashboardToArchive writes both.
  }
  
  // Actually, to be safe and get the most recent data (including today's partial data not yet in month shard? No, sync writes to both).
  // Let's read the last 12 month shards.
  const shardPromises = targetMonths.map(m => readJsonIfExists<SpotifyRecentlyPlayedTrack[]>(bucket, `spotify/history/recently-played/${m}.json`))
  
  // Also read the last 7 day shards just in case the month shard isn't fully up-to-date with today?
  // syncSpotifyDashboardToArchive writes to BOTH month and day shards simultaneously. So month shard is always up to date!
  
  const shards = await Promise.all(shardPromises)
  const allTracks = shards.flatMap(s => s || [])
  
  const tagStore = await getStoredSpotifyTrackTagStore()
  
  // Pre-compile keyword sets for fast matching
  const clusterMatchers = STREAM_CLUSTERS.map(c => ({
    key: c.key,
    keywords: new Set(c.keywords)
  }))
  
  // Prepare mapped tracks
  const mappedTracks = allTracks.map(t => {
    const entry = tagStore.tracks[t.id]
    const matchedIndices: number[] = []
    
    if (entry) {
      const trackTags = entry.tags.map(tag => tag.name.toLowerCase())
      clusterMatchers.forEach((cluster, i) => {
        if (trackTags.some(tag => cluster.keywords.has(tag))) {
          matchedIndices.push(i)
        }
      })
    }
    
    return {
      playedAt: new Date(t.playedAt).getTime(),
      matchedIndices
    }
  })
  
  const now = new Date()
  
  // 1. Hour (24h): last 24 hours
  const hourBuckets = Array.from({ length: 24 }).map((_, i) => {
    const d = new Date(now.getTime() - (23 - i) * 3600000)
    return { start: d.getTime() - d.getMinutes()*60000 - d.getSeconds()*1000 - d.getMilliseconds(), label: `${d.getHours()}:00` }
  })
  
  // 2. Day (7 days): last 7 days
  const dayBuckets = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date(now.getTime() - (6 - i) * 86400000)
    const start = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
    const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
    const dateStr = `${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
    return { start, label: `${weekdays[d.getDay()]} ${dateStr}` }
  })
  
  // 3. Week (5 weeks): last 5 weeks. 
  const weekBuckets = Array.from({ length: 5 }).map((_, i) => {
    const d = new Date(now.getTime() - (4 - i) * 7 * 86400000)
    // Align to Monday? Or just 7-day rolling periods
    return { start: d.getTime(), label: `第${i+1}周` } // rolling weeks is fine
  })
  
  // 4. Month (12 months): last 12 calendar months
  const monthBuckets = Array.from({ length: 12 }).map((_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1)
    return { start: d.getTime(), label: `${d.getMonth() + 1}月` }
  })
  
  // Fill data
  function fillSeries(buckets: { start: number, label: string }[], nextBucketSpanMs?: number | ((b: {start: number}, i: number) => number)) {
    const raw = Array.from({ length: STREAM_CLUSTERS.length }).map(() => Array(buckets.length).fill(0))
    const labels = buckets.map(b => b.label)
    
    const boundaries = buckets.map((b, i) => {
      const end = i < buckets.length - 1 ? buckets[i+1].start : (
        typeof nextBucketSpanMs === 'function' ? nextBucketSpanMs(b, i) : b.start + (nextBucketSpanMs || 0)
      )
      return { start: b.start, end }
    })
    
    for (const t of mappedTracks) {
      for (let i = 0; i < boundaries.length; i++) {
        if (t.playedAt >= boundaries[i].start && t.playedAt < boundaries[i].end) {
          t.matchedIndices.forEach(clusterIdx => {
            raw[clusterIdx][i]++
          })
          break
        }
      }
    }
    
    return { raw, labels, n: buckets.length }
  }
  
  const hourData = fillSeries(hourBuckets, 3600000)
  const dayData = fillSeries(dayBuckets, 86400000)
  const weekData = fillSeries(weekBuckets, 7 * 86400000)
  const monthData = fillSeries(monthBuckets, (b) => {
    const d = new Date(b.start)
    return new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime()
  })
  
  return {
    hour: { ...hourData, groupLabel: '近期·按小时' },
    day: { ...dayData, groupLabel: '本周·按天' },
    week: { ...weekData, groupLabel: '近期·按周' },
    month: { ...monthData, groupLabel: '今年·按月' }
  }
}, ['spotify-history-stream'], { tags: ['spotify', 'spotify-history'], revalidate: 3600 })

export async function GET() {
  try {
    const data = await getStreamData()
    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 's-maxage=300, stale-while-revalidate=3600'
      }
    })
  } catch (error: unknown) {
    console.error('Failed to aggregate stream data:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
