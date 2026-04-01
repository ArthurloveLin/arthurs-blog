// wardrobe-front Worker
// 将发往此 Worker 的请求透传给 Vercel，解决国内访问封锁问题
// ⚠️ 将下面的 VERCEL_HOST 替换为你的实际 Vercel 部署域名（不含 https://）
const VERCEL_HOST = 'wardrobe-picks.vercel.app'

export default {
  async fetch(request) {
    const url = new URL(request.url)
    url.hostname = VERCEL_HOST

    const newRequest = new Request(url.toString(), {
      method: request.method,
      headers: request.headers,
      body: request.method !== 'GET' && request.method !== 'HEAD'
        ? request.body
        : undefined,
      redirect: 'follow',
    })

    return fetch(newRequest)
  },
}
