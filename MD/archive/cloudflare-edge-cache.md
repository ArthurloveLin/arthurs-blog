# Cloudflare 边缘缓存配置

## 请求路径（三条链路）

```
Path A — 无缓存（冷启动 / 缓存失效）：
用户 → Cloudflare (透传) → Vercel (渲染) → Supabase (查询) → 返回 HTML
耗时：200~800ms，跨越多个服务商，含数据库 I/O

Path B — Vercel ISR 缓存命中：
用户 → Cloudflare (透传) → Vercel Edge Cache → 返回 HTML
耗时：50~150ms，Vercel 直接返回缓存 HTML，不查数据库
触发条件：revalidate = 60s 内，Vercel 有缓存

Path C — Cloudflare 边缘缓存命中（当前配置目标）：
用户 → Cloudflare Edge Node → 返回 HTML
耗时：5~50ms，在距用户最近的 CF 节点（全球 300+）直接返回
触发条件：CF 缓存未过期
```

---

## 实施内容

### 1. next.config.ts — CDN-Cache-Control 响应头

告知 Cloudflare 各路由的缓存时长。`CDN-Cache-Control` 是 CF 专用头：
- 只控制 CF 缓存行为，不影响浏览器缓存
- CF 发给用户前会自动剥离该头

```ts
async headers() {
  return [
    // 博客文章：缓存 24 小时，reindex 时主动清除
    {
      source: '/blog/:slug',
      headers: [{ key: 'CDN-Cache-Control', value: 'public, s-maxage=86400, stale-while-revalidate=86400' }],
    },
    // 首页：缓存 1 小时
    {
      source: '/',
      headers: [{ key: 'CDN-Cache-Control', value: 'public, s-maxage=3600, stale-while-revalidate=3600' }],
    },
    // 标签 / 分类 / 归档 / 衣橱：缓存 1 小时
    {
      source: '/(tag|blog/category|archive|wardrobe)/:path*',
      headers: [{ key: 'CDN-Cache-Control', value: 'public, s-maxage=3600, stale-while-revalidate=3600' }],
    },
  ]
},
```

### 2. Cloudflare Dashboard — Cache Rules

Cloudflare 默认只按文件扩展名缓存静态资源，HTML 不在其中。需要显式配置。

**规则 1（优先级高）— Bypass：**
- 条件：`(starts_with(http.request.uri.path, "/api")) or (starts_with(http.request.uri.path, "/admin"))`
- 动作：Bypass Cache

**规则 2 — Cache Everything：**
- 条件：`(http.request.uri.path eq "/") or (starts_with(http.request.uri.path, "/blog")) or (starts_with(http.request.uri.path, "/tag")) or (starts_with(http.request.uri.path, "/archive")) or (starts_with(http.request.uri.path, "/wardrobe"))`
- 动作：Cache Everything
- Edge TTL：Use cache-control header if present, bypass cache if not

### 3. app/api/blog/reindex/route.ts — 主动清除 CF 缓存

当内容更新（reindex 执行）后，调用 CF Purge API 清除对应 URL 的边缘缓存，确保用户下次请求拿到最新内容。

```
reindex 触发时：
1. 更新 Supabase 数据
2. revalidatePath() → 清除 Vercel ISR 缓存
3. CF Purge API → 清除 Cloudflare 边缘缓存（本次新增）
```

清除范围：首页 `/` + 本次变更的所有博客文章 `/blog/{slug}`

所需环境变量：
- `CF_ZONE_ID` — CF Dashboard → 域名概览页右下角
- `CF_API_TOKEN` — CF API Token，权限：Zone > Cache Purge > Purge

---

## 完整缓存层级

| 层级 | 实现方式 | 缓存时长 | 失效方式 |
|------|---------|---------|---------|
| React 请求去重 | `cache()` | 单次请求内 | 自动 |
| Next.js 数据缓存 | `unstable_cache()` | 30~300s | `revalidateTag()` |
| Vercel ISR | `export const revalidate` | 60s | `revalidatePath()` |
| Cloudflare 边缘缓存 | Cache Rule + CDN-Cache-Control | 1h / 24h | CF Purge API |

---

## 验证方式

部署后，用浏览器 DevTools → Network 查看响应头：

| CF-Cache-Status | 含义 |
|----------------|------|
| `MISS` | CF 未命中，本次已填充缓存（正常，首次请求） |
| `HIT` | CF 命中，Path C 生效 ✅ |
| `BYPASS` | CF 跳过缓存，检查 Cache Rule 配置 |
| `EXPIRED` | 缓存已过期，CF 正在回源刷新 |

---

## 待办优化项

### Cloudflare 控制台（零代码）
- [x] 开启 HTTP/3 (QUIC)：Speed → Optimization
- [x] 开启 Brotli 压缩：Speed → Optimization
- [x] 开启 Early Hints (103)：Speed → Optimization
- [ ] ~~开启 Polish 图片压缩~~ 需要 Pro 套餐（$20/月），暂跳过
- [ ] ~~开启 Minify HTML/CSS/JS~~ Cloudflare 已于 2024 年 8 月下线此功能
- [ ] 补充 Cache Rule（最高优先级）：`/_next/static/*` Edge TTL 设为 1 year

### Supabase 连接优化
- [x] Dashboard → Database → Connection Pooling 开启 Supavisor，模式选 Transaction（仅对直连 pg 有效，当前用 JS Client 可跳过）
- [x] `lib/supabase.ts` 已是模块级单例，`supabase-server.ts` 按需新建符合预期，无需修改

### Next.js 前端
- [x] `app/layout.tsx` 添加 `<link rel="preconnect">` 指向 Supabase 域名及图片 CDN
