import { NextResponse } from 'next/server'

import { isAdminRequest } from '@/lib/auth'
import { getAgentRuntimeHealth } from '@/lib/agent-runtime/config'

export const runtime = 'nodejs'

export async function GET() {
  if (!await isAdminRequest()) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const health = await getAgentRuntimeHealth()

  return NextResponse.json(
    {
      status: health.ok ? 'ok' : 'degraded',
      checkedAt: new Date().toISOString(),
      runtime,
      health,
    },
    {
      status: health.ok ? 200 : 503,
      headers: {
        'Cache-Control': 'no-store',
      },
    }
  )
}