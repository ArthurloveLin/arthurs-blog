# VPS Next.js 全面优化计划

## Context

当前已完成 caching-vps.md 中 Phase 2-5 的缓存收敛工作（精准 CDN purge、TTL 分层、guestbook 解耦等）。本计划在此基础上展开，针对**单实例 VPS + Cloudflare** 的部署形态，系统梳理数据层、JavaScript 包体、渲染性能、基础设施与可观测性五个方向的优化机会。VPS 部署与 Vercel 的核心差异在于：无函数超时约束、Node.js 进程常驻、sharp 原生可用、可完整控制 nginx 层，因此可以做 Vercel 时期无法或不合算做的事情。

---

## Phase A：数据层 SQL 下推（高收益，中优先级）

**问题**：`lib/blog.ts` 中有多处把本该在数据库完成的聚合拉到 Node 侧处理，在帖子规模增大时会成为瓶颈，同时浪费了 unstable_cache 的缓存效率。

### ~~A-1 `getAllTags()` — 全表扫描降为 DB 聚合~~
- ~~**现状**（`lib/blog.ts:419`）：SELECT 所有已发布文章的 `tags` 字段，在 Node 侧展平 + 计数~~
- ~~**目标**：改用 Supabase RPC / unnest + GROUP BY，仅返回 `{tag, count}[]`~~
- ~~**收益**：从 O(N posts) 数据量降为 O(M tags)，缓存值也从大数组降为小结果集~~

### ~~A-2 `getCategories()` — 移除不必要的全量字段~~
- ~~**现状**（`lib/blog.ts:330`）：SELECT 完整文章行只取 `category` 字段，Node 侧 dedup~~
- ~~**目标**：改为 `SELECT category, COUNT(*) GROUP BY category WHERE published=true`~~
- ~~**收益**：响应体积大幅下降，缓存命中率提升~~

### ~~A-3 `getYearArchive()` — 日期提取移入 DB~~
- ~~**现状**（`lib/blog.ts:382-412`）：取所有 `published_at`，Node 侧 getFullYear()~~
- ~~**目标**：`SELECT EXTRACT(year FROM published_at) as year, COUNT(*) GROUP BY year ORDER BY year DESC`~~

### ~~A-4 `getCommentCounts()` — GROUP BY 替换全表读~~
- ~~**现状**（`lib/blog.ts:471-489`）：读取完整 comments 表再 Node 侧聚合~~
- ~~**目标**：`SELECT target_id, COUNT(*) FROM comments GROUP BY target_id WHERE target_type='blog_post'`~~

### ~~A-5 Fix 嵌套 unstable_cache（`lib/blog.ts:221`）~~
- ~~**现状**：`getPostContent` 内部又 wrap 了一层 `unstable_cache`，形成双层缓存，语义不清~~
- ~~**目标**：去掉内层或外层，只保留一个缓存边界，明确 tag~~
- ~~**实现**：合并为单层 `unstable_cache`，同时挂 `getPostContentTag` + `getPostRawTag` 两个 tag，删除 `getCachedPostContent`；外层加 `cache()` 保证请求内去重~~

### A-6 Rankings 路由批量 upsert
- **现状**（`app/api/sessions/[token]/rankings/route.ts:71-81`）：每个 item 独立 UPDATE
- **目标**：改为单次 `supabase.from(...).upsert([...])` 批量操作

**相关文件**：
- `lib/blog.ts`（A-1 ~ A-5）
- `supabase/migrations/028_db_aggregation.sql`（A-1 ~ A-4 的 RPC 函数定义）
- `app/api/sessions/[token]/rankings/route.ts`（A-6）

---

## Phase B：JavaScript 包体优化（高收益，低-中优先级）

**问题**：多个大型库以静态 import 方式出现在仅少数页面才用的路径上，每次客户端加载都付出了不必要的解析成本。VPS 不受 Vercel 边缘函数包大小限制，但客户端 JS 体积直接影响用户的 TTI（Time to Interactive）。

### B-1 `d3` 动态导入
- **现状**：`TrendRadarDisplay.tsx` 静态 import d3（~60KB gzip 后）
- **目标**：`next/dynamic(() => import('./TrendRadarChart'), { ssr: false })`，仅在 trend-radar 路由加载
- **影响文件**：`components/TrendRadarDisplay.tsx`，`app/trend-radar/page.tsx`

### B-2 `emoji-mart` 懒加载
- **现状**：`CommentBox.tsx`（33.5KB）静态导入 emoji-mart + @emoji-mart/data（~1MB 数据）
- **目标**：点击 emoji 按钮时才动态 import，配合 `React.lazy` 或 `next/dynamic`
- **影响文件**：`components/CommentBox.tsx`，可拆出 `EmojiPickerLazy.tsx`

### B-3 `browser-image-compression` 懒加载
- **现状**：UploadZone 静态导入，上传只在管理员场景使用
- **目标**：文件选择时才 import，防止普通访客加载

