# 👗 Wardrobe Picks — 项目需求文档

> 每月为女友选衣的图片上传 + 打分 + 评论协作平台

---

## 项目概述

一个轻量级 Web 应用，支持双方批量上传待选衣物图片，对每件衣服进行星级评分和简短评论，结果持久保存，支持按分数排序，方便最终决策。

**技术栈**
- 前端：Next.js (App Router) + Tailwind CSS
- 后端：Next.js API Routes (Serverless)
- 数据库：Supabase (PostgreSQL)
- 图片存储：Supabase Storage
- 部署：Vercel

---

## 核心功能需求

### F1 — 会话 (Session)
每次购衣活动称为一个「会话」，例如「2025年3月选购」。

- 创建会话时输入标题（可选）和备注
- 会话有唯一分享链接，双方通过链接进入同一会话
- 无需注册登录，通过链接 token 区分会话
- 历史会话列表页，按时间倒序展示

### F2 — 批量上传图片
- 支持多选图片（`input[multiple]`）或拖拽上传
- 支持格式：JPG / PNG / WebP，单张最大 5MB
- 上传前自动压缩到 ≤ 800px 宽、质量 0.8（节省 Supabase Storage）
- 上传进度条，支持并发上传（Promise.all）
- 每件衣服对应一条 `items` 记录

### F3 — 网格展示
- 瀑布流或等高网格展示所有图片
- 每张卡片显示：图片缩略图、星级评分、评论摘要（truncate）
- 支持按「上传时间」「平均评分」排序
- 点击图片放大查看（lightbox）

### F4 — 打分与评论
- 星级评分：1 ~ 5 星（支持半星可选）
- 评分维度（二选一方案）：
  - 方案 A：单一综合评分（简单）
  - 方案 B：多维评分（颜值 / 实用 / 性价比），展示雷达图（复杂，可后期迭代）
- 每张图片支持多条评论（双方各自可评）
- 评分 + 评论实时保存（防抖 500ms）
- 乐观更新 UI（先更新界面，再保存到数据库）

### F5 — 决策标记
- 每件衣服可标记为「买」/ 「不买」/ 「待定」
- 会话页顶部显示「已选 X 件 / 总预算」（预算可设置）
- 支持导出决策结果（可选，后期迭代）

---

## 数据模型

```sql
-- 会话
sessions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title       text,
  note        text,
  token       text UNIQUE NOT NULL,  -- 分享链接 token
  budget      integer,               -- 预算（元）
  created_at  timestamptz DEFAULT now()
)

-- 衣服条目
items (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  uuid REFERENCES sessions(id) ON DELETE CASCADE,
  image_url   text NOT NULL,
  image_path  text NOT NULL,         -- Supabase Storage path
  position    integer DEFAULT 0,     -- 手动排序用
  decision    text CHECK (decision IN ('buy','skip','pending')) DEFAULT 'pending',
  created_at  timestamptz DEFAULT now()
)

-- 评分
ratings (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id     uuid REFERENCES items(id) ON DELETE CASCADE,
  author      text NOT NULL,         -- 'me' 或 '她'（由前端本地存储决定）
  score       numeric(2,1) CHECK (score >= 1 AND score <= 5),
  created_at  timestamptz DEFAULT now(),
  UNIQUE(item_id, author)
)

-- 评论
comments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id     uuid REFERENCES items(id) ON DELETE CASCADE,
  author      text NOT NULL,
  content     text NOT NULL,
  created_at  timestamptz DEFAULT now()
)
```

---

## 页面结构

```
/                         → 首页（历史会话列表 + 新建会话按钮）
/session/new              → 新建会话表单
/session/[token]          → 会话主页（网格 + 上传 + 排序）
/session/[token]/item/[id]→ 单件详情（大图 + 评分 + 评论）
```

---

## API Routes

```
POST   /api/sessions           创建会话
GET    /api/sessions           获取会话列表

GET    /api/sessions/[token]   获取会话详情 + 所有 items（含平均分）
POST   /api/items              上传单张图片（multipart/form-data）
DELETE /api/items/[id]         删除图片（同时删除 Storage 文件）

PATCH  /api/items/[id]         更新 decision / position

PUT    /api/ratings            新增或更新评分（upsert by item_id + author）
POST   /api/comments           新增评论
DELETE /api/comments/[id]      删除自己的评论
```

