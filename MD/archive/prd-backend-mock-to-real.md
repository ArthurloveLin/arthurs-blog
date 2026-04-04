# PRD：Mock 数据替换为真实后端

> 背景：前端 Phase 1–6 重构完成后，以下三处仍依赖硬编码/Mock 数据。本文档逐一说明现状、问题根因、所需后端改动，以及前端如何接入真实数据。

---

## 一、当前 Mock 清单

| 组件 | Mock 数据来源 | 现状问题 |
|---|---|---|
| `CategoriesCard` | `lib/mockData.ts` → `mockCategories` | 分类是静态数组，与真实文章无关联 |
| `AuthorProfileCard` (categoriesCount) | `mockCategories.length`（固定为 5） | 分类数量不反映实际数据 |
| `AuthorProfileCard` (name / bio / avatar) | 组件内硬编码字符串 + CSS 占位符 | 作者信息无法动态配置 |
| `PostCard` (封面图) | CSS 渐变色循环占位 | 文章无封面图字段，无法展示真实图片 |
| `TagsCloudCard` / `AuthorProfileCard` (tagsCount) | `collectTags()` 仅遍历首页加载的 20 篇文章 | 超过 20 篇时标签统计不完整 |

---

## 二、改动项 1：分类系统

### 现状

`Post` 类型（`lib/blog.ts`）没有 `category` 字段，Supabase `posts` 表也没有对应列。`CategoriesCard` 接收 `mockCategories` 静态数组。

### 目标

文章在 Obsidian 写作时通过 frontmatter 声明所属分类，reindex 时写入数据库，前端实时查询。

### 后端改动

#### 2.1 Supabase `posts` 表新增列

```sql
ALTER TABLE posts
  ADD COLUMN category TEXT DEFAULT NULL;
```

#### 2.2 `lib/blog.ts` — 扩展 `Post` 接口

```ts
export interface Post {
  // ... 现有字段 ...
  category: string | null   // 新增
}
```

#### 2.3 `lib/blog.ts` — 新增 `getCategories()` 函数

```ts
export async function getCategories(): Promise<{ name: string; count: number; slug: string }[]> {
  const { data, error } = await supabase
    .from('posts')
    .select('category')
    .eq('published', true)
    .not('category', 'is', null)

  if (error) throw new Error(error.message)

  const countMap = new Map<string, number>()
  for (const row of data ?? []) {
    const cat = row.category as string
    countMap.set(cat, (countMap.get(cat) ?? 0) + 1)
  }

  return Array.from(countMap.entries())
    .map(([name, count]) => ({ name, count, slug: encodeURIComponent(name) }))
    .sort((a, b) => b.count - a.count)
}
```

#### 2.4 `app/api/blog/reindex/route.ts` — 解析 frontmatter `category`

```ts
await upsertPost({
  slug,
  title: fm.title,
  summary,
  tags: Array.isArray(fm.tags) ? fm.tags : [],
  category: typeof fm.category === 'string' ? fm.category : null,  // 新增
  r2_key: key,
  published: true,
  published_at: fm.date ? new Date(fm.date).toISOString() : new Date().toISOString(),
})
```

#### 2.5 `lib/blog.ts` — `upsertPost` 入参加入 `category`

```ts
export async function upsertPost(post: {
  slug: string
  title: string
  summary?: string
  tags?: string[]
  category?: string | null   // 新增
  r2_key: string
  published: boolean
  published_at?: string
}): Promise<void>
```

### Obsidian 文章 frontmatter 示例

```yaml
---
title: "Next.js App Router 深度解析"
date: 2024-03-15
published: true
tags: [Next.js, React, 前端]
category: 前端开发          # ← 新增字段
---
```

### 前端接入

`app/page.tsx` 替换：

```ts
// 删除
import { mockCategories } from '@/lib/mockData'

// 改为
import { getCategories } from '@/lib/blog'

// 在 HomePage 中
const categories = await getCategories().catch(() => [])

// 传入组件
<AuthorProfileCard
  postsCount={posts.length}
  categoriesCount={categories.length}   // 替换 mockCategories.length
  tagsCount={tags.length}
/>
<CategoriesCard categories={categories} />  // 替换 mockCategories
```

---

## 三、改动项 2：作者信息动态化

### 现状

`AuthorProfileCard` 中 name / bio 为硬编码字符串，avatar 为 CSS 初始字占位符。

### 目标

从 Supabase 读取可配置的作者信息（name、bio、avatar_url），支持后续修改无需改代码。

### 后端改动

#### 3.1 Supabase 新建 `site_config` 表

```sql
CREATE TABLE site_config (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- 初始数据
INSERT INTO site_config (key, value) VALUES
  ('author_name',       'Arthur & Grace'),
  ('author_bio',        '技术、生活与创意的记录者'),
  ('author_avatar_url', '');  -- 可填 R2 公开图片 URL 或留空
```

> RLS 建议：仅允许 `service_role` 写入，`anon` 可读。

#### 3.2 `lib/blog.ts` — 新增 `getSiteConfig()` 函数

```ts
export async function getSiteConfig(): Promise<Record<string, string>> {
  const { data, error } = await supabase
    .from('site_config')
    .select('key, value')

  if (error) return {}
  return Object.fromEntries((data ?? []).map((r) => [r.key, r.value]))
}
```

