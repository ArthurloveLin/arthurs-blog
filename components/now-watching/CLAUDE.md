# Now Watching 模块

电影/剧集观影记录。三列瀑布流 + 桌面端 GSAP 视差 + 前置预加载无限滚动。

## File Map

```
NowWatchingProvider.tsx    — 状态管理：列分配、预加载、loadMore 逻辑
NowWatchingColumns.tsx     — 渲染层：列布局 + GSAP 视差 + IntersectionObserver 触底
NowWatchingColumns.module.css — col-scroll__box / col-scroll__list 等布局类
lib/now-watching.ts        — 服务端 R2 读取，NowWatchingPoster 类型
app/api/now-watching/posters/route.ts — 分页 API（?page=&perPage=）
```

## 数据流

```
app/now-watching/page.tsx（服务端）
  → 拉取第 1 页 posters
  → <NowWatchingProvider initialPosters initialPage hasMore>
      → distributeToColumns()  ← round-robin 分配，按索引取模
      → 立即预取第 2 页
      → <NowWatchingColumns>   ← 消费 context，挂载 GSAP + IntersectionObserver
```

## 关键非显然模式

### 列分配算法
`distributeToColumns(posters, columnCount)` 按 `index % columnCount` 分配到各列——顺序固定，不按内容高度均衡。这意味着列高可能不均匀；调整 `columnCount` 会改变所有已有条目的列归属，需同步更新 CSS 列数。

### prefetchedRef 预加载策略
`loadMore` 触发时检查 `prefetchedRef.current?.page === nextPage`：
- 命中 → 直接使用预取数据，清空 ref，无网络请求
- 未命中 → fallback 到正常 fetch

每次 `loadMore` 成功后，若 `hasMore`，立即启动下一页预取（`prefetch(nextPage + 1)`）。
初始化时（`useEffect`），若 `initialHasMore` 为 true，预取第 2 页。

**陷阱**：`prefetch` 失败静默丢弃（`catch` 空返回）——预取失败不影响 `loadMore`，只是多一次正常 fetch。

### GSAP 视差（桌面端 ≥ 768px）
`useDesktopParallax` 仅在 `window.matchMedia('(max-width: 767px)').matches === false` 时初始化。
偶数索引列（0-indexed：0, 2, 即 nth-child 1, 3）施加 `yPercent: 100 + ScrollTrigger scrub`，向上反向滚动。奇数列自然向下滚动，形成视差错位效果。

Lenis 平滑滚动通过 `gsap.ticker.add(updateLenis)` 集成，必须同时设置 `gsap.ticker.lagSmoothing(0)` 防止低帧率时 Lenis 跳帧。

### 滚动触底（IntersectionObserver）
`useInfiniteLoad` 观察 `sentinelRef`（列表末尾一个空 `<div>`），触发 margin `400px`（提前 400px 触发），调用 `loadMore`。`loadMore` 内部有 `if (isLoading || !hasMore) return` 防重入。

## 硬约束

- CSS 类名 `col-scroll__box` 和 `col-scroll__list` 被 `useDesktopParallax` 的 selector 字符串硬编码引用——改 CSS 类名必须同步改 JS selector。
- GSAP context（`gsap.context(() => {...}, rootRef)`）在 cleanup 中调用 `context.revert()`，确保 ScrollTrigger 实例随组件卸载。不要在 context 外创建 ScrollTrigger。
- `NowWatchingColumns` 直接消费 `useNowWatching()` hook，必须在 `NowWatchingProvider` 内使用，否则抛出 `'useNowWatching must be used within NowWatchingProvider'`。
