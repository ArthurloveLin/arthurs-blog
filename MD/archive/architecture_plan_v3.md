
# 项目架构规划 v3：个人博客 + Obsidian 同步

> 规划日期：2026-04-02（存储层于 2026-04-03 从 Supabase Storage 迁移至 Cloudflare R2）  
> 目标：将 Hub 首页重构为个人博客，Obsidian 笔记通过 Cloudflare R2 同步，两个工具模块迁移至导航栏

---

## 一、现状 vs 目标

| 维度 | 现状 | 目标 |
|---|---|---|
| 首页 | 两张模块卡片（Hub） | 个人博客（文章列表） |
| 导航 | 无 | 顶部 Navbar，内含两个工具模块入口 |
| 笔记存储 | Obsidian 本地 + 坚果云 WebDAV | Obsidian 本地 + Cloudflare R2（S3 兼容，中文文件名友好） |
| 博客数据源 | 无 | Cloudflare R2（存 .md 文件） + Supabase DB（存索引） |

---

## 二、Obsidian 同步方案

### 核心原理

Cloudflare R2 原生支持 AWS S3 兼容 API（签名 v4），对 UTF-8 文件名（含中文）支持完整，解决了 Supabase Storage 中文文件名同步异常的问题。  
Obsidian 社区插件 **remotely-save** 原生支持 S3 兼容服务，无需开发任何代码。

```
Obsidian（本地写作）
  └── remotely-save 插件（S3 模式）
       └── Cloudflare R2（obsidian-vault bucket）
            └── Next.js 博客读取 .md 文件并渲染
```

### remotely-save 配置参数

| 参数 | 值 |
|---|---|
| Service | S3 or S3-compatible |
| Endpoint | `https://<account-id>.r2.cloudflarestorage.com` |
| Region | `auto` |
| Access Key ID | R2 Access Key ID |
| Secret Access Key | R2 Secret Access Key |
| Bucket Name | `obsidian-vault` |
| Path Style | Force path style（勾选） |

> R2 密钥在 Cloudflare Dashboard → R2 → Manage R2 API Tokens 中生成。  
> Account ID 在 Cloudflare Dashboard 右侧边栏可找到。  
> **迁移原因**：Supabase Storage 对中文文件名 `.md` 支持异常，R2 完整支持 UTF-8 对象 key。

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

### 方案：R2 存文件 + Supabase DB 存索引（推荐）

直接读取 R2 中的所有 `.md` 文件性能差、成本高。引入一张轻量的 `posts` 索引表解决：

```
Cloudflare R2 (obsidian-vault/)
  └── 触发器/定时任务 → 解析 frontmatter → 写入 posts 表（Supabase DB）

Next.js 博客
  └── 查询 posts 表（列表页、标签筛选）—— Supabase DB
  └── 读取 R2 中的 .md 文件（文章详情页）—— AWS SDK v3 + R2 endpoint
```

### 新增 Supabase 表：`posts`

```sql
create table posts (
  id           uuid primary key default gen_random_uuid(),
  slug         text unique not null,          -- URL 路径，如 my-first-post
  title        text not null,
  summary      text,                          -- 摘要（frontmatter excerpt 或自动截取）
  tags         text[] default '{}',
  r2_key       text not null,                 -- R2 中的对象 key（原文件名，含中文亦可）
  published    boolean default false,
  published_at timestamptz,
  updated_at   timestamptz default now()
);

-- 仅暴露已发布文章给匿名用户
alter table posts enable row level security;
create policy "公开已发布文章" on posts
  for select using (published = true);
```

> 字段名从 `storage_path` 改为 `r2_key`，语义更准确，值为 R2 对象 key（如 `博客/我的第一篇文章.md`）。

### 索引同步触发方式（三选一）

| 方式 | 适合场景 | 复杂度 |
|---|---|---|
| **手动触发**：访问 `/api/blog/reindex` 接口 | 写完文章后手动刷新 | ★☆☆ |
| **GitHub Actions 定时任务**：每小时用 AWS SDK 扫描 R2 变化 | 无需手动操作 | ★★☆ |
| **Cloudflare R2 Event Notifications + Worker** | 上传即触发，近实时 | ★★★ |

