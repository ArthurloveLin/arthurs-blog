# Spotify Track Tagging & Feature Classification Plan

## Context

当前 Spotify 模块（`lib/spotify.ts`）以 R2 JSON 文件为存储后端，记录了用户的播放历史、Top 榜单、Library 等数据，但每首曲目仅有 Spotify 原生字段（id、title、artists、album、popularity），缺少风格标签或维度化的音乐特征。本计划在 Full Sync 最后新增一个步骤，通过 Last.fm API 批量获取标签，并设计一套分类器将碎片化标签映射为 Spotify-like 多维特征，用于后续雷达图与词云展示。

---

## 目标文件

- **核心同步逻辑**：`lib/spotify.ts` → `syncSpotifyDashboardToArchive()`
- **类型定义**：`lib/spotify-types.ts`
- **新增工具库**：`lib/spotify-tags.ts`（Last.fm 调用 + 分类器）
- **新增 API 路由**：`app/api/spotify/tags/route.ts`
- **R2 存储文件**：
  - `spotify/tags/track-tags.json`（原始标签，供词云）
  - `spotify/tags/track-features.json`（分类后特征，供雷达图）

---

## Step 1：Last.fm 标签同步（Full Sync 第 5 步）

### 1.1 触发时机

仅在 `mode === 'full'` 时执行，附加在 `Promise.all(writePromises)` 之后作为独立的第 5 步，避免阻塞主写入流程。

### 1.2 曲目来源汇总

从本次 full sync 已归并的数据中提取所有唯一曲目，来源包括：

| 数据源 | 获取字段 |
|---|---|
| `liveDashboard.recentlyPlayed` | `track.id / title / artists[0]` |
| `liveDashboard.topTracks.{short/medium/long}_term` | `id / title / artists[0]` |
| `nextTracks.items` (saved tracks) | `track.id / title / artists[0]` |

按 `track.id` 去重，构建待处理集合。

### 1.3 增量检查（初次全量，后续增量）

从 R2 读取 `spotify/tags/track-tags.json`，已有 `tracks[trackId]` 的曲目跳过请求。

```typescript
// track-tags.json 结构
interface TrackTagStore {
  schemaVersion: 1
  lastUpdatedAt: string
  tracks: Record<string, TrackTagEntry>
}

interface TrackTagEntry {
  trackId: string
  artist: string        // 请求时使用的艺术家名（artists[0]）
  title: string
  fetchedAt: string
  tags: Array<{
    name: string        // 标签名，原始大小写
    count: number       // Last.fm 用户打标次数（来自 tag.count 字段）
  }>
}
```

### 1.4 Last.fm API 调用规范

**端点**：`track.getTopTags`

```
GET https://ws.audioscrobbler.com/2.0/
  ?method=track.getTopTags
  &artist={artist}
  &track={track}
  &autocorrect=1
  &api_key={LASTFM_API_KEY}
  &format=json
```

**环境变量**：`LASTFM_API_KEY`（需在 `.env.local` 及部署环境中配置）

**响应取用字段**：
```json
{
  "toptags": {
    "tag": [
      { "name": "pop", "count": "97" },
      { "name": "dance", "count": "88" }
    ]
  }
}
```
取 `tag[].name` 和 `tag[].count`（转为 number），保留所有返回标签（通常 ≤ 20 个）。

**速率控制**：Last.fm 限制 5 req/s（5分钟均值），使用 **100ms 间隔**串行处理，即约 10 req/s 峰值，安全边际充足。实现方式：每次请求后 `await sleep(100)`。

**错误处理**：
- HTTP 非 200 → 跳过该曲目，记录 warning，不中断整体流程
- `toptags.tag` 为空数组 → 存储空数组（标记为已查询，避免重复请求）
- 网络超时设置 5s

### 1.5 写入 R2

更新 `TrackTagStore` 后写回 `spotify/tags/track-tags.json`。将新增/更新条目数记录到同步 summary（新增 `tagsUpdated: number` 字段）。

---

## Step 2：分类器设计（模仿 Spotify Audio Features）

### 2.1 设计理念

Spotify 原生 Audio Features（energy、valence、danceability 等）通过音频分析获得，Last.fm 标签是用户众包打标，语义模糊但覆盖面广。分类器的目标是将数百种不同标签**规范化**到固定维度，以便在雷达图中统一展示。

### 2.2 维度定义

共 6 个维度，每个维度分值 0.0–1.0：

