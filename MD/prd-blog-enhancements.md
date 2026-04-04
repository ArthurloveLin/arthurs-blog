# 博客增强功能产品需求文档 (PRD)

## 概述
本文档概述了打造现代化、成熟博客体验所需的后端功能。

---

## 第一阶段：核心功能（优先级：高）

### 1.1 深色模式持久化
**描述**：在不同会话中保留用户的主题偏好
**需求**：
* 将主题偏好存储在 Supabase 用户个人资料（需要身份验证）或 localStorage 中
* 提供基于用户偏好的服务端主题检测
* 在所有页面同步主题
**技术细节**：
* 在 Supabase 中创建 `user_preferences` 表
* API 接口：`POST /api/user/preferences` (保存主题)
* API 接口：`GET /api/user/preferences` (获取已保存的偏好)

### 1.2 博客搜索功能
**描述**：所有已发布文章的全文搜索
**需求**：
* 支持按标题、内容、标签搜索
* 在搜索结果中高亮显示匹配词
* 搜索结果分页
* 搜索建议/自动补全
**技术细节**：
* 使用 Supabase 全文搜索或外部搜索服务 (Algolia/Meilisearch)
* API 接口：`GET /api/blog/search?q={query}&page={page}`
* 在 Supabase 中创建 `blog_search` 视图/函数
* 考虑添加搜索索引触发器以实现实时更新

---

## 第二阶段：内容功能（优先级：中）

### 2.1 特色图片 (封面图)
**描述**：为博客文章添加封面图片
**需求**：
* 在 posts 表中存储特色图片 URL
* 在文章卡片和详情页上展示
* 支持不同的宽高比
* 在无图片时提供占位图降级方案
**技术细节**：
* 在 `posts` 表中添加 `featured_image` 字段
* 在重新索引时从前言 (frontmatter) 中提取
* 通过 Next.js Image 组件进行图片优化
* 设计默认占位图

### 2.2 阅读时间预估
**描述**：计算并展示预估阅读时间
**需求**：
* 按平均每分钟 200-250 字计算
* 在文章卡片和详情页上展示
* 对代码块的阅读时间进行差异化考量
**技术细节**：
* 客户端计算函数
* 存储在数据库中或实时计算
* 考虑使用缓存以提升性能

### 2.3 作者信息系统
**描述**：支持带有个人资料的多作者体系
**需求**：
* 作者姓名、简介、头像
* 展示该作者所有文章的专属页面
* 在文章卡片和详情页上展示作者信息
**技术细节**：
* 创建 `authors` 表
* 在 `posts` 表中添加 `author_id` 外键
* 从前言 (frontmatter) 中提取作者信息
* API 接口：`GET /api/authors/{id}`

---

## 第三阶段：互动功能（优先级：低）

### 3.1 浏览量统计
**描述**：追踪并展示文章浏览量
**需求**：
* 每次访问增加浏览量
* 在文章卡片（可选）和详情页上展示
* 避免对同一用户（按会话/IP）的重复浏览进行计数
**技术细节**：
* 在 `posts` 表中添加 `view_count` 字段
* 通过 API 增加计数：`POST /api/blog/{slug}/view`
* 使用 Redis 或类似工具进行速率限制 (Rate limiting)
* 考虑隐私影响 (如 GDPR)

### 3.2 点赞/收藏系统
**描述**：允许用户点赞或收藏文章
**需求**：
* 展示点赞数
* 收藏文章以便稍后阅读
* 跨设备同步（需要身份验证）
**技术细节**：
* 创建 `post_likes` 表 (user_id, post_id)
* 创建 `bookmarks` 表 (user_id, post_id)
* API 接口：
    * `POST /api/posts/{id}/like`
    * `POST /api/posts/{id}/bookmark`
    * `GET /api/bookmarks` (用户的收藏列表)

### 3.3 邮件订阅 (Newsletter)
**描述**：新文章的电子邮件订阅推送
**需求**：
* 主页上的订阅表单
* 双重选择加入确认 (Double opt-in)
* 取消订阅功能
* 推送频率选项（即时、每日、每周）
**技术细节**：
* 创建 `newsletter_subscribers` 表 (email, frequency, status)
* 集成邮件服务 (如 Resend/SendGrid)
* API 接口：`POST /api/newsletter/subscribe`
* 用于发送订阅邮件的定时任务 (Scheduled job)