---

## Supabase 配置要点

### Storage Bucket
- Bucket 名：`wardrobe`
- 设置为 **public**（图片通过 CDN URL 直接访问，无需鉴权）
- 路径规则：`{session_token}/{item_id}.webp`

### RLS（Row Level Security）
- 本项目不做用户认证，RLS 策略设为：
  - 通过 `session token` 校验（在 API Route 中手动 validate，Supabase 用 service_role key 操作）
  - 或临时禁用 RLS，等用户量上来再加

---

## 阶段规划

### Phase 0 — 环境搭建（预计 30min）
- [x] `npx create-next-app@latest` 初始化项目
- [x] 安装依赖：`@supabase/supabase-js`, `@supabase/ssr`, `sharp`（图片压缩）
- [x] Supabase 项目创建，执行数据库 migration
- [x] `.env.local` 配置 `SUPABASE_URL` + `SUPABASE_ANON_KEY` + `SUPABASE_SERVICE_ROLE_KEY`
- [x] Vercel 项目创建，关联 GitHub 仓库，配置环境变量

### Phase 1 — 核心流程 MVP（预计 2-3h）
目标：能跑通「创建会话 → 上传图片 → 显示网格」

- [x] 首页：会话列表 + 新建会话按钮
- [x] 新建会话 API + 页面（生成随机 token）
- [x] 图片上传：客户端压缩 → POST 到 API Route → 上传 Supabase Storage → 写 items 表
- [x] 会话页：网格展示已上传图片（无评分，仅图片）
- [x] 部署到 Vercel，验证 Supabase 连通性

### Phase 2 — 评分与评论（预计 1-2h）
目标：打分核心交互完成

- [x] 作者身份选择（本地 localStorage 存「Arthur」/ 「Grace」）
- [x] 星级评分组件（5星，点击即保存）
- [x] 评论输入框 + 提交
- [x] 网格卡片显示平均分 + 评论数
- [x] 按评分排序功能

### Phase 3 — 决策与体验打磨（预计 1h）
目标：真实可用

- [x] 「买 / 不买 / 待定」标记按钮
- [x] 会话顶部统计栏（已选 X 件）
- [x] 图片放大 Lightbox
- [x] 上传进度条
- [x] 移动端响应式优化（主要在手机上用）
- [x] 空状态页面设计
- [x] 价格填写、按价格排序
- [x] 添加排序维度按价格排序、按arthur评分排序、按grace评分排序
- [x] 评论盖楼(评论也可以作为一层楼展开，论坛基础功能)
- [x] 评论emoji支持


### Phase 4 — 国内访问中转（Cloudflare Workers）

**背景**：`*.vercel.app` 和 `*.supabase.co` 在国内均被 GFW 封锁，需通过 Cloudflare Workers 做反向代理。
方案成本：免费（CF Workers 免费额度 10万次/天，完全够用）。

---

#### 4.1 前端中转（Vercel → CF Worker）

**目标**：用户访问你的 CF Worker 域名，Worker 将请求透传给 Vercel 部署。

**步骤**：
1. Cloudflare 控制台 → Workers & Pages → 新建 Worker
2. 命名如 `wardrobe-front`，粘贴以下代码并部署
3. 得到域名如 `wardrobe-front.your-name.workers.dev`（或绑定自定义域名）

```js
// Worker 名称建议：wardrobe-front
// 将 VERCEL_HOST 替换为你的 Vercel 部署域名（不含 https://）
const VERCEL_HOST = 'your-project.vercel.app'

export default {
  async fetch(request) {
    const url = new URL(request.url)
    url.hostname = VERCEL_HOST

    const newRequest = new Request(url.toString(), {
      method: request.method,
      headers: request.headers,
      body: request.method !== 'GET' && request.method !== 'HEAD'
        ? request.body
        : undefined,
      redirect: 'follow',
    })

    return fetch(newRequest)
  },
}
```

---

#### 4.2 后端中转（Supabase → CF Worker）

**目标**：前端发往 Supabase 的 API 请求经过 Worker 中转，绕过封锁。