| 维度 | 含义 | 高分关键词示例 | 低分关键词示例 |
|---|---|---|---|
| **energy** | 能量感 | energetic, intense, loud, hard rock, metal, punk, uptempo | ambient, chill, soft, slow, lullaby, drone |
| **valence** | 情绪正向性 | happy, upbeat, feel-good, cheerful, fun, summer | sad, melancholy, dark, depressing, gloomy |
| **danceability** | 可跳舞性 | dance, danceable, club, edm, house, techno, disco | instrumental, classical, ambient, folk |
| **acousticness** | 原声感 | acoustic, folk, unplugged, singer-songwriter, live | electronic, synth, edm, industrial, digital |
| **instrumentalness** | 纯器乐性 | instrumental, classical, jazz instrumental, post-rock | vocal, r&b, hip-hop, rap, pop |
| **liveness** | 现场/真实感 | live, concert, recorded live, performance | studio, polished, produced |

### 2.3 分类算法

```
对每首曲目：
  对每个维度 D：
    score = 0, weight_sum = 0
    for each tag in track.tags (按 count 降序):
      if tag.name.lower() in HIGH_KEYWORDS[D]:
        score += tag.count * HIGH_WEIGHT
        weight_sum += tag.count
      elif tag.name.lower() in LOW_KEYWORDS[D]:
        score += tag.count * LOW_WEIGHT   // LOW_WEIGHT = 0
        weight_sum += tag.count
    if weight_sum == 0:
      D_score = 0.5  // 无信号时居中
    else:
      D_score = score / weight_sum        // 加权平均，结果 ∈ [0,1]
```

匹配支持**子串/前缀匹配**（如 `"indie rock"` 命中 `"rock"` 的关键词组）。关键词表定义为代码中的常量对象，便于后期扩充。

### 2.4 特征存储文件

```typescript
// spotify/tags/track-features.json
interface TrackFeatureStore {
  schemaVersion: 1
  lastUpdatedAt: string
  tracks: Record<string, TrackFeatureEntry>
}

interface TrackFeatureEntry {
  trackId: string
  classifiedAt: string
  features: {
    energy: number          // 0.0–1.0
    valence: number
    danceability: number
    acousticness: number
    instrumentalness: number
    liveness: number
  }
  topGenreTags: string[]    // 前5个最高 count 的标签名，供词云
}
```

### 2.5 分类触发时机

在标签获取完成、`track-tags.json` 写入后，立即对**本次新增或更新**的曲目重新运行分类器，写入 `track-features.json`。无需重新对已分类且标签未变的曲目运行。

---

## Step 3：API 路由

**`GET /api/spotify/tags`**

Query params：
- `type=tags`（默认）→ 返回 `track-tags.json` 供词云
- `type=features` → 返回 `track-features.json` 供雷达图
- `ids=id1,id2,...`（可选）→ 过滤特定曲目

Response：直接返回对应 store 对象，Cache-Control: max-age=3600。

---

## Step 4：环境变量

| 变量 | 说明 |
|---|---|
| `LASTFM_API_KEY` | Last.fm API Key（在 last.fm/api/account 申请，免费） |

---

## 数据流总览

```
Full Sync 触发
  ↓
Step 1-4（现有）：播放历史 / Library / 榜单 / Meta
  ↓
Step 5（新增）：
  读取 R2 track-tags.json
  → 汇总本次所有曲目
  → 过滤已有标签的曲目
  → 串行调用 Last.fm track.getTopTags（100ms 间隔）
  → 合并写入 track-tags.json
  → 对新增曲目运行分类器
  → 写入 track-features.json
```

---

## 验证方案

1. **本地测试**：配置 `LASTFM_API_KEY` 后调用 `POST /api/spotify/sync?mode=full`，检查 R2 中是否生成 `spotify/tags/track-tags.json`
2. **增量验证**：第二次 full sync 时，console 输出的 `tagsUpdated` 应为 0（无新曲目时）
3. **分类器单测**：在 `lib/spotify-tags.ts` 中导出 `classifyTrack(tags)` 纯函数，用已知标签组合人工验证分值合理性
4. **API 路由**：`GET /api/spotify/tags?type=features` 返回结构完整，字段值在 [0,1] 范围内

---

## 关键约束

- Last.fm 无批量接口，必须逐条请求
- 速率 5 req/s（5分钟均值），100ms 间隔可安全运行
- 标签数据存 R2，不入 Supabase（与现有架构一致）
- Full sync 新增步骤不阻塞现有 4 步的写入（顺序在 `await Promise.all(writePromises)` 之后）
- 原始标签（`track-tags.json`）完整保留，供词云使用；规范化特征（`track-features.json`）仅供雷达图