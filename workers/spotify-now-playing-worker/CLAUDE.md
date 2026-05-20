# spotify-now-playing-worker

轻量级 Spotify 正在播放代理。独立于 `cloudflare-worker`，专注单一职责：低延迟获取当前播放状态 + 最近播放记录。

## File Map

```
src/index.ts            — 路由 + respondFromEdgeCache（含 no-cache 绕过逻辑）
src/spotify.ts          — token 获取（内存缓存）+ 当前播放 + R2 最近播放读取
src/now-playing-cache.ts — Cache-Control 策略（播放状态感知动态 TTL）
src/r2.ts               — R2 读取 helper
src/spotify-types.ts    — SpotifyNowPlayingData 等共享类型
src/env.ts              — Cloudflare.Env 扩展
```

## 路由

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/now-playing` | 正在播放状态 |
| GET | `/` | 同上（别名） |

## 执行流程

```
请求到达
  ↓ 检查 Cache-Control / Pragma / ?refresh 参数
缓存命中？→ 直接返回
  ↓ 未命中 / 强制刷新
getSpotifyAccessToken(env)   ← 内存 tokenCache，55min TTL
  ↓ 并行
  ├─ getCurrentPlayback(token)    → Spotify /v1/me/player
  └─ readStoredRecentTracks(env)  → R2 spotify/latest/dashboard.json
  ↓
组合 SpotifyNowPlayingData
  ↓
写入 CF edge cache（ctx.waitUntil）
  ↓
返回 + Cache-Control（播放状态感知）
```

## 关键非显然模式

### 内存级 token 缓存（`tokenCache`）
`src/spotify.ts` 顶层声明 `let tokenCache: { token: string; expiresAt: number } | null = null`。这是模块级变量，在 worker isolate 存活期间复用。TTL 设为 55 分钟（Spotify token 有效期 60 分钟，提前 5 分钟过期防止边界失效）。

**陷阱**：worker isolate 在闲置后会被销毁，下次冷启动时 `tokenCache` 为 null，必须重新走 token refresh。这是正常行为，不需要持久化 token——每次冷启动最多多一次 token 请求。

### Cache-Control 动态策略（`now-playing-cache.ts`）
不同播放状态使用不同 TTL，目的是在歌曲快结束时避免展示"已过期"状态：

| 状态 | s-maxage | stale-while-revalidate |
|---|---|---|
| 未播放 / isPlaying=false | 5s | 5s |
| 正在播放（距结束 > 12s） | 15s | 5s |
| 正在播放（距结束 ≤ 12s） | `ceil(remaining/1000)s`（最短 1s） | **0**（禁止 SWR） |
| 请求出错 | 10s | 0 |

"近结束窗口"禁用 SWR 是故意的：SWR 允许后台刷新时继续用旧缓存，但歌曲结束后旧缓存会显示错误的"正在播放"状态。

### 强制刷新绕过 edge cache
`respondFromEdgeCache` 检测以下任一条件跳过缓存：
- `Cache-Control: no-cache / no-store / max-age=0`
- `Pragma: no-cache`
- URL 含 `?refresh` 参数

Cache key 规范化时移除 `refresh` 和 `t` 参数，避免缓存碎片化。

### R2 最近播放来源
最近播放数据从 R2 `spotify/latest/dashboard.json` 读取，该文件由 **`cloudflare-worker`** 同步任务写入。如果 cloudflare-worker 尚未运行过，此文件不存在，`readStoredRecentTracks` 会静默返回 `[]`（`isMissingR2ObjectError` 检测 `NoSuchKey` 错误）。

### Spotify 204 响应处理
Spotify `/v1/me/player` 在没有活跃播放时返回 204 No Content。`requestSpotify` 的 `allowNoContent=true` 参数将 204 转换为 `null`，上层再判断是否展示最近播放。

## 硬约束

- 此 worker 只读 R2，不写 R2。R2 数据由 `cloudflare-worker` 维护——不要在此 worker 里添加任何 R2 写操作。
- `tokenCache` 不能改为持久化存储（KV/R2）——token 不应落地，且内存缓存对单 isolate 已足够高效。
- 错误时返回 `{ isPlaying: false }` 而非错误状态码——前端依赖此 fallback 形状，不能改为 4xx/5xx。

## Env Vars

| Var | 说明 |
|---|---|
| `SPOTIFY_CLIENT_ID` | Spotify OAuth Client ID |
| `SPOTIFY_CLIENT_SECRET` | Spotify OAuth Client Secret |
| `SPOTIFY_REFRESH_TOKEN` | Spotify Refresh Token |
| `SPOTIFY_BUCKET` | R2 bucket binding，用于读取 `spotify/latest/dashboard.json` |
