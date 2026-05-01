export const dynamic = 'force-dynamic'

function createGeniusWorkerTarget(workerUrl: string) {
  const target = new URL(workerUrl)

  if (target.pathname === '/' || !target.pathname) {
    target.pathname = '/api/genius'
  }

  return target
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const trackId = searchParams.get('trackId') ?? ''
  const title = (searchParams.get('title') ?? '').trim()
  const artist = (searchParams.get('artist') ?? '').trim()
  const durationMs = searchParams.get('durationMs') ?? ''

  if (!title || !artist) {
    return Response.json({ error: 'title and artist are required' }, { status: 400 })
  }

  const workerUrl = process.env.GENIUS_WORKER_URL
  if (!workerUrl) {
    return Response.json({ data: null }, { status: 503 })
  }

  const target = createGeniusWorkerTarget(workerUrl)
  if (trackId) target.searchParams.set('trackId', trackId)
  target.searchParams.set('title', title)
  target.searchParams.set('artist', artist)
  if (durationMs) target.searchParams.set('durationMs', durationMs)

  try {
    const res = await fetch(target.toString())

    if (!res.ok) {
      return Response.json({ data: null }, { status: res.status })
    }

    const data = await res.json() as Record<string, unknown>

    const cacheControl = data?.data
      ? 'public, s-maxage=86400, stale-while-revalidate=604800'
      : 'no-store'

    return Response.json(data, {
      headers: { 'Cache-Control': cacheControl },
    })
  } catch {
    return Response.json({ data: null }, { status: 502 })
  }
}
