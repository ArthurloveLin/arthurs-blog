# Memo Page

`/memo` 路由的服务端入口。核心模块逻辑在 [`components/note-board/CLAUDE.md`](../../components/note-board/CLAUDE.md)，此文件仅记录页面层的非显然决策。

## 流式渲染架构

```
MemoPage（async Server Component）
  │
  ├─ 立即并行解析：searchParams + cookies + getSiteConfig()
  │    ↓ 解析完成即渲染
  │  <PageHero>   ← 立即流式输出，不等 auth 或 DB 查询
  │
  └─ <Suspense fallback={<MemoBoardSkeleton />}>
       └─ <MemoBoard>   ← async Server Component，内部串行：
            ├─ getCurrentUser()   ← Supabase auth（读 cookie）
            └─ getBoardMessages() ← 带 userId 的 DB 查询（per-user 隔离）
```

**为什么 Hero 和 Board 分开？** `getCurrentUser` + `getBoardMessages` 依赖用户 auth，延迟高。把它们包进 `<Suspense>` 后，Hero 能立即出现，Board 作为流式后续到达。

## `force-dynamic` 的原因

```ts
export const dynamic = 'force-dynamic'
```

Memo 内容按用户隔离（不同用户看不同 notes）。不能静态缓存，否则用户 A 会看到用户 B 的 notes。

## 配置来源融合

`MemoPage` 从三处读取配置，优先级从高到低：
1. `siteConfig`（Supabase `site_config` 表）— Hero 标题、副标题、描述、slogan 字段
2. `noteBoardConfig`（`lib/note-board-config.ts`）— 回退值，当 siteConfig 字段为空时使用
3. `searchParams.q`（URL `?q=`）— 初始搜索词，透传给 `MemoBoard`

初始 view mode 从 cookie 读取（key = `getNoteBoardViewModeCookieName(config.slug)`），也传入 `NoteBoardPage`。
