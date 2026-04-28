import { Env } from './env'
import { setEnv, syncSpotifyDashboardToArchive, readSpotifyTagCandidatesFromArchive } from './spotify'
import { setTagsEnv, syncSpotifyTrackTags } from './spotify-tags'

const worker = {
  async scheduled(event: ScheduledEvent, env: Env) {
    // 设置全局 env
    setEnv(env)
    setTagsEnv(env)

    // 根据触发器名称或时间判断模式
    const isFullSync = event.cron === "5 16 * * *"
    const mode = isFullSync ? "full" : "quick"
    
    console.log(`Starting Spotify [${mode.toUpperCase()}] sync...`)

    try {
      // 1. 同步 Spotify 数据
      const result = await syncSpotifyDashboardToArchive({ mode })
      console.log(`[${mode}] Spotify Sync complete:`, result.summary)

      // 2. 如果是 Full Sync，附带更新未打标签的歌曲 (限制数量以防超时)
      if (mode === 'full') {
        const { candidates } = await readSpotifyTagCandidatesFromArchive()
        if (candidates && candidates.length > 0) {
          const tagResult = await syncSpotifyTrackTags({
            tracks: candidates,
            maxTracks: 35
          })
          console.log(`Tag Sync complete. Updated ${tagResult.tagsUpdated} tags.`)
        }
      }
    } catch (error) {
      console.error('Scheduled sync failed:', error)
    }
  },

  async fetch(request: Request, env: Env) {
    const url = new URL(request.url)
    const mode = url.searchParams.get('mode') === 'full' ? 'full' : 'quick'
    const syncSecret = request.headers.get('x-spotify-sync-secret') || url.searchParams.get('secret')

    if (env.SPOTIFY_SYNC_SECRET && syncSecret !== env.SPOTIFY_SYNC_SECRET) {
      return new Response('Forbidden', { status: 403 })
    }

    setEnv(env)
    setTagsEnv(env)

    try {
      console.log(`Manual trigger: [${mode}] sync`)
      
      const result = await syncSpotifyDashboardToArchive({ mode })
      
      let tagsUpdated = 0
      if (mode === 'full') {
        const { candidates } = await readSpotifyTagCandidatesFromArchive()
        if (candidates && candidates.length > 0) {
          const tagResult = await syncSpotifyTrackTags({
            tracks: candidates,
            maxTracks: 35
          })
          tagsUpdated = tagResult.tagsUpdated
        }
      }

      return new Response(JSON.stringify({ 
        message: 'Sync successful', 
        result,
        tagsUpdated 
      }), {
        headers: { 'content-type': 'application/json' }
      })
    } catch (error: unknown) {
      console.error('Manual sync failed:', error)
      const message = error instanceof Error ? error.message : 'Unknown error'
      return new Response(JSON.stringify({ error: message }), { status: 500 })
    }
  }
}

export default worker
