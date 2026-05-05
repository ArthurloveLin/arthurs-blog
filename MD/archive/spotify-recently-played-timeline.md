# 计划：最近播放历史时间轴 + 柱状图视图

## Context

当前 `SpotifyRecentlyPlayedDeck` 只显示最近 12 首歌曲，数据来自 dashboard 快照，无法浏览历史记录。存储层以月份分片（`YYYY-MM.json`），粒度太粗，无法支撑按天/时段浏览。

目标：将存储粒度改为「天」，在最近播放区域下方加时间轴（日期 + 时段），同时增加柱状图视图切换，让听歌分布可视化。

---

## 一、存储层改造（`lib/spotify.ts`）

### 1. 新增 `getYearMonthDay(date)` 工具函数
返回 `YYYY-MM-DD`。与现有 `getYearMonth` 共存（旧月份分片保留不删）。

### 2. 新增日分片读写函数
```
readRecentlyPlayedDayShard(date: string): Promise<SpotifyRecentlyPlayedTrack[]>
  → R2 key: spotify/history/recently-played/${date}.json

writeRecentlyPlayedDayShard(date: string, items: SpotifyRecentlyPlayedTrack[])
  → 同上
```

### 3. 修改 `syncSpotifyDashboardToArchive` 中的写入逻辑
目前按月分组写入：
```ts
const month = getYearMonth(new Date(track.playedAt))  // YYYY-MM
```
改为**同时按天分组写入日分片**（保留月分片写入不动，向前兼容）：
```ts
const day = getYearMonthDay(new Date(track.playedAt))  // YYYY-MM-DD
// mergeByKey + writeRecentlyPlayedDayShard(day, merged)
```

### 4. 新增 `listRecentlyPlayedDays(limitDays?: number): Promise<string[]>`
用 `listR2Objects(bucket, 'spotify/history/recently-played/')` 列举对象，
过滤出 `YYYY-MM-DD.json` 格式（排除旧的 `YYYY-MM.json`），
返回排序后的日期字符串数组（降序，最新在前），限制最多 90 天。

---

## 二、新 API 路由

### `GET /app/api/spotify/history/days/route.ts`
- 调用 `listRecentlyPlayedDays(90)`
- 返回 `{ days: string[] }` 
- 缓存头：`Cache-Control: s-maxage=300, stale-while-revalidate=600`

### `GET /app/api/spotify/history/route.ts`
- Query param: `?date=YYYY-MM-DD`（校验格式，非法返回 400）
- 调用 `readRecentlyPlayedDayShard(date)`
- 返回 `SpotifyRecentlyPlayedTrack[]`（按 `playedAt` 降序）
- 缓存头：历史日期 `s-maxage=3600`，今天 `s-maxage=60`

---

## 三、类型定义（`lib/spotify-types.ts`）

新增：
```ts
export type TimeSegmentId = 'dawn' | 'morning' | 'noon' | 'afternoon' | 'evening' | 'night'

export interface TimeSegment {
  id: TimeSegmentId
  label: string      // 凌晨/早晨/上午/下午/傍晚/深夜
  startHour: number
  endHour: number    // exclusive
}
```

时段划分：
| id | label | 时段 |
|----|-------|------|
| dawn | 凌晨 | 00–06 |
| morning | 早晨 | 06–10 |
| noon | 上午 | 10–12 |
| afternoon | 下午 | 12–18 |
| evening | 傍晚 | 18–21 |
| night | 深夜 | 21–24 |

---

## 四、组件改造

### 4.1 新文件：`lib/spotify-history-utils.ts`
纯工具函数，不依赖 React：
```ts
export const TIME_SEGMENTS: TimeSegment[]  // 上表 6 条
export function segmentTracksByTime(tracks, segments) → Map<TimeSegmentId, SpotifyRecentlyPlayedTrack[]>
export function formatDateLabel(dateStr: string) → '今天' | '昨天' | 'M月D日'
```

### 4.2 `SpotifyRecentlyPlayedDeck.tsx` 重构

**新增 state：**
```ts
type RecentlyPlayedView = 'timeline' | 'chart'
const [view, setView] = useState<RecentlyPlayedView>('timeline')
const [availableDays, setAvailableDays] = useState<string[]>([])
const [selectedDate, setSelectedDate] = useState<string | null>(null)  // YYYY-MM-DD
const [selectedSegment, setSelectedSegment] = useState<TimeSegmentId | null>(null)
const [historyTracks, setHistoryTracks] = useState<SpotifyRecentlyPlayedTrack[]>([])
const [isLoading, setIsLoading] = useState(false)
```

