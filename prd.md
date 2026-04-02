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
- 国内加速：Cloudflare Workers (可选)

---

## 核心功能需求

### F1 — 会话 (Session)
每次购衣活动称为一个「会话」，例如「2025年3月选购」。

- 创建会话时输入标题（可选）和备注
- 会话有唯一分享链接，双方通过链接进入同一会话
- 无需注册登录，通过链接 token 区分会话
- 历史会话列表页，按时间倒序展示
- 支持会话归档，隐藏已完成的活动

### F2 — 批量上传图片
- 支持多选图片（`input[multiple]`）或拖拽上传
- 支持格式：JPG / PNG / WebP，单张最大 5MB
- 上传前自动压缩到 ≤ 800px 宽、质量 0.8（节省 Supabase Storage）
- 上传进度条，支持并发上传（Promise.all）
- 每件衣服对应一条 `items` 记录

### F3 — 网格展示
- 瀑布流或等高网格展示所有图片
- 每张卡片显示：图片缩略图、星级评分、评论数、价格
- 支持按「上传时间」「综合评分」「价格」「各维度评分」排序
- 点击图片放大查看（lightbox）

### F4 — 打分与评论
- 星级评分：1 ~ 5 星（支持半星可选）
- 评分维度：
  - 单一综合评分 (score)
  - 多维评分：颜值 (appearance_score) / 实用 (practicality_score) / 性价比 (value_score)
- 每张图片支持多条评论，并支持楼中楼回复 (parent_id)
- 评分 + 评论实时保存（防抖 500ms）
- 乐观更新 UI（先更新界面，再保存到数据库）

### F5 — 决策标记
- 每件衣服可标记为「买」/ 「不买」/ 「待定」
- 会话页顶部统计栏：显示已选件数和总预算进度
- 「最终清单」视图：一键筛选标记为「买」的单品

---

## 数据模型

```sql
-- 会话 (sessions)
CREATE TABLE sessions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title       text,                  -- 会话标题
  note        text,                  -- 备注
  token       text UNIQUE NOT NULL,  -- 分享链接唯一标识
  budget      integer,               -- 预算（元）
  archived    boolean DEFAULT false NOT NULL, -- 是否已归档
  created_at  timestamptz DEFAULT now()
);

-- 衣服条目 (items)
CREATE TABLE items (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  uuid REFERENCES sessions(id) ON DELETE CASCADE,
  image_url   text NOT NULL,         -- 图片公开访问 URL
  image_path  text NOT NULL,         -- Supabase Storage 内部路径
  position    integer DEFAULT 0,     -- 手动排序位置
  decision    text CHECK (decision IN ('buy','skip','pending')) DEFAULT 'pending', -- 决策状态
  price       integer,               -- 价格
  notes       text,                  -- 单品详情备注（品牌/链接等）
  category    text,                  -- 分类（如：上衣、裙子、鞋子）
  created_at  timestamptz DEFAULT now()
);

-- 评分 (ratings)
CREATE TABLE ratings (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id            uuid REFERENCES items(id) ON DELETE CASCADE,
  author             text NOT NULL,         -- 评价人（'Arthur' / 'Grace'）
  score              numeric(2,1) CHECK (score >= 1 AND score <= 5), -- 综合分
  appearance_score   numeric(2,1) CHECK (appearance_score >= 1 AND appearance_score <= 5), -- 颜值
  practicality_score numeric(2,1) CHECK (practicality_score >= 1 AND practicality_score <= 5), -- 实用
  value_score        numeric(2,1) CHECK (value_score >= 1 AND value_score <= 5), -- 性价比
  created_at         timestamptz DEFAULT now(),
  UNIQUE(item_id, author)
);

-- 评论 (comments)
CREATE TABLE comments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id     uuid REFERENCES items(id) ON DELETE CASCADE,
  parent_id   uuid REFERENCES comments(id) ON DELETE CASCADE, -- 楼中楼回复支持
  author      text NOT NULL,
  content     text NOT NULL,
  created_at  timestamptz DEFAULT now()
);
```

