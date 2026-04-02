
# 项目架构规划 v3：个人博客 + Obsidian 同步

> 规划日期：2026-04-02  
> 目标：将 Hub 首页重构为个人博客，Obsidian 笔记通过 Supabase Storage 同步，两个工具模块迁移至导航栏

---

## 一、现状 vs 目标

| 维度 | 现状 | 目标 |
|---|---|---|
| 首页 | 两张模块卡片（Hub） | 个人博客（文章列表） |
| 导航 | 无 | 顶部 Navbar，内含两个工具模块入口 |
| 笔记存储 | Obsidian 本地 + 坚果云 WebDAV | Obsidian 本地 + Supabase Storage（S3 兼容） |
| 博客数据源 | 无 | Supabase（Storage 存文件 + DB 存索引） |

---

## 二、Obsidian 同步方案

### 核心原理

Supabase Storage 支持 AWS S3 兼容 API（签名 v4），可直接作为 S3 端点使用。  
Obsidian 社区插件 **remotely-save** 原生支持 S3 兼容服务，无需开发任何代码。

```
Obsidian（本地写作）
  └── remotely-save 插件（S3 模式）
       └── Supabase Storage（obsidian-vault bucket）
            └── Next.js 博客读取 .md 文件并渲染
```

### remotely-save 配置参数

| 参数 | 值 |
|---|---|
| Service | S3 or S3-compatible |
| Endpoint | `https://<project-ref>.supabase.co/storage/v1/s3` |
| Region | `ap-southeast-1`（或任意填写） |
| Access Key ID | Supabase Storage Access Key |
| Secret Access Key | Supabase Storage Secret Key |
| Bucket Name | `obsidian-vault` |

> Supabase Storage 的 S3 密钥可在项目设置 → Storage → S3 Access Keys 中生成。

### 博客可见性控制

在 Obsidian 笔记的 YAML frontmatter 中控制是否发布：

```yaml
---
title: 我的第一篇博客
date: 2026-04-02
tags: [思考, 技术]
published: true   # 仅 true 时对外展示
---
```

未设置或 `published: false` 的笔记不会出现在博客中，实现私密笔记与公开文章共存。

---

## 三、数据架构

### 方案：Storage 存文件 + DB 存索引（推荐）

直接读取 Storage 中的所有 `.md` 文件性能差、成本高。引入一张轻量的 `posts` 索引表解决：

```
Supabase Storage (obsidian-vault/)
  └── 触发器/定时任务 → 解析 frontmatter → 写入 posts 表

Next.js 博客
  └── 查询 posts 表（列表页、标签筛选）
  └── 读取 Storage 中的 .md 文件（文章详情页）
```

### 新增 Supabase 表：`posts`

```sql
create table posts (
  id           uuid primary key default gen_random_uuid(),
  slug         text unique not null,          -- URL 路径，如 my-first-post
  title        text not null,
  summary      text,                          -- 摘要（frontmatter excerpt 或自动截取）
  tags         text[] default '{}',
  storage_path text not null,                 -- Storage 中的文件路径
  published    boolean default false,
  published_at timestamptz,
  updated_at   timestamptz default now()
);

-- 仅暴露已发布文章给匿名用户
alter table posts enable row level security;
create policy "公开已发布文章" on posts
  for select using (published = true);
```

### 索引同步触发方式（三选一）

| 方式 | 适合场景 | 复杂度 |
|---|---|---|
| **手动触发**：访问 `/api/blog/reindex` 接口 | 写完文章后手动刷新 | ★☆☆ |
| **GitHub Actions 定时任务**：每小时扫描 Storage 变化 | 无需手动操作 | ★★☆ |
| **Supabase Edge Function + Storage Webhook** | 上传即触发，近实时 | ★★★ |

> **建议起步使用手动触发**，后续升级为 Edge Function 方式。

---

## 四、前端重构

### 新路由表

| URL | 说明 |
|---|---|
| `/` | 博客首页（文章列表，分页） |
| `/blog/[slug]` | 文章详情（Markdown 渲染） |
| `/blog/tags/[tag]` | 标签筛选页 |
| `/wardrobe` | 选衣记录（现有，保持不变） |
| `/session/[token]` | 会话页（现有，保持不变） |
| `trendradar.arthurlovegrace.top` | 新闻汇总（子域名，保持不变） |

### Navbar 设计

```
[ Arthur & Grace ]                    [ 选衣记录 ]  [ 新闻汇总↗ ]
```