### B-4 `gsap` 按需加载策略
- **现状**：9 个组件各自静态 import gsap，可能打进公共 chunk
- **目标**：统一以 `next/dynamic` + `ssr: false` 或动态 `import()` 加载动画组件本身（WelcomeAnimation、ThankYouAnimation、ReactionToggleBar 等）
- **注意**：GSAP DrawSVGPlugin 是商业插件，确认 license 允许 chunk 分包

### ~~B-5 打包分析基准（前置步骤）~~
- ~~运行 `@next/bundle-analyzer` 生成 treemap，确认实际 chunk 归属后再决定优先级~~
- ~~命令：`ANALYZE=true npm run build`（需在 next.config.ts 配置 bundleAnalyzer）~~
- ~~**已完成**：`@next/bundle-analyzer` 已安装为 devDependency，`next.config.ts` 已配置 `withBundleAnalyzer`~~

> **B-1 调查说明**：`d3` 已在 `SpotifyTagStreamChart.tsx` 中通过 `import * as d3 from 'd3'`，而该组件由 `SpotifyRecentlyPlayedDeck` 以 `next/dynamic + ssr: false` 动态加载，因此 d3 已在独立 chunk 中，无需额外处理。

**相关文件**：
- `components/TrendRadarDisplay.tsx`
- `components/CommentBox.tsx`
- `components/admin/UploadZone.tsx`（假设路径）
- `components/WelcomeAnimation.tsx`、`ThankYouAnimation.tsx`、`ReactionToggleBar.tsx`

---

## Phase C：Core Web Vitals & 渲染性能（中收益，低优先级）

### C-1 BlogHero blob 动画 GPU 层优化
- **现状**（`components/BlogHero.tsx:85-86`）：`animate-blob` + `blur-2xl` 每帧触发 filter 重绘，产生额外合成层压力
- **目标**：
  - 给 blob 元素加 `will-change: transform`（仅需要时）
  - 或换用 CSS `backdrop-filter` 替代 per-element blur
  - 或降低 blur 程度（`blur-xl` 替代 `blur-2xl`）
  - 加 `CSS contain: strict` 限制重排范围

### C-2 Live2D CLS 防护
- **现状**（`components/BlogHero.tsx:15-18`）：Live2D 以 `ssr: false` 动态加载，容器高度初始为 0
- **目标**：给占位容器设置 `min-height`，防止 CLS（Cumulative Layout Shift）

### C-3 SWR guestbook 重复请求收敛
- **现状**（`components/BlogHero.tsx:50`）：每次页面访问都发起 SWR 请求，无 deduping
- **目标**：添加 `dedupingInterval: 60000`（60秒内同 key 请求合并）和 `focusThrottleInterval`

### C-4 TrendRadarDisplay 计算缓存
- **现状**：D3 shape 计算在每次渲染时重新执行
- **目标**：对输入数据用 `useMemo` 缓存 D3 计算结果，避免无效重算

### C-5 主题切换过渡改善
- **现状**（`app/layout.tsx`）：`next-themes` 使用 `disableTransitionOnChange: true`，切换时瞬间闪烁
- **目标**：允许 CSS transition（`transition-colors duration-200`），或改为 fade + color 分离处理

### C-6 字体 LXGW WenKai 加载优化
- **现状**（`app/layout.tsx:64`）：外链 jsDelivr CDN 字体，依赖第三方 CDN 可用性
- **目标**：评估是否可自托管到 R2/VPS，或换成 `preload` + `as=style` 减少 FOUT

**相关文件**：
- `components/BlogHero.tsx`（C-1, C-2, C-3）
- `components/TrendRadarDisplay.tsx`（C-4）
- `app/layout.tsx`（C-5, C-6）

---

## Phase D：VPS 基础设施优化（中收益，独立执行）

**这是 Vercel 时期完全无法做的部分**，也是 VPS 部署的核心优势所在。

### D-1 Node.js 进程调优
- **现状**：默认 Node.js 启动参数，未针对常驻进程优化
- **目标**（在 `docker-compose.yml` 或 PM2 config 中）：
  ```
  NODE_OPTIONS="--max-old-space-size=512 --max-semi-space-size=64"
  ```
  根据 VPS 实际内存决定值。单实例 Next.js standalone 通常 512MB 足够，超出则说明有内存泄漏。

### ~~D-2 `dangerouslyAllowLocalIP: true` 清除~~
- ~~**现状**（`next.config.ts`）：开发用标志留在了生产配置中~~
- ~~**目标**：通过 `process.env.NODE_ENV` 条件化，或改用 `NEXT_PUBLIC_DEV_IP` 控制~~
- ~~**已完成**：改为 `process.env.NODE_ENV === 'development'`，生产构建自动关闭~~

### D-3 nginx 压缩与 HTTP/2 推送
- 验证 nginx 对 `.js`、`.css`、JSON 响应开启了 Brotli（优先于 gzip）
- 确认 HTTP/2 多路复用已启用（`http2 on;` 在 nginx server block）
- Next.js standalone 自带 server.js 不支持 HTTP/2，需要 nginx 在前面终止 TLS

### D-4 nginx 静态资产缓存头
- `_next/static/` 目录已包含 content hash，可设置 1年 immutable
  ```nginx
  location /_next/static/ {
    expires 1y;
    add_header Cache-Control "public, immutable";
  }
  ```