---

## 环境变量配置

启动任何新环境前，需在根目录创建 `.env.local`：

```env
# Supabase 基本配置
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...

# (可选) 国内访问加速
# NEXT_PUBLIC_SUPABASE_URL 可以替换为绑定的自定义域名/Worker域名
```

- `NEXT_PUBLIC_SUPABASE_URL`: Supabase API Endpoint
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: 客户端匿名访问 Key
- `SUPABASE_SERVICE_ROLE_KEY`: 服务端 Admin Key（绝对不可泄露给前端）

---

## 页面结构

```
/                         → 首页（快速进入历史或创建新会话）
/wardrobe                 → 选衣记录（完整会话列表，含归档切换）
/session/new              → 创建会话
/session/[token]          → 会话主页（网格展示、上传、打分、筛选）
/session/[token]/item/[id]→ 单品详情页（多维打分、楼中楼评论、备注编辑）
```

---

## API Routes

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/sessions` | `GET` | 获取近期会话列表 |
| `/api/sessions` | `POST` | 创建新会话 (title, note, budget) |
| `/api/sessions/[token]` | `GET` | 获取会话详情 + items (含平均分 & 评论数) |
| `/api/sessions/[token]` | `PATCH` | 更新会话属性 (title, note, budget, archived) |
| `/api/sessions/[token]` | `DELETE` | 删除会话（含级联删除 Storage 里的图片） |
| `/api/items` | `POST` | 上传单张图片并创建记录 |
| `/api/items/[id]` | `PATCH` | 更新单品 (decision, price, notes, category) |
| `/api/items/[id]` | `DELETE` | 删除单品及其 Storage 文件 |
| `/api/items/bulk-delete` | `POST` | 批量删除单品 |
| `/api/ratings` | `PUT` | 新增或更新评分 (upsert) |
| `/api/comments` | `POST` | 发布评论 (支持 parent_id) |
| `/api/comments/[id]` | `DELETE` | 删除评论 |

---

## Supabase 配置要点

### 1. Storage Bucket
- 创建名为 `wardrobe` 的 **Public** Bucket。
- **Policies**: 启用 `SELECT` 和 `INSERT` 给所有人（或基于 session token 校验）。

### 2. RLS (Row Level Security)
- 目前主要依赖 API Routes 使用 `service_role` 进行管理，前端通过 token 隔离。
- 若需更高级安全性，可配置 RLS 策略。

### 3. Realtime (可选)
- 启用 `sessions` 和 `items` 表的 Realtime 订阅，实现双人同步操作自动刷新。

---

## 文件结构参考

```
app/
├── api/                   # Serverless API 端点
├── session/
│   ├── [token]/           # 会话主页
│   │   ├── item/[id]/     # 单品详情
│   └── new/               # 新建会话
├── wardrobe/              # 记录归档页
├── globals.css            # 全局样式
├── layout.tsx             # 根布局（包含全站字体与背景）
└── page.tsx               # 首页入口
components/                # 核心 React 组件
├── ActivityBanner.tsx     # 顶部活动状态
├── ImageGrid.tsx          # 瀑布流/网格展示
├── ItemDetail.tsx         # 详情卡片
├── RealtimeSync.tsx       # 实时同步逻辑
├── UploadZone.tsx         # 压缩上传组件
└── ...
lib/
├── compress.ts            # 客户端图片压缩工具
└── supabase.ts            # Supabase 客户端初始化
supabase/
└── migrations/            # 数据库版本迁移记录
workers/                   # Cloudflare Workers 加速脚本
```

---

## 部署与迁移建议

1. **环境克隆**：在新的 Supabase 项目中运行 `supabase/migrations` 下的所有 SQL。
2. **存储初始化**：手动创建 `wardrobe` Bucket 并设置为 Public。
3. **域名加速**：若在国内访问缓慢，部署 `workers/` 目录下的脚本到 Cloudflare。
4. **移动端建议**：确保 `meta viewport` 正确，图片上传前必须进行客户端压缩以节省带宽。
