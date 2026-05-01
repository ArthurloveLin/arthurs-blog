const DEFAULT_SUPABASE_HOST = 'ymdwknyxmbhckgftfena.supabase.co'
const DEFAULT_CORS_ALLOW_ORIGIN = 'https://arthurlovegrace.top'

function createCorsHeaders(allowOrigin: string) {
  const headers: Record<string, string> = {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info',
  }

  if (allowOrigin !== '*') {
    headers['Access-Control-Allow-Credentials'] = 'true'
    headers['Vary'] = 'Origin'
  }

  return headers
}

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

function resolveCorsOrigin(request: Request, env: Cloudflare.Env) {
  const configuredOrigin: string =
    env.CORS_ALLOW_ORIGIN || DEFAULT_CORS_ALLOW_ORIGIN
  const requestOrigin = request.headers.get('Origin')

  if (!requestOrigin || configuredOrigin === '*') {
    return configuredOrigin
  }

  return requestOrigin === configuredOrigin ? requestOrigin : null
}

const worker = {
  async fetch(request, env) {
    const incomingUrl = new URL(request.url)
    const upstreamUrl = new URL(request.url)
    const supabaseHost = env.SUPABASE_HOST || DEFAULT_SUPABASE_HOST
    const allowOrigin = resolveCorsOrigin(request, env)

    if (request.headers.get('Origin') && !allowOrigin) {
      return new Response('Forbidden', { status: 403 })
    }

    const corsHeaders = createCorsHeaders(allowOrigin || DEFAULT_CORS_ALLOW_ORIGIN)

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders })
    }

    upstreamUrl.protocol = 'https:'
    upstreamUrl.hostname = supabaseHost
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
      const response = await fetch(upstreamRequest)
      const proxiedResponse = new Response(response.body, response)

      Object.entries(corsHeaders).forEach(([key, value]) => {
        proxiedResponse.headers.set(key, value)
      })

      return proxiedResponse
    } catch (error) {
      logError('proxy request to supabase failed', error, {
        method: request.method,
        path: incomingUrl.pathname,
        targetHost: supabaseHost,
      })
      return new Response('Bad Gateway', { status: 502, headers: corsHeaders })
    }
  },
} satisfies ExportedHandler<Cloudflare.Env>

export default worker