**数据加载：**
- mount 时 fetch `/api/spotify/history/days`，得到日期列表
- 默认选最新一天（若列表为空则展示 dashboard 的 12 条作为 fallback）
- 切换日期时 fetch `/api/spotify/history?date={date}`
- 切换后自动定位到该日第一个有数据的时段

**布局（timeline 视图）：**
```
┌─────────────────────────────────────────────────────┐
│  最近播放                      [时间轴] [分布图]  ← 胶囊 │
│  ← [卡片区域（1-4列）]  →                            │
│  ─────────────────────────────────────────────────  │
│  [今天] [昨天] [4月21日] [4月20日] ···  ← 日期横滚    │
│  [凌晨] [早晨] [上午●] [下午] [傍晚] [深夜] ← 时段   │
│                          第2页/共3页                 │
└─────────────────────────────────────────────────────┘
```

- 胶囊切换组件抽取为 `RecentlyPlayedViewToggle`（与 `SpotifyTimeRangeTabs` 相同样式）
- 日期行：`overflow-x-auto scrollbar-none`，每个日期是 pill button
- 时段行：仅显示有数据的时段（有数据才高亮），无数据的显示为 muted
- 卡片区域：和当前逻辑相同，`chunkItems` 分页，前/后按钮导航

### 4.3 新组件：`SpotifyListeningChart.tsx`

**图表视图布局：**
```
┌──────────────────────────────────────────────────┐
│  [今天] [昨天] [4月21日] ···   ← 日期选择（复用）    │
│                                                   │
│      ████                                         │
│   ██ ████ ██              ← 柱状图                │
│   ██ ████ ██ ██                                   │
│  ─────────────────                                │
│  凌晨 早晨 上午 下午 傍晚 深夜                       │
│       (数字标注: 3首)                               │
└──────────────────────────────────────────────────┘
```

**实现细节：**
- 纯 CSS + Tailwind 实现柱状图（无需 Chart.js），每根 bar 用 `div` + `height`
- 入场动画：Tailwind `animate-in` + CSS `@keyframes`，从 `scaleY(0)` 到 `scaleY(1)`，`transform-origin: bottom`，每根 bar 有 stagger delay（`animation-delay: calc(var(--bar-index) * 60ms)`）
- Hover：显示数量 tooltip
- Click：`setView('timeline')` + `setSelectedSegment(segmentId)`
- 当前选中时段高亮（柱子颜色）
- Y 轴：动态最大值，均匀刻度
- 空时段显示占位 bar（高度极低，透明度低）

---

## 五、关键文件清单

| 文件 | 操作 |
|------|------|
| `lib/spotify.ts` | 新增 `getYearMonthDay`、`readRecentlyPlayedDayShard`、`writeRecentlyPlayedDayShard`、`listRecentlyPlayedDays`；修改 sync 写入逻辑 |
| `lib/spotify-types.ts` | 新增 `TimeSegmentId`、`TimeSegment` |
| `lib/spotify-history-utils.ts` | 新建：`TIME_SEGMENTS`、`segmentTracksByTime`、`formatDateLabel` |
| `app/api/spotify/history/route.ts` | 新建：按日期查询 tracks |
| `app/api/spotify/history/days/route.ts` | 新建：列出可用日期 |
| `components/spotify/SpotifyRecentlyPlayedDeck.tsx` | 重构：加视图切换、日期/时段选择、history fetch |
| `components/spotify/SpotifyListeningChart.tsx` | 新建：柱状图组件 |
| `components/spotify/SpotifyRecentlyPlayedDeck.module.css` | 扩展：timeline 行、bar chart 样式 |

---

## 六、向前兼容策略

- 旧月份分片（`YYYY-MM.json`）**不删除、不迁移**，保留在 R2 中
- 新日分片（`YYYY-MM-DD.json`）与旧格式共存同一 prefix 下，用文件名长度区分
- `listRecentlyPlayedDays` 按名称格式过滤（正则 `/^\d{4}-\d{2}-\d{2}\.json$/`）
- Dashboard 的 12 条 recent tracks（来自 Spotify API 实时拉取）作为 fallback，日分片为空时仍展示

---

## 七、验证步骤

1. `npm run build` 无 TypeScript 错误
2. `npm run dev` 启动，访问 `/spotify`
3. 最近播放区域右上角出现胶囊切换按钮（时间轴/分布图）
4. 时间轴视图：底部日期行可滚动，点击日期切换数据，时段 tab 正常切换，卡片分页正常
5. 分布图视图：6 根柱子出场动画（各 bar 错落升起），hover 显示数量，click 跳回时间轴对应时段
6. 触发一次同步 (`/api/spotify/sync?mode=quick`)，检查 R2 中是否生成 `YYYY-MM-DD.json` 日分片
7. 访问 `/api/spotify/history/days` 返回日期列表，`/api/spotify/history?date=今天` 返回正确数据