**步骤**：
1. 新建第二个 Worker，命名如 `wardrobe-supabase`
2. 粘贴以下代码，将 `SUPABASE_HOST` 替换为你的项目地址（格式：`xxxx.supabase.co`）

```js
// Worker 名称建议：wardrobe-supabase
// 将 SUPABASE_HOST 替换为你的 Supabase 项目域名（不含 https://）
const SUPABASE_HOST = 'xxxxxxxxxxxx.supabase.co'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info',
}

export default {
  async fetch(request) {
    // 处理预检请求
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS })
    }

    const url = new URL(request.url)
    url.hostname = SUPABASE_HOST

    const newRequest = new Request(url.toString(), {
      method: request.method,
      headers: request.headers,
      body: request.method !== 'GET' && request.method !== 'HEAD'
        ? request.body
        : undefined,
      redirect: 'follow',
    })

    const response = await fetch(newRequest)

    // 注入 CORS 头，避免浏览器跨域报错
    const newResponse = new Response(response.body, response)
    Object.entries(CORS_HEADERS).forEach(([k, v]) => newResponse.headers.set(k, v))
    return newResponse
  },
}
```

---

#### 4.3 更新前端 Supabase 配置

部署好 `wardrobe-supabase` Worker 后，将其域名配置到环境变量，替换原来的 Supabase URL。

**Vercel 环境变量**（在 Vercel 项目设置中更新）：
```
NEXT_PUBLIC_SUPABASE_URL = https://wardrobe-supabase.your-name.workers.dev
```

`lib/supabase.ts` 代码无需改动，因为已通过环境变量注入 URL。

> ⚠️ `SUPABASE_SERVICE_ROLE_KEY` 等私钥仍正常填写原 Supabase 值，只有 URL 指向 Worker。

---

#### 4.4 操作检查清单

- [ ] 创建 `wardrobe-front` Worker，填入 Vercel host，部署并记录域名
- [ ] 创建 `wardrobe-supabase` Worker，填入 Supabase host，部署并记录域名
- [ ] 在 Vercel 环境变量中将 `NEXT_PUBLIC_SUPABASE_URL` 改为 Worker 域名
- [ ] 重新触发 Vercel 部署（让新环境变量生效）
- [ ] 用国内网络访问 CF Worker 域名，验证页面正常加载
- [ ] 验证图片上传、评分、评论功能均通过 Worker 正常工作
- [ ] （可选）在 Cloudflare 为 Worker 绑定自定义域名，替换 `*.workers.dev`

### Phase 5 — 可选增强（后续迭代）
- [ ] 多维评分（颜值 / 实用 / 性价比）+ 雷达图
- [ ] 拖拽排序图片顺序
- [ ] 导出「决定购买」清单（PDF / 截图）
- [ ] 历史会话归档、删除


---

## 非功能要求

| 项目 | 要求 |
|------|------|
| 移动端优先 | 主要使用场景是手机浏览器 |
| 图片加载 | 缩略图使用 `next/image`，懒加载 |
| 并发上传 | 多图并发，单次上传失败不阻塞其他图片 |
| 防止误删 | 删除图片前二次确认 |
| 离线友好 | 评分/评论操作网络中断时提示重试 |

---

## 文件结构参考

```
app/
  page.tsx                   # 首页（会话列表）
  session/
    new/page.tsx             # 新建会话
    [token]/
      page.tsx               # 会话主页
      item/[id]/page.tsx     # 单件详情
api/
  sessions/route.ts
  sessions/[token]/route.ts
  items/route.ts
  items/[id]/route.ts
  ratings/route.ts
  comments/route.ts
  comments/[id]/route.ts
components/
  ImageGrid.tsx
  UploadZone.tsx
  StarRating.tsx
  CommentBox.tsx
  DecisionBadge.tsx
  Lightbox.tsx
lib/
  supabase.ts                # client + server supabase 初始化
  compress.ts                # 客户端图片压缩工具
supabase/
  migrations/
    001_init.sql             # 建表 SQL
```

---

## 给 Claude Code 的提示

> 开始开发前请先完成 Phase 0 的环境搭建，并确认 Supabase 连通后再进入 Phase 1。
> 优先保证 Phase 1-3 的核心流程完整可用，Phase 4 为可选迭代项。
> 移动端优先，所有组件先考虑手机布局再适配桌面。