### 3.4 相关文章
**描述**：基于标签或内容推荐相关文章
**需求**：
* 展示 3-5 篇相关文章
* 考量标签、分类或使用相似度算法
* 性能优化（缓存）
**技术细节**：
* API 接口：`GET /api/blog/{slug}/related`
* 基于标签推荐的 Supabase 函数
* 考虑使用向量嵌入 (embedding similarity) 进行内容匹配
* 在 Redis 中缓存结果

---

## 第四阶段：高级功能（优先级：未来规划）

### 4.1 评论系统（已存在）
**状态**：✅ 已实现

### 4.2 社交分享
**描述**：社交平台的分享按钮
**需求**：
* Twitter/X, Facebook, LinkedIn, 复制链接
* 用于丰富预览的 Open Graph 标签
* 支持 Twitter Card
**技术细节**：
* 包含分享 URL 的前端组件
* 在元数据 (metadata) 中添加 OG 标签
* 添加 Twitter Card meta 标签

### 4.3 目录 (TOC)
**描述**：为长篇文章自动生成目录
**需求**：
* 从 markdown 中提取标题
* 在桌面端使用侧边栏吸顶 (Sticky)
* 平滑滚动到对应章节
* 高亮当前阅读章节
**技术细节**：
* 客户端动态生成 TOC
* 使用 Intersection Observer 追踪滚动位置
* 集成到 MarkdownRenderer 组件中

### 4.4 RSS/Atom 订阅源
**描述**：为读者提供 RSS 订阅源
**需求**：
* 包含文章全文或摘要
* 支持所有已发布的文章
* 有效的 RSS 2.0 格式
**技术细节**：
* API 接口：`/api/rss.xml`
* 动态生成 XML
* 在重新索引时更新

---

## 数据库结构变更需求

```sql
-- 用户偏好 (User Preferences)
CREATE TABLE user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  theme VARCHAR(20) DEFAULT 'system',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 作者 (Authors)
CREATE TABLE authors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  bio TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 更新 posts 表 (Update posts table)
ALTER TABLE posts
ADD COLUMN featured_image TEXT,
ADD COLUMN author_id UUID REFERENCES authors(id),
ADD COLUMN view_count INTEGER DEFAULT 0,
ADD COLUMN reading_time INTEGER;

-- 文章点赞 (Post Likes)
CREATE TABLE post_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, post_id)
);

-- 收藏 (Bookmarks)
CREATE TABLE bookmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, post_id)
);

-- 邮件订阅者 (Newsletter Subscribers)
CREATE TABLE newsletter_subscribers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  frequency VARCHAR(20) DEFAULT 'instant', -- instant, daily, weekly (即时、每日、每周)
  status VARCHAR(20) DEFAULT 'pending', -- pending, active, unsubscribed (待确认、活跃、已退订)
  confirmation_token UUID,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

---

## API 接口汇总

| 接口 (Endpoint) | 方法 | 描述 | 需要身份验证 |
| :--- | :--- | :--- | :--- |
| `/api/user/preferences` | GET/POST | 获取/设置主题偏好 | 是 |
| `/api/blog/search` | GET | 搜索文章 | 否 |
| `/api/authors/:id` | GET | 获取作者信息 | 否 |
| `/api/posts/:id/like` | POST | 点赞/取消点赞文章 | 是 |
| `/api/posts/:id/bookmark` | POST | 添加/移除收藏 | 是 |
| `/api/bookmarks` | GET | 获取用户的收藏列表 | 是 |
| `/api/newsletter/subscribe` | POST | 订阅邮件 | 否 |
| `/api/blog/:slug/view` | POST | 增加浏览量 | 否 |
| `/api/blog/:slug/related` | GET | 获取相关文章 | 否 |
| `/api/rss.xml` | GET | 获取 RSS 订阅源 | 否 |

---

## 实施优先级顺序

1.  ✅ **阶段 1.1**：深色模式持久化（UI 已就绪，需要后端配合）
2.  **阶段 1.2**：搜索功能
3.  **阶段 2.1**：特色图片
4.  **阶段 2.2**：阅读时间预估
5.  **阶段 2.3**：作者信息系统
6.  **阶段 3.1**：浏览量统计
7.  **阶段 3.2**：点赞/收藏系统
8.  **阶段 3.3**：邮件订阅
9.  **阶段 3.4**：相关文章推荐
10. **阶段 4**：高级功能

---

## 注意事项

* 所有功能都应尊重用户隐私并实施必要的安全措施。
* 针对公共 API 考虑实施速率限制 (Rate limiting)。
* 落实恰当的错误处理和数据验证。
* 在适宜的地方使用缓存以提升性能。
* 确保所有新组件均具备响应式设计 (Responsive design)。