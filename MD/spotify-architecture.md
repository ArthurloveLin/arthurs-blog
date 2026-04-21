# Spotify 数据同步与存储架构最佳实践

针对当前 Spotify 模块同步逻辑存在的数据流碎片化、合并逻辑不一致等问题，梳理出如下架构优化方案，作为后续重构的指导方案。

## 1. 核心架构模式：SSOT (单点真理) 与 View Snapshot (视图快照)

目前的碎片化源于“同步逻辑”同时承担了“数据抓取”、“历史归档”和“前端展示封装”三项任务。建议将其解耦：

- **Ground Truth (原始数据层)**：R2 中的 `collection/*.json` (全量列表) 和 `history/*.json` (分片记录)。这是数据的最终归宿。
- **View Snapshot (视图快照层)**：`latest/dashboard.json`。它仅仅是 Ground Truth 的一个**只读副本/切面**，用于前端极速读取。
- **Sync Logic (同步流)**：负责抓取增量 -> 更新 Ground Truth -> **重新生成** View Snapshot。

---

## 2. 统一的数据合并策略 (Merge Strategy)

目前有的板块在 API 调用前加载旧数据，有的在调用后。应统一为以下流程：

### 模式 A：增量合并 (Incremental Merge)
适用于：已点赞歌曲、收藏专辑、关注歌手。
1.  **Load History**: 从 R2 读取当前的全量列表。
2.  **Fetch Delta**: 从 API 抓取最近的 N 条记录。
3.  **Merge & De-duplicate**: 使用统一的 `mergeByKey` 逻辑合并。
4.  **Save**: 回写 R2。

### 模式 B：快照保持 (State Preservation)
适用于：排行榜 (Top Tracks/Artists)。
1.  **Fetch (Full Mode Only)**: 仅在全量同步时调用 API。
2.  **Restore (Quick Mode)**: 如果跳过 API，则从上一个 Snapshot 中“继承”数据。
3.  **Snapshot**: 记录本次同步的时间点快照。

---

## 3. 同步流的模块化重构建议

目前的 `syncSpotifyDashboardToArchive` 过于臃肿。建议将其拆分为 **Sync Tasks**：

```typescript
interface SyncTask<T> {
  name: string;
  fetch: (ctx: SyncContext) => Promise<T>;
  merge: (existing: T, incoming: T) => T;
  persist: (data: T) => Promise<void>;
}

// 伪代码示例
const tasks = [
  new SavedTracksTask(),
  new TopRankingsTask(),
  new RecentlyPlayedTask()
];

for (const task of tasks) {
  if (shouldRun(task, mode)) {
    const incoming = await task.fetch(ctx);
    const existing = await loadFromR2(task.name);
    const next = task.merge(existing, incoming);
    await task.persist(next);
  }
}
```

---

## 4. 关键改进点

### 1. 消除“空值抹除”风险
View Snapshot (`dashboard.json`) 的构建应始终遵循：**“如果本次没抓到，就用上一次保存的”**。

### 2. 回退机制 (Fallback Logic)
在 `readR2JsonIfExists` 失败或 R2 连接异常时，应有明确的 Fallback 处理（如返回空结构体而非直接 crash），并记录 Warning。

### 3. 类型安全
目前 `SpotifyDashboardData` 同时用于 API 返回和归档存储，存在字段对不上的隐患。应区分 `SpotifyApiPayload` 和 `SpotifyStoredSnapshot` 类型。

### 4. 歌单拆分 (Sharding)
继续维持目前的 Sharding 策略：
- `dashboard.json` 只存歌单的元数据（标题、封面）。
- 具体的 `tracks` 存储在 `collection/playlists/{id}.json`。
- 只有在真正需要时才通过 `readSpotifyPlaylistShard` 加载。

---

## 5. 明日重构重点

1.  **重构 `readSpotifyRankings` 和 `readLatestSpotifyDashboard` 的调用时机**。
2.  **建立 `SyncResultBuilder` 类**，统一管理同步期间的 `warnings`、`summary` 和最终生成的 Snapshot。
3.  **模块化抓取逻辑**，将每个板块（Library、Top、History）拆分为独立的子函数。