- 对比现有 Cloudflare Page Rule，避免 CDN 头与 nginx 头冲突

### D-5 standalone 构建磁盘 IO 优化
- Next.js standalone 把 `.next/cache` 放在磁盘，建议挂载到高速盘或 tmpfs（如果 RAM 充裕）
- 定期清理 `/.next/cache/fetch-cache` 防止磁盘占满（可加 cron）

### D-6 进程健康检查与自动重启
- 确认 Docker/PM2 有 healthcheck（调用 `/api/me` 或 `/robots.txt`）
- 内存阈值重启策略（PM2 `max_memory_restart: "400M"` 或 Docker `--memory`）

**相关文件**：
- `next.config.ts`（D-2）
- `docker-compose.yml` / nginx config / PM2 config（D-1, D-3, D-4, D-5, D-6）

---

## Phase E：CDN 与 App Router 兼容性（对应原 caching-vps.md Phase 6）

这是原计划中唯一未完成的技术验证阶段。

### E-1 Cloudflare RSC 流量分离验证
- 验证 Cloudflare 是否把 `?_rsc=xxx` 请求作为独立 cache key（`Vary: RSC` 或 Query String 规则）
- 工具：`curl -H "RSC: 1" https://yourdomain.com/ -I` 对比普通请求的 `CF-Cache-Status`

### E-2 流式响应不被缓冲
- 确认 nginx 或 Cloudflare 对 `/blog/[slug]` 这类使用 Suspense 的页面不做全量缓冲
- nginx: `proxy_buffering off;` 对 streaming 响应
- Cloudflare: 默认不缓冲 streaming，但 Cache Rules 可能影响

### E-3 proxy.ts 注释合规性复查
- 读 `proxy.ts` 确认其中注释记录的限制（Web Lock、自定义域名不可达）在当前部署形态下是否仍然成立
- 如已不需要 Edge sandbox 限制，评估能否从 middleware 做更多事（如请求日志、IP 限制）

**相关文件**：
- `proxy.ts`
- nginx/Cloudflare 配置

---

## Phase F：可观测性建设（后置但持续价值）

没有指标就无法判断优化效果，这是后续所有调参的基础。

### F-1 Web Vitals 上报
- 在 `app/layout.tsx` 添加 `onCLS`, `onLCP`, `onFID`, `onFCP`, `onTTFB` 上报到 Pirsch 自定义事件或专用端点
- 可用 `web-vitals` npm 包（已是 Next.js 依赖）

### F-2 Cloudflare Analytics 与源站对照
- 建立周期性查看 CF HIT ratio 习惯（按 path 维度）
- 对比 reindex 前后 HIT ratio 下降曲线，验证精准 purge 效果

### F-3 Supabase 慢查询识别
- 在 Supabase Dashboard → Logs → Database 筛选 >100ms 的查询
- 结合 A 阶段改造后对比

### F-4 构建产物大小追踪
- 在 CI 或 deploy 脚本中输出 `next build` 的 chunk size 摘要，建立基线

---

## 执行优先级建议

| 优先级 | Phase | 原因 |
|--------|-------|------|
| ~~**立即**~~ | ~~B-5（打包分析基准）~~ | ~~0 风险，为 B 系列决策提供依据~~ ✅ |
| ~~**近期**~~ | ~~A-1 ~ A-5（DB 聚合下推 + 嵌套 cache 修复）~~ | ~~数据量增大后收益线性增长，改动集中在 lib/blog.ts~~ ✅ |
| ~~**近期**~~ | ~~D-2（清除 dangerouslyAllowLocalIP）~~ | ~~安全问题，一行改动~~ ✅ |
| **中期** | B-1（d3 动态导入，已确认现状已满足）、B-2（emoji-mart 懒加载） | 用户可感知的包体减少 |
| **中期** | E-1 ~ E-3（CDN 兼容性验证） | 延续原计划 Phase 6 |
| **中期** | C-1 ~ C-4（渲染性能细节） | 量变积累 |
| **长期** | D-1、A-6、D-3 ~ D-6（基础设施 + Rankings 批量 upsert） | 依赖 VPS 访问权限，需要维护窗口 |
| **长期** | F 系列（可观测性） | 持续价值，但实施成本低 |

---

## 验证方式

1. **A 阶段**：改前后对比 Supabase 慢查询日志；用 `EXPLAIN ANALYZE` 对比新旧查询计划
2. **B 阶段**：`ANALYZE=true npm run build` 对比 chunk size；Chrome DevTools Network 面板看首屏 JS 加载量
3. **C 阶段**：PageSpeed Insights / Lighthouse 对比 CLS、LCP 分值；开启 Performance 面板看 blob 动画 frame rate
4. **D 阶段**：`nginx -t` 验证配置；`curl -I` 验证响应头；VPS `htop` 观察内存稳定性
5. **E 阶段**：`curl -H "RSC: 1"` 对比普通请求头；Cloudflare Log Explorer 过滤 RSC 流量 cache status
6. **全程**：`npm run lint && npm run build` 确保无回归
