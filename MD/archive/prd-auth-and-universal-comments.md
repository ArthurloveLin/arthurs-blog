# PRD：统一用户体系 & 通用评论模块

## 背景

当前选衣模块的评论/评分功能依赖"先选角色"的临时身份机制，耦合于选衣场景，无法复用。  
本次升级目标：引入统一用户体系，将评论模块解耦为通用组件，同时支持选衣系统和博客系统。

---

## 用户角色定义

| 角色 | 来源 | 能力 |
|------|------|------|
| **游客 (Guest)** | 未登录，系统自动分配 `guest_<uuid>` | 评论、评分 |
| **普通用户 (User)** | 注册登录后 | 评论、评分（暂与游客相同，为未来扩展保留） |
| **管理员 (Admin)** | 手动指定，存储于 Supabase | 全部操作 |

**管理员专属操作**：创建会话、上传图片、编辑服装信息、金额编辑、备注、决策选择（买/不买/待定）、分类管理。

**游客/普通用户禁止操作**：金额编辑、备注、决策选择、分类选择，以及任何会话级管理操作。

管理员账户为Arthur、Grace
密码统一为 CRLasd321
---

## 通用评论模块规格

评论组件脱离选衣特化，通过 `targetType` + `targetId` 区分评论所属场景：

```
targetType: 'wardrobe_item' | 'blog_post'
targetId:   对应资源的 UUID
```

数据库 `comments` 表新增 `target_type` 字段，保持向后兼容（历史数据补填 `wardrobe_item`）。  
评论者身份：登录用户取 `display_name`，游客取 `guest_<uuid>`（存 localStorage，会话间持久）。

---

## 分阶段执行计划

---

### 第一阶段：用户体系基础

> 目标：建立数据库用户模型与角色体系，不破坏现有功能。

- [x] **1.1 数据库：用户与角色表**
  - 新增迁移 `011_user_roles.sql`
  - 创建 `user_roles` 表：`user_id (FK → auth.users)`, `role ENUM('user','admin')`, `created_at`
  - 为管理员账号手动插入 `admin` 记录
  - 创建 `guest_sessions` 表：`guest_id UUID PK`, `created_at`（备用，核心数据存客户端）

- [x] **1.2 Supabase Auth 集成**
  - 在 Supabase 控制台启用 Email + Password 登录
  - 安装 `@supabase/ssr`，配置 `lib/supabase-server.ts` 和 `lib/supabase-client.ts`
  - 新增 `lib/auth.ts`：封装 `getCurrentUser()`、`getUserRole()` 工具函数
  - `getUserRole()` 逻辑：查 `user_roles` 表，无记录则为 `'user'`，未登录返回 `'guest'`

- [x] **1.3 游客 ID 分配**
  - 新增 `lib/guest.ts`：首次访问时在 localStorage 生成并持久化 `guest_<uuid>`
  - 游客 ID 格式：`guest_` + `crypto.randomUUID()` 前8位

- [x] **1.4 登录/注册页面**
  - 新增路由 `app/auth/login/page.tsx`（邮箱+密码）
  - 新增路由 `app/auth/register/page.tsx`
  - 登录成功后重定向回来源页
  - 页面风格与现有系统保持一致（pink 主题）

- [x] **1.5 用户状态全局注入**
  - 新增 `components/AuthProvider.tsx`（Client Component，Context）
  - 提供 `useAuth()` hook：返回 `{ user, role, guestId, isAdmin }`
  - 在 `app/layout.tsx` 中包裹 `AuthProvider`

---

### 第二阶段：权限管控

> 目标：用统一角色替换"先选角色"的旧逻辑，保护管理员专属操作。

- [x] **2.1 移除旧的"选角色"入口**
  - 定位并移除 `ItemDetail.tsx` 或其他组件中的角色选择 UI
  - 评论者身份改为从 `useAuth()` 取 `user.display_name` 或 `guestId`

- [x] **2.2 管理员操作权限封装**
  - 新增 `components/AdminOnly.tsx`：`isAdmin` 为 false 时直接返回 `null`
  - 以下组件/操作用 `AdminOnly` 包裹：
    - [x] 金额输入字段
    - [x] 备注输入字段
    - [x] 决策选择（买/不买/待定）
    - [x] 分类选择
    - [x] 图片上传入口（`UploadZone.tsx`）
    - [x] 创建新会话入口
    - [x] 归档/删除会话入口（`SessionList.tsx`）
    - [x] 编辑会话标题/备注/预算（`SessionHeader.tsx`）