- 左侧：站点名（链接到 `/`）
- 右侧：工具模块入口
  - 选衣记录 → `/wardrobe`（内部跳转）
  - 新闻汇总 → `https://trendradar.arthurlovegrace.top`（新标签页）

### 博客首页布局

```
[ Navbar ]
─────────────────────────────
  最近文章

  [标题]                    2026-04-02
  摘要文字摘要文字摘要文字...
  [标签1] [标签2]
  ─────────────────────────
  [标题]                    2026-03-28
  ...

[ Footer ]
```

### 文章详情页功能

- Markdown → HTML 渲染（支持代码高亮）
- 显示 tags、发布日期
- 上一篇 / 下一篇导航
- （可选）Obsidian 内链 `[[note]]` 转为站内链接

---

## 五、目录结构变化

```
wardrobe-picks/
├── app/
│   ├── layout.tsx            ← 新增全局 Navbar（现有 layout 改造）
│   ├── page.tsx              ← 重构为博客文章列表
│   ├── blog/
│   │   ├── [slug]/
│   │   │   └── page.tsx      ← 新增：文章详情页
│   │   └── tags/[tag]/
│   │       └── page.tsx      ← 新增：标签筛选页
│   ├── wardrobe/             ← 不变
│   ├── session/              ← 不变
│   └── api/
│       ├── blog/
│       │   └── reindex/
│       │       └── route.ts  ← 新增：手动触发重新索引
│       └── ...               ← 其余 API 不变
├── components/
│   ├── Navbar.tsx            ← 新增
│   ├── PostCard.tsx          ← 新增：文章卡片
│   └── MarkdownRenderer.tsx  ← 新增：MD 渲染器
└── lib/
    ├── supabase/             ← 现有
    └── blog.ts               ← 新增：博客数据查询函数
```

---

## 六、依赖新增

| 包 | 用途 |
|---|---|
| `gray-matter` | 解析 Markdown frontmatter |
| `react-markdown` 或 `next-mdx-remote` | 渲染 Markdown 内容 |
| `rehype-highlight` / `rehype-prism` | 代码块语法高亮 |
| `remark-gfm` | 支持 GitHub Flavored Markdown 表格/任务列表等 |

---

## 七、实施步骤

### 阶段 1：Supabase 侧准备
- [ ] 在 Supabase Storage 创建 `obsidian-vault` bucket（private）
- [ ] 生成 S3 Access Key / Secret
- [ ] 执行 `posts` 表 migration
- [ ] 配置 RLS 策略

### 阶段 2：Obsidian 同步配置
- [ ] 安装 remotely-save 插件，配置 S3 端点指向 Supabase Storage
- [ ] 测试同步，确认 `.md` 文件出现在 `obsidian-vault` bucket 中
- [ ] 约定 frontmatter 规范（title / date / tags / published）

### 阶段 3：博客后端
- [ ] 实现 `/api/blog/reindex` 接口（读 Storage → 解析 frontmatter → upsert posts 表）
- [ ] 实现 `lib/blog.ts`（`getPosts`、`getPostBySlug`、`getPostsByTag`）

### 阶段 4：前端重构
- [ ] 新增全局 `Navbar` 组件，改造 `app/layout.tsx`
- [ ] 重构 `app/page.tsx` 为博客文章列表
- [ ] 新增 `app/blog/[slug]/page.tsx` 文章详情页（含 Markdown 渲染）
- [ ] 新增 `app/blog/tags/[tag]/page.tsx` 标签筛选页

### 阶段 5：验收
- [ ] 在 Obsidian 写一篇带 `published: true` 的笔记，同步后触发 reindex，确认博客首页出现该文章
- [ ] 验证文章详情页代码高亮、图片（Storage URL）、内链渲染正常
- [ ] 验证 Navbar 工具模块跳转正常

---

## 八、注意事项

1. **图片处理**：Obsidian 中的图片附件也会同步到 Storage。文章中的图片引用路径需要转换为 Supabase Storage 公开 URL，reindex 接口处理时需做路径替换。

2. **隐私隔离**：`obsidian-vault` bucket 设为 private，Next.js 用 Service Role Key 读取文件内容，前端永远不直接暴露 bucket 访问权限。

3. **slug 生成规则**：建议以文件名（去掉 `.md`）作为 slug，如 `my-first-post.md` → slug `my-first-post`。frontmatter 可显式指定覆盖。

4. **现有功能零影响**：wardrobe、session、所有 API routes 完全不受此次改造影响。

5. **SEO**：博客页面建议使用 Next.js `generateStaticParams` + `revalidate` 实现 ISR（增量静态再生），兼顾 SEO 和内容时效性。