### 前端接入

`app/page.tsx`：

```ts
const config = await getSiteConfig().catch(() => ({}))

<AuthorProfileCard
  postsCount={posts.length}
  categoriesCount={categories.length}
  tagsCount={tags.length}
  name={config.author_name ?? 'Arthur & Grace'}
  bio={config.author_bio ?? ''}
  avatarUrl={config.author_avatar_url ?? ''}
/>
```

`components/AuthorProfileCard.tsx` 扩展 props：

```ts
interface AuthorProfileCardProps {
  postsCount: number
  categoriesCount: number
  tagsCount: number
  name?: string        // 新增
  bio?: string         // 新增
  avatarUrl?: string   // 新增
}
```

Avatar 渲染逻辑：有 `avatarUrl` 时使用 `<img>`，否则回退到现有 CSS 初始字占位符。

---

## 四、改动项 3：文章封面图

### 现状

`PostCard` 的封面区域使用 6 种 CSS 渐变色循环占位，`Post` 类型没有 `cover_image` 字段。

### 目标

文章可在 frontmatter 中声明封面图（R2 key 或绝对 URL），`PostCard` 优先展示真实图片，无封面图时回退到渐变占位。

### 后端改动

#### 4.1 Supabase `posts` 表新增列

```sql
ALTER TABLE posts
  ADD COLUMN cover_image TEXT DEFAULT NULL;
```

#### 4.2 `lib/blog.ts` — 扩展 `Post` 接口

```ts
export interface Post {
  // ... 现有字段 ...
  cover_image: string | null   // 新增：R2 key 或完整 URL
}
```

#### 4.3 `app/api/blog/reindex/route.ts` — 解析 `cover_image`

```ts
await upsertPost({
  // ...
  cover_image: typeof fm.cover_image === 'string' ? fm.cover_image : null,  // 新增
})
```

当 `cover_image` 是相对路径（R2 key）时，reindex 路由拼接 `R2_BLOG_PUBLIC_DOMAIN` 构造完整 URL 后存入，或在前端读取时拼接——两种方式均可，建议存入完整 URL 以减少前端计算。

#### 4.4 `lib/blog.ts` — `upsertPost` 入参加入 `cover_image`

```ts
export async function upsertPost(post: {
  // ...
  cover_image?: string | null   // 新增
}): Promise<void>
```

### Obsidian 文章 frontmatter 示例

```yaml
---
title: "Cloudflare R2 对象存储"
cover_image: "covers/cloudflare-r2.jpg"   # R2 key，reindex 时拼接域名
# 或者
cover_image: "https://pub.arthurlovegrace.top/covers/cloudflare-r2.jpg"  # 完整 URL
---
```

### 前端接入

`components/PostCard.tsx` 封面区域：

```tsx
{post.cover_image ? (
  <img
    src={post.cover_image}
    alt={post.title}
    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
  />
) : (
  <div className={`h-full w-full bg-gradient-to-br ${gradient} transition-transform duration-500 group-hover:scale-105`} />
)}
```

---

## 五、改动项 4：标签统计完整性

### 现状

`collectTags()` 在 `app/page.tsx` 中仅遍历 `getPosts(20, 0)` 返回的前 20 篇，当文章超过 20 篇时标签统计不完整，影响 `TagsCloudCard` 和 `AuthorProfileCard` 的 `tagsCount`。

### 目标

标签统计基于全部已发布文章，与分页无关。

### 后端改动

#### 5.1 `lib/blog.ts` — 新增 `getAllTags()` 函数

```ts
export async function getAllTags(): Promise<{ tag: string; count: number }[]> {
  const { data, error } = await supabase
    .from('posts')
    .select('tags')
    .eq('published', true)

  if (error) throw new Error(error.message)

  const tagMap = new Map<string, number>()
  for (const row of data ?? []) {
    for (const tag of (row.tags as string[]) ?? []) {
      tagMap.set(tag, (tagMap.get(tag) ?? 0) + 1)
    }
  }

  return Array.from(tagMap.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count)
}
```

> 注：只 `SELECT tags` 不拉取正文字段，查询开销极小。

### 前端接入

`app/page.tsx` 替换：

```ts
// 删除 collectTags() 函数及调用
// 改为
const tags = await getAllTags().catch(() => [])
```

---

## 六、实施顺序建议

| 优先级 | 改动项 | 理由 |
|---|---|---|
| P0 | 改动项 4（标签统计完整性） | 纯后端函数，零风险，立即修正数据准确性 |
| P1 | 改动项 1（分类系统） | 消除唯一一处 mock 数据注入，视觉影响最大 |
| P2 | 改动项 3（封面图） | 需 Obsidian 侧配合补充 frontmatter，可按需逐步推进 |
| P3 | 改动项 2（作者信息） | 个人博客改动频率低，可按需实施 |

---

## 七、不需要后端改动的部分

以下组件已使用真实 Supabase 数据，无需改动：

- `RecentPostsCard` — 直接使用 `getPosts()` 返回的前 5 篇
- `ArchiveCard` — 从真实 `published_at` 派生年份分组
- `ToolsCard` — 静态工具链接，无需数据化
- `PostCard` title / summary / tags / date — 均来自真实 `posts` 表