> **建议起步使用手动触发**，后续升级为 R2 Event Notifications + Cloudflare Worker 方式。

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
│       │       └── route.ts  ← 新增：手动触发重新索引（读 R2 → 解析 frontmatter → upsert Supabase posts 表）
│       └── ...               ← 其余 API 不变
├── components/
│   ├── Navbar.tsx            ← 新增
│   ├── PostCard.tsx          ← 新增：文章卡片
│   └── MarkdownRenderer.tsx  ← 新增：MD 渲染器
└── lib/
    ├── supabase/             ← 现有（仅用于 DB 操作）
    ├── r2.ts                 ← 新增：R2 client（@aws-sdk/client-s3 + R2 endpoint）
    └── blog.ts               ← 新增：博客数据查询函数（列表从 Supabase DB，文件从 R2）
```

---

## 六、依赖新增

| 包 | 用途 |
|---|---|
| `gray-matter` | 解析 Markdown frontmatter |
| `react-markdown` 或 `next-mdx-remote` | 渲染 Markdown 内容 |
| `rehype-highlight` / `rehype-prism` | 代码块语法高亮 |
| `remark-gfm` | 支持 GitHub Flavored Markdown 表格/任务列表等 |
| `shadcn/ui` | Admin UI 组件（表格、按钮、表单等） |
| `next-themes` | 暗色 / 亮色 / 多主题切换 |
| `@aws-sdk/client-s3` | 连接 Cloudflare R2（S3 兼容），读取 .md 文件与附件 |

---

## 七、实施步骤

### 阶段 1：Cloudflare R2 准备
- [x] 在 Cloudflare Dashboard 创建两个 R2 bucket：
  - `obsidian-vault`（私有，存博客 .md 文件）
  - `wardrobe-images`（公开访问，存选衣图片）
- [x] 生成 R2 API Token（Access Key ID + Secret Access Key），权限：Object Read & Write（两个 bucket 共用同一组密钥即可）
- [x] 为 `wardrobe-images` bucket 开启公开访问（或绑定自定义域名），获取公开 base URL
- [x] （可选）为 `obsidian-vault` 绑定自定义域名，供博客内嵌图片附件公开访问
- [x] 执行 Supabase `posts` 表 migration（字段 `r2_key` 替代原 `storage_path`）
- [x] 配置 RLS 策略
- [x] 在项目 `.env.local` 中新增环境变量：
  ```
  R2_ACCOUNT_ID=6748757663e36aa566fa418d53cce8a4
  R2_ACCESS_KEY_ID=ccc369d76d7c4afa0e7d243b8e01484f
  R2_SECRET_ACCESS_KEY=756735d2fbd3b668d31495b1bb9a148e5be8124823a024829d3af9b360e9740d
  R2_BLOG_BUCKET=obsidian-vault
  R2_WARDROBE_BUCKET=wardrobe-images
  R2_WARDROBE_PUBLIC_URL=images.arthurlovegrace.top     # wardrobe-images 的公开 base URL，用于拼接 image_url
  R2_BLOG_PUBLIC_DOMAIN=obsidian.arthurlovegrace.top      # 可选，obsidian-vault 绑定自定义域后填写
  ```

### 阶段 2：Obsidian 同步配置
- [x] 安装 remotely-save 插件，配置 S3 端点指向 Cloudflare R2
  - Endpoint: `https://<account-id>.r2.cloudflarestorage.com`
  - Region: `auto`
  - 勾选 Force path style
- [x] 测试同步，确认中文名 `.md` 文件正常出现在 R2 bucket 中
- [x] 约定 frontmatter 规范（title / date / tags / published）

