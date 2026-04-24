/**
 * Cloudflare Worker — Last.fm 标签增量同步
 *
 * 每30分钟触发一次，调用 /api/spotify/sync-tags
 * 每次最多处理 35 条 pending 曲目，直到全部覆盖
 *
 * 环境变量（在 Cloudflare Dashboard 配置）：
 *   SYNC_URL     - https://your-domain.com/api/spotify/sync-tags
 *   SYNC_SECRET  - 与 SPOTIFY_SYNC_SECRET 相同的值
 */

const worker = {
  async scheduled(event, env, ctx) {
    console.log(`[tags-sync] cron 触发: ${event.cron}`)

    const response = await fetch(env.SYNC_URL, {
      method: 'POST',
      headers: {
        'x-spotify-sync-secret': env.SYNC_SECRET,
        'User-Agent': 'Cloudflare-Cron-Worker/tags-sync',
      },
    })

    if (response.ok) {
      const result = await response.json()
      console.log(`[tags-sync] 完成: updated=${result.tagsUpdated} pending=${result.pending} warnings=${result.warnings?.length ?? 0}`)
    } else {
      const text = await response.text()
      console.error(`[tags-sync] 失败 ${response.status}: ${text}`)
    }
  },

  // 手动触发：curl -X POST https://<worker-domain>/
  async fetch(request, env) {
    if (request.method !== 'POST') {
      return new Response('POST to trigger tag sync', { status: 405 })
    }

    const response = await fetch(env.SYNC_URL, {
      method: 'POST',
      headers: {
        'x-spotify-sync-secret': env.SYNC_SECRET,
        'User-Agent': 'Cloudflare-Cron-Worker/tags-sync',
      },
    })

    const result = await response.json()
    return new Response(JSON.stringify(result, null, 2), {
      status: response.status,
      headers: { 'Content-Type': 'application/json' },
    })
  },
}

export default worker
