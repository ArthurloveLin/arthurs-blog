import 'server-only'

import { getR2Object } from './r2'

const SPOTIFY_REPORT_KEY = 'spotify/latest/report.json'

export interface MusicReportTopTrack {
  title: string
  artist: string
  albumImageUrl: string | null
  playCount: number
  durationMs: number
  tags: string[]
  peakHour: number | null
}

export interface MusicReportTopArtist {
  name: string
  playCount: number
  totalMinutes: number
  imageUrl: string | null
  tags: string[]
  peakHour: number | null
}

export interface MusicReportTopContext {
  label: string
  type: string
  playCount: number
  imageUrl: string | null
}

export interface MusicReportStats {
  period: 'day' | 'week' | 'month'
  periodLabel: string
  dateRange: string
  topTrack: MusicReportTopTrack | null
  topArtist: MusicReportTopArtist | null
  top5Tracks: MusicReportTopTrack[]
  top5Artists: MusicReportTopArtist[]
  topContext: MusicReportTopContext | null
  top2Contexts: MusicReportTopContext[]
  topTag: string | null
  totalPlays: number
  totalMinutes: number
  peakHour: number | null
}

export interface MusicReport {
  day: MusicReportStats
  week: MusicReportStats
  month: MusicReportStats
  generatedAt: string
}

function isMissingR2ObjectError(error: unknown) {
  if (!(error instanceof Error)) {
    return false
  }

  return (
    error.name === 'NoSuchKey' ||
    /NoSuchKey/i.test(error.message) ||
    /The specified key does not exist/i.test(error.message)
  )
}

export async function readStoredMusicReport(): Promise<MusicReport | null> {
  const bucket = process.env.R2_SPOTIFY_BUCKET
  if (!bucket) {
    return null
  }

  try {
    const raw = await getR2Object(bucket, SPOTIFY_REPORT_KEY)
    return JSON.parse(raw) as MusicReport
  } catch (error) {
    if (isMissingR2ObjectError(error)) {
      return null
    }

    throw error
  }
}

export async function getMusicReport(): Promise<MusicReport | null> {
  return readStoredMusicReport()
}