- [x] **2.3 API 路由服务端鉴权**
  - 在以下 API 路由中校验 `getUserRole()` === `'admin'`，否则返回 403：
    - [x] `POST /api/sessions`（创建会话）
    - [x] `PATCH /api/sessions/[token]`（归档、编辑会话）
    - [x] `DELETE /api/sessions/[token]`（删除会话）
    - [x] `POST /api/items`（上传）
    - [x] `PATCH /api/items/[id]`（编辑金额、备注、决策、分类）
    - [x] `DELETE /api/items/[id]`（删除图片）
  - 评论 API（`POST /api/comments`）允许所有角色，仅校验 `author` 非空

---

### 第三阶段：通用评论模块

> 目标：解耦 CommentBox，使其可复用于选衣和博客。

- [x] **3.1 数据库：评论表扩展**
  - 新增迁移 `012_comments_universal.sql`
  - `ALTER TABLE comments ADD COLUMN target_type TEXT NOT NULL DEFAULT 'wardrobe_item'`
  - `ALTER TABLE comments RENAME COLUMN item_id TO target_id`（或新增 `target_id` 兼容处理）
  - 为 `(target_type, target_id)` 建立复合索引
  - 历史数据：`UPDATE comments SET target_type = 'wardrobe_item' WHERE target_type IS NULL`

- [x] **3.2 重构 CommentBox 组件**
  - 修改 Props：移除 `author`，改为从 `useAuth()` 内部获取
  - 新增 Props：`targetType: 'wardrobe_item' | 'blog_post'`，`targetId: string`
  - API 调用改为传递 `target_type` + `target_id`
  - 删除操作权限：`author === currentIdentity`（`user.display_name` 或 `guestId`）

- [x] **3.3 更新评论 API**
  - `POST /api/comments`：接收 `target_type`, `target_id`, `content`, `parent_id`，`author` 从服务端 session 或请求体（游客传 `guestId`）取
  - `GET /api/comments?target_type=&target_id=`：按 `(target_type, target_id)` 查询
  - `DELETE /api/comments/[id]`：校验请求方为评论作者或管理员

- [x] **3.4 选衣模块接入新 CommentBox**
  - 在 `ItemDetail.tsx` 中替换旧 CommentBox 用法：
    ```tsx
    <CommentBox targetType="wardrobe_item" targetId={item.id} />
    ```

---

### 第四阶段：博客评论接入

> 目标：复用通用评论模块，为博客文章添加评论功能。

- [x] **4.1 博客文章页接入 CommentBox**
  - 在 `app/blog/[slug]/page.tsx` 中引入 CommentBox：
    ```tsx
    <CommentBox targetType="blog_post" targetId={post.id} />
    ```
  - 服务端预取该文章评论列表作为 `initialComments` 传入

- [x] **4.2 博客评论计数展示**
  - 在 `PostCard.tsx` 中展示评论数
  - 新增 `lib/blog.ts` 中 `getCommentCount(postId)` 查询

---

### 第五阶段：收尾与优化

- [x] **5.1 Navbar 登录状态展示**
  - 未登录：显示"登录"入口
  - 游客：显示游客 ID 前缀（如 `游客 a3f2b1`）
  - 登录用户：显示 `display_name` + 退出按钮
  - 管理员：显示管理员标识

- [x] **5.2 RLS（Row Level Security）规则更新**
  - `comments` 表：INSERT 允许所有人（含游客走服务端 API），DELETE 仅作者或 admin
  - `items` 表：写操作仅 admin
  - `sessions` 表：写操作仅 admin

- [x] **5.3 回归测试**
  - [x] 游客可正常评论选衣 item
  - [x] 游客可正常评论博客文章
  - [x] 游客无法看到金额/备注/决策/分类编辑入口
  - [x] 管理员可执行全部操作
  - [x] 历史评论数据在选衣页正常展示

---

## 不在本期范围内

- 普通用户登录后相比游客的额外权益（待产品决策后补充）
- 评论点赞、举报功能
- 社交登录（GitHub / Google OAuth）
- 邮件通知

---

## 依赖

- `@supabase/ssr`（服务端 Auth）
- Supabase Auth（Email + Password，已内置，无需额外服务）
- 无需引入新的第三方认证库
