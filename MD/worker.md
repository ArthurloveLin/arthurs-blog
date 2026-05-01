# Spotify Worker 优化清单（2026-05-01）

## 已完成

- 任务 1：spotify-sync-worker 已新增公开 GET API，覆盖 `/api/now-playing`、`/api/spotify/history`、`/api/spotify/history/days`、`/api/spotify/history/stream`、`/api/spotify/library/tracks`、`/api/spotify/playlists/:id`、`/api/spotify/tags`、`/api/spotify/report`。
- 任务 2：定时/手动同步完成后会额外生成 `spotify/latest/report.json`，音乐报表不再在请求时重新聚合。
- 任务 3：前端 now-playing、Genius、history、tags、stream、playlist、saved tracks 已切换为“Worker 优先，本地 API 回退”。

## 上线前需要配置

- `NEXT_PUBLIC_SPOTIFY_WORKER_URL`：指向 spotify-sync-worker 的公开域名或 workers.dev 域名。
- `NEXT_PUBLIC_GENIUS_WORKER_URL`：指向 genius-worker 的公开域名或 workers.dev 域名。

## 兼容策略

- 如果未配置上述两个 `NEXT_PUBLIC_*` 变量，前端会继续回退到站内 `/api/*` 路由。
- Spotify 页面 SSR 和 `/api/spotify/report` 会优先读取 `spotify/latest/report.json`；如果该文件尚未生成，才会回退到旧的服务端聚合逻辑。

## 建议上线顺序

1. 先部署 spotify-sync-worker 与 genius-worker。
2. 再在 Vercel 配置 `NEXT_PUBLIC_SPOTIFY_WORKER_URL` 与 `NEXT_PUBLIC_GENIUS_WORKER_URL`。
3. 发布主站后验证 now-playing、歌词卡片、Spotify 时间轴、歌单展开和 Music Report 是否都已命中 Worker。

先收集两类证据：仓库里现有的 Worker/缓存路径，以及 Cloudflare Workers 当前最佳实践文档；这样可以把建议落到具体页面和现有实现上，而不是泛泛而谈。



