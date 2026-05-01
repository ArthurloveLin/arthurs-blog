import type { Env } from './env'
import { syncSpotifyDashboardToArchive, readSpotifyTagCandidatesFromArchive, generateAndSaveStreamData } from './spotify'
import { syncSpotifyTrackTags } from './spotify-tags'

const textEncoder = new TextEncoder()

function logInfo(message: string, fields: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ level: 'info', message, ...fields }))
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

async function secretsMatch(provided: string | null, expected: string): Promise<boolean> {
  const [providedHash, expectedHash] = await Promise.all([
    crypto.subtle.digest('SHA-256', textEncoder.encode(provided ?? '')),
    crypto.subtle.digest('SHA-256', textEncoder.encode(expected)),
  ])

  return crypto.subtle.timingSafeEqual(providedHash, expectedHash)
}

const worker = {
  async scheduled(event: ScheduledEvent, env: Env) {
    // 根据触发器名称或时间判断模式
    const isFullSync = event.cron === "5 16 * * *"
    const mode = isFullSync ? "full" : "quick"
    
    logInfo('spotify sync started', { trigger: 'scheduled', mode, cron: event.cron })

    try {
      // 1. 同步 Spotify 数据
      const result = await syncSpotifyDashboardToArchive(env, { mode })
      logInfo('spotify sync completed', { trigger: 'scheduled', mode, summary: result.summary })

      // 2. 如果是 Full Sync，附带更新未打标签的歌曲 (限制数量以防超时)
      if (mode === 'full') {
        const { candidates } = await readSpotifyTagCandidatesFromArchive(env)
        if (candidates && candidates.length > 0) {
          const tagResult = await syncSpotifyTrackTags({
            env,
            tracks: candidates,
            maxTracks: 35
          })
          logInfo('spotify tag sync completed', {
            trigger: 'scheduled',
            mode,
            tagsUpdated: tagResult.tagsUpdated,
          })
        }
      }
      
      logInfo('spotify stream generation started', { trigger: 'scheduled', mode })
      await generateAndSaveStreamData(env)

      // 3. 通知 Vercel 刷新缓存
      if (env.NEXTJS_SITE_URL && env.SPOTIFY_SYNC_SECRET) {
        const revalidateUrl = `${env.NEXTJS_SITE_URL}/api/revalidate?secret=${env.SPOTIFY_SYNC_SECRET}`
        try {
          const res = await fetch(revalidateUrl)
          logInfo('spotify revalidate completed', {
            trigger: 'scheduled',
            mode,
            status: res.status,
          })
        } catch (e) {
          logError('spotify revalidate failed', e, { trigger: 'scheduled', mode })
        }
      }
    } catch (error) {
      logError('spotify scheduled sync failed', error, { mode, cron: event.cron })
    }
  },

  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url)
    const mode = url.searchParams.get('mode') === 'full' ? 'full' : 'quick'
    const syncSecret = request.headers.get('x-spotify-sync-secret') || url.searchParams.get('secret')

    if (env.SPOTIFY_SYNC_SECRET && !(await secretsMatch(syncSecret, env.SPOTIFY_SYNC_SECRET))) {
      logInfo('spotify manual sync forbidden', { mode, path: url.pathname })
      return new Response('Forbidden', { status: 403 })
    }

    try {
      logInfo('spotify sync started', { trigger: 'manual', mode, path: url.pathname })
      
      const result = await syncSpotifyDashboardToArchive(env, { mode })
      logInfo('spotify sync completed', { trigger: 'manual', mode, summary: result.summary })
      
      let tagsUpdated = 0
      if (mode === 'full') {
        const { candidates } = await readSpotifyTagCandidatesFromArchive(env)
        if (candidates && candidates.length > 0) {
          const tagResult = await syncSpotifyTrackTags({
            env,
            tracks: candidates,
            maxTracks: 35
          })
          tagsUpdated = tagResult.tagsUpdated
          logInfo('spotify tag sync completed', {
            trigger: 'manual',
            mode,
            tagsUpdated,
          })
        }
      }

      logInfo('spotify stream generation started', { trigger: 'manual', mode })
      await generateAndSaveStreamData(env)

      if (env.NEXTJS_SITE_URL && env.SPOTIFY_SYNC_SECRET) {
        const revalidateUrl = `${env.NEXTJS_SITE_URL}/api/revalidate?secret=${env.SPOTIFY_SYNC_SECRET}`
        ctx.waitUntil(
          fetch(revalidateUrl)
            .then((response) => {
              logInfo('spotify revalidate completed', {
                trigger: 'manual',
                mode,
                status: response.status,
              })
            })
            .catch((error) => {
              logError('spotify revalidate failed', error, { trigger: 'manual', mode })
            })
        )
      }

      return new Response(JSON.stringify({ 
        message: 'Sync successful', 
        result,
        tagsUpdated 
      }), {
        headers: { 'content-type': 'application/json' }
      })
    } catch (error: unknown) {
      logError('spotify manual sync failed', error, { mode, path: url.pathname })
      const message = error instanceof Error ? error.message : 'Unknown error'
      return new Response(JSON.stringify({ error: message }), { status: 500 })
    }
  }
}

export default worker