### 阶段 3：博客后端
- [x] 新增 `lib/r2.ts`：初始化 S3Client 指向 R2 endpoint，导出 `getR2Object`、`listR2Objects`、`putR2Object`、`deleteR2Object` 工具函数（博客和 wardrobe 共用）
- [x] 实现 `/api/blog/reindex` 接口（ListObjectsV2 读 R2 → 下载 .md → 解析 frontmatter → upsert Supabase posts 表）
- [x] 实现 `lib/blog.ts`（`getPosts`、`getPostBySlug`、`getPostsByTag`；列表查 Supabase DB，文件内容读 R2）

### 阶段 3.5：wardrobe 图片迁移至 R2

> wardrobe 的业务数据（items、sessions、ratings 等）继续留在 Supabase DB，只把图片文件从 Supabase Storage 迁移到 R2 `wardrobe-images` bucket。

**代码改动（3 个文件）：**
- [x] `app/api/items/route.ts`（上传）：将 `supabaseAdmin.storage.from('wardrobe').upload(...)` 替换为 `putR2Object`（来自 `lib/r2.ts`），`image_url` 改为 `${R2_WARDROBE_PUBLIC_URL}/${imagePath}` 拼接
- [x] `app/api/items/[id]/route.ts`（单删）：将 `supabaseAdmin.storage.from('wardrobe').remove([image_path])` 替换为 `deleteR2Object`
- [x] `app/api/items/bulk-delete/route.ts`（批删）：同上，批量调用 `deleteR2Object`

**数据迁移（存量图片）：**
- [x] 编写一次性迁移脚本：从 Supabase Storage `wardrobe` bucket 列出所有文件 → 下载 → 上传到 R2 `wardrobe-images` bucket（key 保持 `{sessionToken}/{itemId}.webp` 格式不变）
- [x] 用新的 R2 公开 URL 批量更新 `items` 表的 `image_url` 字段（`image_path` 字段值不变，仅 URL 前缀变更）
- [x] 验证所有存量图片可正常访问后，删除 Supabase Storage `wardrobe` bucket 中的文件

### 阶段 4：前端重构
- [x] 新增全局 `Navbar` 组件，改造 `app/layout.tsx`
- [x] 重构 `app/page.tsx` 为博客文章列表
- [x] 新增 `app/blog/[slug]/page.tsx` 文章详情页（含 Markdown 渲染）
- [x] 新增 `app/blog/tags/[tag]/page.tsx` 标签筛选页

### 阶段 5：验收 & 自动触发 reindex

#### 5.1 功能验收
- [x] 在 Obsidian 写一篇带 `published: true` 的**中文名**笔记，同步后触发 reindex，确认博客首页出现该文章
- [x] 验证文章详情页代码高亮、Markdown 渲染正常
- [x] 验证 Navbar 工具模块跳转正常
- [x] 验证 wardrobe 模块：上传新图片存入 R2，URL 可正常访问；删除 item 同步从 R2 移除文件


---

## 八、后台管理与主题方案

### 决策：自行 Vibe Coding，而非引入现成 CMS

**不采用 Ghost / Payload 等现成架构的原因：**
- Obsidian → R2 写作流程会被打断，两套内容系统冲突
- Wardrobe、News Aggregation 等工具难以与独立 CMS 共存于同一 Next.js 项目
- Supabase DB + Cloudflare R2 已承担后端职责，引入 CMS 框架是重复建设

**自行实现所需新增内容有限：**
- Admin panel = 对现有 `posts` 表的 CRUD + 发布状态管理，用 shadcn/ui 搭几个页面即可
- 主题切换 = CSS 变量 + `next-themes`，数十行代码

### 新增依赖

| 包 | 用途 |
|---|---|
| `shadcn/ui` | Admin UI 组件（表格、按钮、表单等） |
| `next-themes` | 暗色 / 亮色 / 多主题切换 |

### 新增路由

| URL | 说明 |
|---|---|
| `/admin` | 文章管理（列表、发布/下线、手动触发 reindex） |
| `/admin/posts/[slug]` | 单篇文章详情与状态操作 |

> Admin 路由需加中间件鉴权（Supabase Auth 或简单 token），避免公开暴露。

