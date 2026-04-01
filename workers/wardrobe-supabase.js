// wardrobe-supabase Worker
// 将发往此 Worker 的请求透传给 Supabase，解决国内访问封锁问题
const SUPABASE_HOST = 'ymdwknyxmbhckgftfena.supabase.co'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info',
}

export default {
  async fetch(request) {
    // 处理预检请求
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS })
    }

    const url = new URL(request.url)
    url.hostname = SUPABASE_HOST

    const newRequest = new Request(url.toString(), {
      method: request.method,
      headers: request.headers,
      body: request.method !== 'GET' && request.method !== 'HEAD'
        ? request.body
        : undefined,
      redirect: 'follow',
    })

    const response = await fetch(newRequest)

    // 注入 CORS 头，避免浏览器跨域报错
    const newResponse = new Response(response.body, response)
    Object.entries(CORS_HEADERS).forEach(([k, v]) => newResponse.headers.set(k, v))
    return newResponse
  },
}