Read [](file:///memories/repo)

Searched for files matching `wardrobe-picks` · `workers/**`, 39 matches

Searched for files matching `wardrobe-picks` · `**/*wrangler*.{json,jsonc,toml}`, 4 matches

Searched for regex `unstable_cache|revalidateTag|cache-control|Cache-Control|s-maxage|runtime = 'edge'|preferredRegion|Route Segment Config|fetch\(` (`wardrobe-picks` · `{app,components,lib,workers}/**`), 173 results

已提取 https://developers.cloudflare.com/workers/best-practices/workers-best-practices/

Read memory [](file:///home/arthur/.vscode-server/data/User/workspaceStorage/44dcb55bb624b9717e69fbc8c974068d/GitHub.copilot-chat/memory-tool/memories/repo/proxy-workers.md)

Read memory [](file:///home/arthur/.vscode-server/data/User/workspaceStorage/44dcb55bb624b9717e69fbc8c974068d/GitHub.copilot-chat/memory-tool/memories/repo/life-gallery.md)

现有仓库里已经有 4 个 Worker 项目，接下来我会对照站内实际数据路径看哪些请求还在走 Vercel，并区分“只需要前置缓存”与“适合直接迁到 Worker”的两类。

Searched for files matching `wardrobe-picks` · `node_modules/wrangler/config-schema.json`, no matches

Read [](file:///home/arthur/project/wardrobe-picks/next.config.ts)

Read [](file:///home/arthur/project/wardrobe-picks/workers/cloudflare-worker/src/index.ts)

Read [](file:///home/arthur/project/wardrobe-picks/workers/genius-worker/src/index.ts)

Read [](file:///home/arthur/project/wardrobe-picks/workers/wardrobe-supabase-worker/src/index.ts)

Read [](file:///home/arthur/project/wardrobe-picks/workers/spotify-image-proxy/src/index.ts)

Read [](file:///home/arthur/project/wardrobe-picks/app/api/spotify/report/route.ts)

Read [](file:///home/arthur/project/wardrobe-picks/app/api/genius/route.ts)

已经定位到一个明显模式：很多 Spotify/洞察类能力虽然有 Next 的 CDN 头，但实际计算仍在 Vercel 上执行；我现在继续读这些实现，区分“只是缓存头”与“真正预计算/边缘缓存”这两种情况。

Searched for regex `export const dynamic = 'force-dynamic'|cache: 'no-store'|revalidate = 0|no-store` (`wardrobe-picks` · `{app,components,lib}/**`), 30 results

Read [](file:///home/arthur/project/wardrobe-picks/lib/spotify-report.ts)

Read [](file:///home/arthur/project/wardrobe-picks/lib/spotify.ts#1120-1120), lines 1120 to 1260

Read [](file:///home/arthur/project/wardrobe-picks/lib/now-watching.ts)

Read [](file:///home/arthur/project/wardrobe-picks/app/api/analytics/overview/route.ts)

Read [](file:///home/arthur/project/wardrobe-picks/app/api/analytics/post/route.ts)

Read [](file:///home/arthur/project/wardrobe-picks/app/api/life-gallery/round/route.ts)

Read [](file:///home/arthur/project/wardrobe-picks/app/api/now-watching/posters/route.ts)

目前最像“还能省掉 Vercel 计算”的有三块：Spotify 报表/历史、Umami analytics 聚合、Life Gallery 的随机轮播。下一步我看这些页面的调用方式，确认它们是在 SSR 时打到 Vercel，还是客户端自己拉 API。

Searched for files matching `wardrobe-picks` · `app/spotify/**`, 1 match

Read [](file:///home/arthur/project/wardrobe-picks/lib/life-gallery.ts)

Read [](file:///home/arthur/project/wardrobe-picks/lib/umami.ts)

Read [](file:///home/arthur/project/wardrobe-picks/components/SpotifyProvider.tsx)

Read [](file:///home/arthur/project/wardrobe-picks/app/life-gallery/page.tsx)

Read [](file:///home/arthur/project/wardrobe-picks/app/now-watching/page.tsx)

Read [](file:///home/arthur/project/wardrobe-picks/components/AnalyticsDashboard.tsx)

Read [](file:///home/arthur/project/wardrobe-picks/components/ArticleMetaStats.tsx)

Spotify 区域很可能是最大头，因为它同时有定时同步、R2 快照、再加工报表、客户端轮询几层。下面我把页面和 API 路径串起来，找还能再往边缘前移多少。

Read [](file:///home/arthur/project/wardrobe-picks/app/spotify/page.tsx)

Read [](file:///home/arthur/project/wardrobe-picks/app/api/spotify/history/route.ts)

Read [](file:///home/arthur/project/wardrobe-picks/app/api/spotify/history/days/route.ts)

Read [](file:///home/arthur/project/wardrobe-picks/app/api/spotify/history/stream/route.ts)

Read [](file:///home/arthur/project/wardrobe-picks/app/api/spotify/playlists/%5Bid%5D/route.ts)

Read [](file:///home/arthur/project/wardrobe-picks/app/api/spotify/library/tracks/route.ts)

Read [](file:///home/arthur/project/wardrobe-picks/app/api/spotify/tags/route.ts)

Read [](file:///home/arthur/project/wardrobe-picks/app/api/now-playing/route.ts)

Spotify API 路由基本都标了 force-dynamic，所以即便底层读的是 R2 快照，首个 miss 仍然要进 Vercel 函数。我要再看其中哪些其实已经完全脱离 DB/私密态，理论上可以直接由 Worker 读 R2/KV 返回。

Read [](file:///home/arthur/project/wardrobe-picks/lib/spotify.ts#240-240), lines 240 to 380

Read [](file:///home/arthur/project/wardrobe-picks/lib/spotify.ts#980-980), lines 980 to 1125

Read [](file:///home/arthur/project/wardrobe-picks/workers/spotify-image-proxy/wrangler.jsonc)

Read [](file:///home/arthur/project/wardrobe-picks/lib/spotify-tags.ts#1-1), lines 1 to 240

Read [](file:///home/arthur/project/wardrobe-picks/workers/cloudflare-worker/wrangler.toml)

Read [](file:///home/arthur/project/wardrobe-picks/workers/cloudflare-worker/src/spotify.ts#1-1), lines 1 to 420

Read [](file:///home/arthur/project/wardrobe-picks/workers/wardrobe-supabase-worker/wrangler.jsonc)

Read [](file:///home/arthur/project/wardrobe-picks/workers/genius-worker/wrangler.toml)

还有一个关键判断点：Vercel 现在读 R2 到底是直接公共 URL，还是经 S3 API/代理。如果是后者，迁到 Worker 的收益会更大，因为 Cloudflare 侧可以直接走 R2 binding，不再绕公网。

Read [](file:///home/arthur/project/wardrobe-picks/lib/r2.ts)

Read [](file:///home/arthur/project/wardrobe-picks/app/api/blog/search/route.ts)

Read [](file:///home/arthur/project/wardrobe-picks/lib/blog.ts#1-1), lines 1 to 460

Read [](file:///home/arthur/project/wardrobe-picks/app/api/life-gallery/image/%5B...key%5D/route.ts)

Read [](file:///home/arthur/project/wardrobe-picks/app/api/admin/upload-image/route.ts)

Read [](file:///home/arthur/project/wardrobe-picks/lib/item-ocr.ts#1-1), lines 1 to 360

Read [](file:///home/arthur/project/wardrobe-picks/README.md)

已经看到一个很具体的优化点：现有定时 Worker 负责生成 stream.json，但 music report 还是在 Vercel 端按请求现算。接下来我确认它的消费面，判断值不值得直接在同步时预产出成静态 JSON。

Searched for regex `buildMusicReport|/api/spotify/report|/api/spotify/history|/api/spotify/tags|/api/spotify/library/tracks|/api/spotify/playlists/|/api/now-watching/posters|/api/life-gallery/round|/api/analytics/overview|/api/analytics/post` (`wardrobe-picks` · `{app,components,lib}/**`), 15 results

Read [](file:///home/arthur/project/wardrobe-picks/components/now-watching/NowWatchingProvider.tsx)

Read [](file:///home/arthur/project/wardrobe-picks/components/life-gallery/LifeGallerySlider.tsx#380-380), lines 380 to 500

Read [](file:///home/arthur/project/wardrobe-picks/workers/genius-worker/src/cache.ts)

Read [](file:///home/arthur/project/wardrobe-picks/components/spotify/SpotifyDashboard.tsx)

Spotify 页面本身 SSR 用的是离线快照，但交互层还会继续命中一批 Vercel API。我再看最重的客户端请求，判断是否适合直接换成 Worker/R2 静态文件。

Read [](file:///home/arthur/project/wardrobe-picks/components/spotify/SpotifyGeniusLiveCard.tsx#1-1), lines 1 to 260

Read [](file:///home/arthur/project/wardrobe-picks/workers/spotify-image-proxy/src/index.ts)

Read [](file:///home/arthur/project/wardrobe-picks/components/spotify/SpotifyRecentlyPlayedDeck.tsx#1-1), lines 1 to 760

Read [](file:///home/arthur/project/wardrobe-picks/components/spotify/SpotifySavedTracksPanel.tsx)

Read [](file:///home/arthur/project/wardrobe-picks/components/spotify/SpotifyPlaylistDetail.tsx)

Read [](file:///home/arthur/project/wardrobe-picks/components/spotify/SpotifyTagStreamChart.tsx#1-1), lines 1 to 220

Genius 已经有 KV Worker，但前端是否还在经 Vercel 中转，决定了你是否还在为“缓存命中”支付 Vercel 函数。这个链路我再补一跳。

Read [](file:///home/arthur/project/wardrobe-picks/app/api/spotify/playlists/%5Bid%5D/route.ts)

Read [](file:///home/arthur/project/wardrobe-picks/hooks/useGeniusData.ts)

Read [](file:///home/arthur/project/wardrobe-picks/lib/spotify-img.ts)

Read [](file:///home/arthur/project/wardrobe-picks/components/spotify/useSpotifyCollectionPagination.ts)

Read [](file:///home/arthur/project/wardrobe-picks/app/api/comments/route.ts)

为了让 Worker 侧建议符合当前 Cloudflare 运行时，我补一轮官方类型和 Wrangler schema 的检索；这一步主要是确认现有缓存、绑定、路由建议没有踩过时配置。

Ran terminal command:  cd /home/arthur/project/wardrobe-picks && mkdir -p /tmp/workers-types-latest && npm pack @cloudflare/workers-types --pack-destination /tmp/workers-types-latest >/tmp/workers-types-latest/pack.log && tar -xzf /tmp/workers-types-latest/cloudflare-workers-types-*.tgz -C /tmp/workers-types-latest && find . -path '*/node_modules/wrangler/config-schema.json' | head -n 5 && echo '---' && ls /tmp/workers-types-latest/package && echo '---' && sed -n '1,80p' /tmp/workers-types-latest/package/index.d.ts

站点级轮询也值得看一眼。如果 Spotify live 状态是全站挂载并且每 30 秒轮询一次，那它比单页报表更容易积累成持续的 Vercel 函数成本。

Searched for text `SpotifyProvider|AnalyticsDashboard|ArticleMetaStats|NowWatchingProvider|LifeGallerySlider` (`wardrobe-picks` · `{app,components}/**`), 39 results

Read [](file:///home/arthur/project/wardrobe-picks/lib/blog.ts#460-460), lines 460 to 514

Read [](file:///home/arthur/project/wardrobe-picks/app/api/spotify/history/stream/route.ts)

Read [](file:///home/arthur/project/wardrobe-picks/app/api/now-playing/route.ts)

Read [](file:///home/arthur/project/wardrobe-picks/app/layout.tsx)

Read [](file:///home/arthur/project/wardrobe-picks/app/page.tsx)

Read [](file:///home/arthur/project/wardrobe-picks/components/Navbar.tsx#1-1), lines 1 to 240

还有一个非 Worker 但会放大 Worker收益的事实：代码里看起来可能有多个独立的 now-playing 轮询上下文。我确认一下是否在同一页面上重复轮询同一个接口。

Read [](file:///home/arthur/project/wardrobe-picks/components/spotify/SpotifyLivePlayerPanel.tsx)

Read [](file:///home/arthur/project/wardrobe-picks/components/ToolsCard.tsx#120-120), lines 120 to 204

Read [](file:///home/arthur/project/wardrobe-picks/components/SpotifyNowPlaying.tsx#1-1), lines 1 to 220

Read [](file:///home/arthur/project/wardrobe-picks/lib/spotify.ts#380-380), lines 380 to 520

确认了，同一页面上确实有独立的 now-playing Provider。最后我只差把 now-playing 的服务端实现补全，就可以给你一个按收益排序的 Worker 优化清单。

Searched for text `getSpotifyNowPlayingData|SPOTIFY_PLAYER_ENDPOINT|CONTEXT_LABEL_CACHE` (`wardrobe-picks` · `lib/spotify.ts`), 7 results

Read [](file:///home/arthur/project/wardrobe-picks/lib/spotify.ts#520-520), lines 520 to 760

Read [](file:///home/arthur/project/wardrobe-picks/components/spotify/SpotifyGeniusLiveCard.tsx#440-440), lines 440 to 459

Read [](file:///home/arthur/project/wardrobe-picks/components/ToolsCard.tsx#1-1), lines 1 to 140

除了公开读取接口，我也在看少量“重计算但不要求同步返回”的后台动作，比如 OCR 这种。若已经在 Vercel 请求路径里执行，Queue/Worker 化的节省会比单纯缓存更明显。

Searched for regex `processWardrobeItemOcr|item-ocr|BAIDU_OCR|ocr_status` (`wardrobe-picks` · `{app,components,lib}/**`), 14 results

Read [](file:///home/arthur/project/wardrobe-picks/app/api/admin/upload-image/route.ts)

Read [](file:///home/arthur/project/wardrobe-picks/app/api/items/route.ts)

Read [](file:///home/arthur/project/wardrobe-picks/app/api/items/%5Bid%5D/route.ts)

Read [](file:///home/arthur/project/wardrobe-picks/app/api/items/reorder/route.ts)

范围已经够了，我现在把发现收束成结论：哪些最值得马上搬到 Worker，哪些只是中收益，哪些不建议碰。然后给你一个按节省 Vercel 计算排序的清单。

已创建 3 个待办事项

**结论**
对照 Cloudflare 官方 Workers best practices（2026-04-23 更新）和最新 workers types 4.20260501.1，再看你现有的 4 个 Worker 配置 wrangler.toml, wrangler.toml, wrangler.jsonc, wrangler.jsonc，基线已经是对的。现在最值得继续省 Vercel 计算的，不是再调 Wrangler 细节，而是把仍在 Vercel 上执行的公开读接口、短 TTL 轮询和后台重计算，继续前移到 Cloudflare 边缘。这次我只做了调查，没有改代码。

**高优先级**
1. Spotify now-playing 和 Genius 这条实时链路最该先搬。轮询入口在 SpotifyProvider.tsx, ToolsCard.tsx, SpotifyLivePlayerPanel.tsx, SpotifyGeniusLiveCard.tsx，服务端仍落在 route.ts, route.ts 和 spotify.ts。其中 Genius 的重活其实已经在 index.ts 加 KV 里做完了，所以最直接的降本方式是让前端直接命中 Worker 自定义域名，或用 Cloudflare route 接管这条 API；now-playing 则适合放到 Worker 上做 15 到 30 秒的 edge cache，这样持续轮询不再触发 Vercel 函数。
2. Spotify 历史、标签、歌单、收藏这组只读 API 很适合整体迁到现有同步 Worker。客户端读取点在 SpotifyRecentlyPlayedDeck.tsx, SpotifySavedTracksPanel.tsx, SpotifyPlaylistDetail.tsx, SpotifyTagStreamChart.tsx；对应 API 在 route.ts, route.ts, route.ts, route.ts, [app/api/spotify/playlists/[id]/route.ts](app/api/spotify/playlists/[id]/route.ts), route.ts。这些接口本质上都只是从 R2 快照读 JSON，但现在 Vercel 侧还是通过 r2.ts 的 S3 SDK 去读 R2；把它们挂到 spotify.ts 同一个 Worker 上，用 R2 binding 直接读，收益很实。
3. Spotify music report 也能继续前移，但我会排在上一组之后。现在报表是在 spotify-report.ts 里按请求聚合多份日分片，调用点在 page.tsx 和 route.ts；而现有同步 Worker 已经会生成 dashboard.json 和 stream.json，入口在 index.ts。更合理的做法不是把这段聚合原样搬到 Worker，而是让同步任务顺手产出 report.json，前台只读静态结果。
4. Life Gallery 是另一个明显的 Vercel 热点，因为页面和下一轮数据都明确禁用了缓存。服务端入口在 page.tsx 和 route.ts，随机轮次生成在 life-gallery.ts，客户端还会在 LifeGallerySlider.tsx 里继续拉下一轮。这个场景很适合做成“静态页面壳 + Worker 生成轮次 JSON”，或者由 Worker 和 KV 预生成一批轮次，页面只消费边缘缓存结果。
5. Umami analytics 聚合值得用 Worker 做缓存层，尤其是 overview。当前 overview 会登录 Umami 并发 3 个上游请求，实现在 route.ts 和 umami.ts，消费方在 AnalyticsDashboard.tsx；文章浏览量接口在 route.ts，消费方在 ArticleMetaStats.tsx。这组接口很适合搬到 Worker 做 edge cache 或 KV materialization，尤其是文章浏览量这种按 path 聚合、变化不快的数据。
6. Now Watching 的分页读取是中等收益项。服务端读取在 route.ts 和 now-watching.ts，消费在 NowWatchingProvider.tsx。它同样只是 R2 metadata 的公开读取，适合和 Life Gallery 一起并入一个公共内容 Worker。

**次优先级**
- 衣橱 OCR 是“计算优化”而不是“缓存优化”候选。现在上传后会在 route.ts 里通过 after 继续跑 item-ocr.ts 的百度 OCR；这部分更适合改成 Queue 或 consumer Worker，优势是把重计算和重试从 Vercel 背景执行里拿出来，但它是后台低频 admin 流量，优先级低于上面的公开读接口。
- Blog 搜索也可以做 Worker 缓存，但我不建议先动。实现是 route.ts 调 blog.ts 的 Supabase RPC；因为查询基数高、收益不如 Spotify 和 Analytics 直观。
- 如果你想继续往下压 Vercel 请求量，最后才考虑对 next.config.ts 里这些公开页面做匿名 HTML cache Worker。这个方向能继续降源站流量，但缓存失效复杂度明显更高，不如先把 JSON 和轮询流量搬走。

**不建议先动**
- 评论、note board、session 管理、衣橱增删改这类接口不适合先用 Worker 做缓存。它们要么强依赖 Supabase 写入，要么带身份和个体状态，像 route.ts 这一类即使迁到 Worker，也不会像公开只读接口那样明显降低 Vercel 账单。

如果你只想先做 3 件最值的事，我建议按这个顺序：
1. 把 now-playing 和 genius 从 Vercel API 前门移走，直接挂到 Worker route 或自定义域名。
2. 扩展现有 spotify-sync-worker，让 Spotify history、tags、library、playlists、report 都直接从 Worker 读 R2 binding。
3. 把 Life Gallery 改成静态页面壳，随机轮次完全交给 Worker 和 KV。

如果你要，我下一步可以直接帮你把这份调查落成一个实施方案，按“最小改动版”和“彻底搬迁版”各出一套。