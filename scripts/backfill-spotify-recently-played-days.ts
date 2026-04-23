import dotenv from 'dotenv'

import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'

dotenv.config({ path: '.env.local' })

type SpotifyRecentlyPlayedTrack = {
  id: string
  playedAt: string
}

const SPOTIFY_RECENTLY_PLAYED_PATH = 'spotify/history/recently-played/'
const MONTH_PATTERN = /^\d{4}-\d{2}$/

function printUsage() {
  console.log([
    'Usage: npm run spotify:backfill-days -- <YYYY-MM> [--dry-run]',
    '',
    'Example:',
    '  npm run spotify:backfill-days -- 2026-04 --dry-run',
    '  npm run spotify:backfill-days -- 2026-04',
  ].join('\n'))
}

function parseArgs(argv: string[]) {
  const args = [...argv]

  if (args.includes('--help') || args.includes('-h')) {
    printUsage()
    process.exit(0)
  }

  const dryRun = args.includes('--dry-run')
  const month = args.find((value) => MONTH_PATTERN.test(value))

  if (!month) {
    printUsage()
    throw new Error('Missing month argument in YYYY-MM format')
  }

  return { month, dryRun }
}

function requireEnv(name: string) {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }

  return value
}

function createR2Client() {
  const accountId = requireEnv('R2_ACCOUNT_ID')
  const accessKeyId = requireEnv('R2_ACCESS_KEY_ID')
  const secretAccessKey = requireEnv('R2_SECRET_ACCESS_KEY')

  return new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
    forcePathStyle: true,
  })
}

function isMissingObjectError(error: unknown) {
  if (!(error instanceof Error)) {
    return false
  }

  return error.name === 'NoSuchKey' || /NoSuchKey|specified key does not exist/i.test(error.message)
}

async function readJson<T>(client: S3Client, bucket: string, key: string): Promise<T> {
  const response = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }))
  const body = await response.Body?.transformToString('utf-8')

  if (!body) {
    throw new Error(`R2 object is empty: ${key}`)
  }

  return JSON.parse(body) as T
}

async function readJsonIfExists<T>(client: S3Client, bucket: string, key: string): Promise<T | null> {
  try {
    return await readJson<T>(client, bucket, key)
  } catch (error) {
    if (isMissingObjectError(error)) {
      return null
    }

    throw error
  }
}

async function writeJson(client: S3Client, bucket: string, key: string, payload: unknown) {
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: JSON.stringify(payload, null, 2),
      ContentType: 'application/json; charset=utf-8',
      CacheControl: 'no-store',
    })
  )
}

function getYearMonthDay(date: Date = new Date()) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function mergeByKey<T>(currentItems: T[], incomingItems: T[], getKey: (item: T) => string) {
  const merged = new Map<string, T>()

  for (const item of incomingItems) {
    merged.set(getKey(item), item)
  }

  for (const item of currentItems) {
    const key = getKey(item)
    if (!merged.has(key)) {
      merged.set(key, item)
    }
  }

  return Array.from(merged.values())
}

async function main() {
  const { month, dryRun } = parseArgs(process.argv.slice(2))
  const bucket = requireEnv('R2_SPOTIFY_BUCKET')
  const client = createR2Client()
  const monthKey = `${SPOTIFY_RECENTLY_PLAYED_PATH}${month}.json`

  console.log(`Reading monthly shard: ${monthKey}`)
  const monthlyTracks = await readJson<SpotifyRecentlyPlayedTrack[]>(client, bucket, monthKey)

  if (!Array.isArray(monthlyTracks)) {
    throw new Error(`Expected ${monthKey} to contain an array of recently played tracks`)
  }

  const tracksByDay = new Map<string, SpotifyRecentlyPlayedTrack[]>()

  for (const track of monthlyTracks) {
    if (!track?.playedAt || !track?.id) {
      continue
    }

    const day = getYearMonthDay(new Date(track.playedAt))
    const group = tracksByDay.get(day) ?? []
    group.push(track)
    tracksByDay.set(day, group)
  }

  const days = Array.from(tracksByDay.keys()).sort((a, b) => a.localeCompare(b))
  console.log(`Found ${days.length} day shard(s) inside ${month}.`)

  for (const day of days) {
    const dayKey = `${SPOTIFY_RECENTLY_PLAYED_PATH}${day}.json`
    const existingTracks = (await readJsonIfExists<SpotifyRecentlyPlayedTrack[]>(client, bucket, dayKey)) ?? []
    const mergedTracks = mergeByKey(
      existingTracks,
      tracksByDay.get(day) ?? [],
      (item) => `${item.id}:${item.playedAt}`
    ).toSorted((a, b) => new Date(b.playedAt).getTime() - new Date(a.playedAt).getTime())

    console.log(
      `${dryRun ? '[dry-run] ' : ''}${dayKey} <= monthly ${tracksByDay.get(day)?.length ?? 0} track(s), existing ${existingTracks.length}, merged ${mergedTracks.length}`
    )

    if (!dryRun) {
      await writeJson(client, bucket, dayKey, mergedTracks)
    }
  }

  console.log(dryRun ? 'Dry run complete.' : 'Backfill complete.')
}

void main().catch((error) => {
  console.error('Backfill failed:', error)
  process.exit(1)
})