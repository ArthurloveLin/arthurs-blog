import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

type WorkerHealth = {
  status: 'ok' | 'degraded' | 'down' | 'timeout' | 'unreachable'
  latency_ms: number
  components: Record<string, { status: 'ok' | 'down'; latency_ms: number }>
}

async function probeWorker(url: string | undefined): Promise<WorkerHealth> {
  if (!url) return { status: 'unreachable', latency_ms: 0, components: {} }
  const t0 = Date.now()
  try {
    const res = await fetch(`${url.replace(/\/+$/, '')}/health`, {
      signal: AbortSignal.timeout(3000),
      headers: { 'Cache-Control': 'no-store' },
    })
    const latency_ms = Date.now() - t0
    if (!res.ok) return { status: 'down', latency_ms, components: {} }
    const body = (await res.json()) as Partial<WorkerHealth>
    return { status: body.status ?? 'down', latency_ms, components: body.components ?? {} }
  } catch (err) {
    const latency_ms = Date.now() - t0
    const isTimeout = err instanceof DOMException && err.name === 'TimeoutError'
    return { status: isTimeout ? 'timeout' : 'unreachable', latency_ms, components: {} }
  }
}

export async function GET() {
  const timestamp = new Date().toISOString()

  // DB probe — supabase-js doesn't support abortSignal chaining, keep Promise.race
  let dbStatus: 'ok' | 'down' = 'ok'
  let dbLatency = 0
  const dbT0 = Date.now()
  try {
    const { error } = await Promise.race([
      supabaseAdmin.from('comments').select('id', { count: 'exact', head: true }).limit(1),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000)),
    ])
    dbLatency = Date.now() - dbT0
    if (error) dbStatus = 'down'
  } catch {
    dbLatency = Date.now() - dbT0
    dbStatus = 'down'
  }

  // Worker fan-out — all probes run concurrently within the same 3s window each
  const [genius, engagement, spotifyNowPlaying, spotifySync, wardrobeProxy] =
    await Promise.allSettled([
      probeWorker(process.env.GENIUS_WORKER_URL),
      probeWorker(process.env.NEXT_PUBLIC_ENGAGEMENT_WORKER_URL),
      probeWorker(process.env.NEXT_PUBLIC_SPOTIFY_NOW_PLAYING_WORKER_URL),
      probeWorker(process.env.SPOTIFY_SYNC_WORKER_URL),
      probeWorker(process.env.WARDROBE_PROXY_URL),
    ])

  const settle = (r: PromiseSettledResult<WorkerHealth>): WorkerHealth =>
    r.status === 'fulfilled' ? r.value : { status: 'unreachable', latency_ms: 0, components: {} }

  const workers = {
    genius: settle(genius),
    engagement: settle(engagement),
    spotify_now_playing: settle(spotifyNowPlaying),
    spotify_sync: settle(spotifySync),
    wardrobe_proxy: settle(wardrobeProxy),
  }

  const dbDown = dbStatus === 'down'
  const anyWorkerUnhealthy = Object.values(workers).some(
    (w) => w.status !== 'ok' && w.status !== 'degraded',
  )
  const overallStatus = dbDown ? 'down' : anyWorkerUnhealthy ? 'degraded' : 'ok'

  return NextResponse.json(
    {
      status: overallStatus,
      timestamp,
      components: {
        database: { status: dbStatus, latency_ms: dbLatency },
        workers,
      },
    },
    {
      status: dbDown ? 503 : 200,
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    },
  )
}
