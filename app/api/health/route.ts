import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

export async function GET() {
  const timestamp = new Date().toISOString()

  // Check database connectivity with a 3-second timeout
  let dbStatus: 'ok' | 'down' = 'ok'
  let dbLatency: number | undefined

  const t0 = Date.now()
  try {
    const { error } = await Promise.race([
      supabaseAdmin.from('comments').select('id', { count: 'exact', head: true }).limit(1),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000)),
    ])
    dbLatency = Date.now() - t0
    if (error) dbStatus = 'down'
  } catch {
    dbLatency = Date.now() - t0
    dbStatus = 'down'
  }

  const healthy = dbStatus === 'ok'

  return NextResponse.json(
    {
      status: healthy ? 'ok' : 'degraded',
      timestamp,
      components: {
        database: {
          status: dbStatus,
          latency_ms: dbLatency,
        },
      },
    },
    {
      status: healthy ? 200 : 503,
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    },
  )
}
