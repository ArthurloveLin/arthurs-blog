# genius-worker

Genius 歌词代理 worker。负责搜索歌曲、抓取歌词页面、获取注释，并将结果缓存到 KV。

## File Map

```
src/index.ts    — 主路由：KV 命中检查 → search → scrape，KV 写入异步触发
src/search.ts   — Genius API 搜索，处理多艺人格式，三级模糊匹配
src/scraper.ts  — HTML 抓取：JSON 提取、歌词清理、annotations 获取
src/http.ts     — fetchWithRetry：超时 + 重试 + Retry-After 支持
src/cache.ts    — KV 读写，90 天 TTL，key 构建逻辑
src/types.ts    — GeniusSongData、GeniusAnnotation 类型
src/env.ts      — Cloudflare.Env 扩展类型
src/log.ts      — JSON 结构化日志工具
```

## 路由

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/genius?title=&artist=&trackId=` | 主查询路径 |
| GET | `/?title=&artist=&trackId=` | 旧版兼容路径（保留） |
| GET | `/health` 或 `/` | 健康检查 |

必填参数：`title` + `artist`。`trackId` 可选，用于构建更精确的 KV key。

## 执行流程

```
请求到达
  ↓
KV 命中？→ 直接返回（Cache-Control: max-age=86400, swr=604800）
  ↓ 未命中
searchGenius(title, artist)   → Genius Search API
  ↓ 返回 {url, id}
scrapeSongPage(url, id)
  ├─ fetchReferents(songId)   → Genius Referents API（注释，最多 15 条）
  └─ fetchInternalLyrics(songId) → Genius 内部 /api/songs/:id/lyrics
  ↓
ctx.waitUntil(writeToCache(kv, key, songData))  ← 非阻塞写 KV
  ↓
返回 { cached: false, data: songData }
```

## 关键非显然模式

### scraper.ts — Genius 的非标 JSON 嵌入
Genius 页面将 preloaded state 序列化为 `JSON.parse('...')` 形式嵌入 HTML，内部字符串用 JS 转义（`\'` `\"` `\\`）而非标准 JSON 转义。`extractData()` 做了两步处理：
1. 自定义单遍 unescape：`\'→'`，`\"→"`，`\\→\`
2. 若 `JSON.parse` 报 "at position N" 错误（Genius 有时在 JSON 后追加裸 JS），截断到位置 N 重试

不能用 `JSON.parse` 直接解析原始字符串，也不能用 `eval`。

### search.ts — 多艺人格式处理
Spotify 艺人字段常为 `"Artist A, Artist B"` 或含 `feat.`，Genius 只存主唱。`searchGenius` 先按 `,&/feat.` 分割取 `primaryArtist`，再用三级模糊匹配：
1. `resultArtist.includes(primaryArtistNorm)` — 结果包含主唱
2. `primaryArtistNorm.includes(resultArtist)` — 主唱包含结果
3. `artistNorm.includes(resultArtist)` — 完整艺人串包含结果

匹配时去掉非字母数字汉字字符再比较，避免标点差异。

### scraper.ts — 歌词清理的顺序依赖
`cleanLyrics` 的五步清理**顺序不可互换**：
1. HTML entity decode（先做，后续步骤依赖纯文本）
2. `Read More` 前缀截断
3. `Contributors / Translations` 正则（依赖纯文本，不能在 entity decode 前做）
4. metadata 前缀检测（依赖 `[` 位置，需在 Contributors 清理后做）
5. `[Verse]` 标签换行规范化
6. 连续空行压缩

### http.ts — fetchWithRetry
- 超时：15s，每次 retry 独立重置
- 重试触发状态码：408, 429, 500, 502, 503, 504
- 延迟：优先读 `Retry-After` header；无则指数退避 `300ms × 2^attempt`，上限 2s
- 最多 2 次 retry（共 3 次请求）

### cache.ts — KV key 策略
- 有 `trackId`：`song:{trackId}`（Spotify ID，稳定）
- 无 `trackId`：`song:{artist_lower}:{title_lower}`（可能因格式差异 miss）
- TTL 90 天；KV 写入通过 `ctx.waitUntil` 异步，不影响响应延迟

## 硬约束

- KV 写入必须在 `ctx.waitUntil` 中，不能 `await`——Cloudflare Worker 在响应发出后即可销毁上下文，裸 `await writeToCache` 有丢失风险。
- `fetchInternalLyrics` 失败时静默返回 `null`，不抛出——歌词缺失不能阻断整个响应。
- `fetchReferents` 失败同样静默返回 `[]`。
- 注释正文超过 20 字才收录（过滤纯标点或极短注释），正文截断至 2000 字。

## Env Vars

| Var | 说明 |
|---|---|
| `GENIUS_API_TOKEN` | Genius OAuth token，用于 Search API 和 Referents API |
| `GENIUS_CACHE` | KV Namespace binding |