### 主题实现思路

用 CSS 变量定义设计 token（颜色、字体），`next-themes` 负责在 `<html>` 上切换 `data-theme` 属性，配合 Tailwind 的 `dark:` 前缀或自定义 CSS 变量即可支持多套主题，无需改动组件逻辑。

---

## 九、Obsidian 工作流已知痛点与缓解方案

> 本节记录该方案的固有局限，供后续迭代参考。

### 痛点一：同步状态不透明

**问题**：remotely-save 同步成功 ≠ 博客已更新，中间还需 reindex 步骤，写完文章不确定"到底发没发出去"。

**缓解**：
- Admin 页面展示 `posts` 表最新同步时间与文章状态
- 提供一键 reindex 按钮，消除"不知道有没有生效"的心智负担
- 后续可升级为 R2 Event Notifications + Cloudflare Worker，实现上传即触发

### 痛点二：`published: true` 机制脆弱

**问题**：忘写 frontmatter、手滑拼错，文章静默不发布，排查成本高。

**缓解**：
- 在 Obsidian 中创建**文章模板**（Templates 插件），预填所有必要 frontmatter 字段
- reindex 接口对缺少 `title` 或 `published` 字段的文件记录警告日志，Admin 页面展示"异常文件"列表

### 痛点三：Obsidian Markdown 与 Web Markdown 不兼容

**问题**：Wiki 链接 `[[note]]`、Callout 语法、Dataview 查询等在网页端全部失效，写作时需时刻留意。

**缓解**：
- 明确约定**博客专用写法规范**（见下表），与个人笔记目录分开存放
- `[[note]]` 内链：reindex 时可选择性转换为站内链接 `/blog/[slug]`，或直接忽略

| 语法 | Obsidian 支持 | Web 支持 | 建议 |
|---|---|---|---|
| 标准 Markdown | ✅ | ✅ | 优先使用 |
| Wiki 链接 `[[]]` | ✅ | ❌ | 博客文章中避免，或 reindex 时转换 |
| Callout `> [!note]` | ✅ | 需自定义 | 可用 remark 插件支持 |
| Dataview | ✅ | ❌ | 博客文章中禁用 |
| GFM 表格 / 任务列表 | ✅ | ✅（remark-gfm） | 正常使用 |

### 痛点四：图片路径问题

**问题**：Obsidian 内部图片引用（相对路径或 `![[image.png]]`）在 Web 端路径失效。

**缓解**：reindex 接口做路径替换，将本地引用转为 R2 公开域名 URL（需为 bucket 绑定自定义域或使用 R2 public URL）。附件与 `.md` 文件一同通过 remotely-save 上传到同一 bucket 即可。

### 痛点五：多设备同步冲突

**问题**：换设备或重装 Obsidian 后同步历史可能丢失，多设备同时编辑存在冲突风险。

**缓解**：
- Cloudflare R2 作为单一数据源，设备本地只是缓存，重装后重新同步即可恢复
- 避免多设备同时编辑同一文件；冲突文件会以带时间戳的副本形式保留，需手动合并

---

## 十、注意事项

1. **图片处理**：Obsidian 中的图片附件也会同步到 R2。文章中的图片引用路径需要转换为 R2 公开 URL（通过绑定自定义域或开启 R2 public access），reindex 接口处理时需做路径替换。

2. **隐私隔离**：`obsidian-vault` bucket 不开启全局公开访问，Next.js 用 R2 API Token 在服务端读取 `.md` 文件内容；图片附件可放在独立 public 子路径或单独 bucket 以便直接访问。

3. **slug 生成规则**：建议以文件名（去掉 `.md`）作为 slug，中文文件名做 URL encode 或在 frontmatter 显式指定英文 slug 覆盖（推荐后者）。

4. **现有功能零影响**：wardrobe、session、所有 API routes 完全不受此次改造影响。

5. **SEO**：博客页面建议使用 Next.js `generateStaticParams` + `revalidate` 实现 ISR（增量静态再生），兼顾 SEO 和内容时效性。
