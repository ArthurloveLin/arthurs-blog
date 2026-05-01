const DEFAULT_VERCEL_HOST = 'wardrobe-picks.vercel.app'

function logError(message: string, error: unknown, fields: Record<string, unknown> = {}) {
  console.error(
    JSON.stringify({
      level: 'error',
      message,
      error: error instanceof Error ? error.message : String(error),
      ...fields,
    })
  )
}

const worker = {
  async fetch(request, env) {
    const incomingUrl = new URL(request.url)
    const upstreamUrl = new URL(request.url)
    const vercelHost = env.VERCEL_HOST || DEFAULT_VERCEL_HOST

    upstreamUrl.protocol = 'https:'
    upstreamUrl.hostname = vercelHost
    upstreamUrl.port = ''

    const upstreamRequest = new Request(upstreamUrl.toString(), {
      method: request.method,
      headers: request.headers,
      body:
        request.method !== 'GET' && request.method !== 'HEAD'
          ? request.body
          : undefined,
      redirect: 'manual',
    })

    try {
      return await fetch(upstreamRequest)
    } catch (error) {
      logError('proxy request to vercel failed', error, {
        method: request.method,
        path: incomingUrl.pathname,
        targetHost: vercelHost,
      })
      return new Response('Bad Gateway', { status: 502 })
    }
  },
} satisfies ExportedHandler<Cloudflare.Env>

export default worker