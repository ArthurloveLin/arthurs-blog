# 自动化测试平台需求档案
> 被测系统：arthurs-blog | 日期：2026-05-18 | 状态：初稿

---

## 一、背景与目标

arthurs-blog 是一个中等复杂度的全栈个人项目，当前**零测试覆盖**。系统由三层构成：

| 层次 | 技术 | 可测点密度 |
|------|------|-----------|
| Next.js 应用 (App Router) | 20+ 页面路由、40+ API 路由、React Server Components | 高 |
| Cloudflare Workers (×6) | engagement-worker (Durable Objects)、Spotify 同步、代理类 worker | 中 |
| 数据层 | Supabase (PostgreSQL + Realtime + Auth)、Cloudflare R2 | 高 |

**测试平台目标：** 在没有测试历史的系统上，从零建立可持续的质量保障体系，并充分利用 AI Agent 能力降低测试编写和维护成本。

---

## 二、测试分层架构

### L0 — 单元测试（Unit）

**范围：** `lib/` 中的纯函数、工具类、数据转换逻辑

**关键被测模块：**
- `lib/blog-search.ts` — 分词、高亮切割算法
- `lib/spotify-history-utils.ts` — 时间段分析、聚合计算
- `lib/date-format.ts`、`lib/input-limits.ts` — 纯函数
- `lib/note-priority.ts`、`lib/emoji.ts` — 枚举/映射逻辑

**工具：** Vitest（与 Next.js/Vite 生态最兼容）

**目标覆盖率：** `lib/` 纯函数 ≥ 80%

---

### L1 — 集成测试（Integration）

**范围：** API 路由 ↔ Supabase 的端到端数据流（不经过浏览器）

**关键场景：**
- Recipe CRUD + 版本快照（`/api/recipes/[slug]`、`/api/recipes/[slug]/revisions`）
- Note Board 创建/更新/删除，含权限边界（admin_only 可见性）
- Auth 三级权限判定：`getUserRole()` 返回 guest/user/admin 的各条路径
- Blog reindex delta 检测逻辑（`R2 lastModified > DB updated_at`）
- Supabase RLS 在 anon key vs service role key 下的行为差异

**基础设施需求：**
- **Supabase 分支数据库**（`npx supabase db branch` / Supabase Preview Branches）：每次测试运行独立 DB，避免污染生产
- 或：本地 Docker Supabase（`npx supabase start`）作为 CI 环境

**工具：** Vitest + `@supabase/supabase-js`（直连测试 DB）

---

### L2 — API 测试（Contract Testing）

**范围：** 所有 `app/api/` 路由的请求/响应契约，覆盖正常路径和错误路径

**优先级高的路由（高风险/高频率）：**

| 路由 | 关键断言 |
|------|---------|
| `POST /api/comments` (via engagement-worker) | 速率限制触发、500字限制、Turnstile 验证失败返回 400 |
| `POST /api/recipes` | slug 重复返回 409；非 admin 返回 403 |
| `POST /api/posts/[id]/reaction` | 重复投票的 upsert 行为；匿名身份归一化 |
| `POST /api/note-boards/[board]` | 8000 字限制；admin_only 创建权限 |
| `POST /api/items` | 非 admin 返回 403；图片上传到 R2 的路径正确 |
| `GET /api/me` | 未登录返回 guest 角色；登录后返回正确 role |
| `POST /blog/reindex` | `cloudflare` 字段存在且 `purged` > 0 |

**工具：** Vitest + `msw`（Mock Service Worker 模拟外部依赖：Turnstile、CF API）或直接 HTTP 请求（`fetch` to local Next.js dev server）

---

### L3 — E2E 测试（浏览器全链路）

**范围：** 关键用户旅程，模拟真实浏览器行为

**必测旅程（优先级 P0）：**

1. **访客评论流程** — 打开博客文章 → 写评论（<500 字）→ 提交 → 出现在列表；超 500 字被阻止
2. **管理员登录** — 访问 `/auth/login` → 填写凭证 + Turnstile → 跳转首页 → 访问 `/admin/settings` 成功
3. **未授权访问拦截** — 未登录直接访问 `/admin/settings` → 重定向 `/`
4. **Recipe 增删改** — Admin 登录 → 创建食谱 → 编辑内容 + 评分 → 发布 → 访客可见；删除后 404
5. **Note Board / Guestbook** — 访客发留言（带 Turnstile）→ 管理员归档/删除 → 列表刷新
6. **Wardrobe Session 实时同步** — 两标签页打开同一 session → 一侧添加 item → 另一侧 300ms 内自动刷新

**Turnstile 处理策略：** E2E 环境注入 Cloudflare 测试 sitekey（`1x00000000000000000000AA`），永远返回成功，无需真实 CAPTCHA。

**工具：** Playwright（Next.js 官方 E2E 推荐；支持 Server Components 测试；内置网络拦截）

---

### L4 — 视觉回归测试（Visual Regression）

**范围：** 关键页面的 UI 快照对比，捕捉意外的样式变更

**传统方案（像素级 diff）：** Playwright Screenshot + Argos / Percy

**Agent 时代升级（语义级 diff）：**
- 接入视觉 AI（如 Claude vision / GPT-4V）分析截图差异
- 输出："导航栏颜色从蓝色变为灰色" 而非 "123 像素发生变化"
- 可配置"允许内容变动，但不允许布局变动"的语义规则

**关键快照页面：** 首页、博客文章页、Recipe 页、Wardrobe session 页、Spotify 仪表盘

---

## 三、Agent 时代专属能力

这是本测试平台区别于传统测试框架的核心差异层。

### 3.1 AI 测试用例生成

**输入：** API 路由的 TypeScript 类型签名 + JSDoc + 数据库 schema
**输出：** 覆盖正常路径、边界值、异常路径的测试用例骨架代码

**实现方式：**
- Claude API（`claude-sonnet-4-6`）读取路由文件，生成 Vitest 测试文件
- 人工审核后合入仓库
- 支持"增量生成"：仅为本次 PR 新增/修改的路由生成测试

**arthurs-blog 立即可受益的模块：**
- `lib/blog-search.ts` 的分词边界用例（空字符串、全汉字、混合语言）
- `lib/spotify-history-utils.ts` 的时间段聚合计算

---

### 3.2 自愈选择器（Self-Healing Selectors）

**问题：** UI 重构后，`data-testid` 或 CSS 选择器频繁失效，测试维护成本高。

**Agent 方案：**
- 选择器失效时，Agent 截图当前页面，利用视觉模型重新定位目标元素
- 自动提 PR 更新选择器，人工 approve 合入
- 本质：用语义理解（"找到提交评论的按钮"）替代脆弱的 DOM 路径

**实现参考：** Playwright + Claude vision；或直接评估 [Shortest](https://github.com/anti-work/shortest)（基于 Claude 的 E2E 测试框架）

---

### 3.3 探索性测试 Agent（Exploratory Agent）

**描述：** 自主浏览应用、随机/有目的地触发操作，寻找未被覆盖的 bug。

**工作流：**
1. Agent 以访客身份"爬行"所有公开页面
2. 对每个表单，尝试边界输入（超长字符串、SQL 注入片段、Emoji、空值）
3. 记录 HTTP 500、未处理异常、UI 崩溃
4. 生成结构化报告：发现 → 复现步骤 → 严重等级

**arthurs-blog 高价值探索区：**
- CommentBox：尝试 XSS payload、超长嵌套引用
- Note Board 创建表单：特殊字符 author 名
- Recipe slug：URL 注入、重复 slug 的幂等性
- Wardrobe 图片上传：MIME 类型绕过测试

---

### 3.4 变更感知测试优先级（Change-Aware Prioritization）

**描述：** 每次 PR，Agent 分析 git diff → 识别受影响的模块 → 只运行相关测试套件 → 大幅降低 CI 时间。

**优先级矩阵：**

| 变更类型 | 触发的测试级别 |
|---------|-------------|
| `lib/` 纯函数 | L0 单元 |
| `app/api/` 路由 | L1 集成 + L2 API |
| `components/` UI | L3 E2E（受影响页面）+ L4 视觉快照 |
| `workers/` | Worker 专项测试 |
| `supabase/migrations/` | L1 集成（全量）|
| `lib/cloudflare-cache.ts`、`app/layout.tsx` | 全量测试（高爆炸半径）|

---

### 3.5 自然语言测试编写

**描述：** 用中文/英文描述测试意图，Agent 生成 Playwright/Vitest 代码。

**示例：**
```
输入："测试管理员可以创建食谱，但访客看不到未发布的食谱"
输出：
  test('admin can create draft recipe invisible to guests', async ({ page }) => {
    // 1. 登录管理员
    // 2. POST /api/recipes with published: false
    // 3. 登出，以访客访问 /recipe/[slug]
    // 4. 期望 404
  });
```

---

### 3.6 失败根因分析（Failure Root Cause Analysis）

**描述：** 测试失败时，Agent 自动分析失败截图 + 错误日志 + 相关源码，给出根因推断。

**输出格式：**
```
失败：test('recipe slug conflict returns 409')
根因推断：/api/recipes POST 路由在 slug 冲突时捕获了 Supabase 的 unique_violation 错误码 (23505)，
         但当前代码返回 500 而非 409。
         相关文件：app/api/recipes/route.ts:47
建议修复：在 catch 块中检查 error.code === '23505' 并返回 409。
```

---

## 四、Worker 专项测试需求

Cloudflare Workers 无法直接用 Vitest/Playwright 测试，需要专项方案。

### engagement-worker（最高优先级）

这是所有评论/反应写入的唯一通道，失败影响面广。

**测试策略：**
- 使用 `wrangler dev --local` 启动本地 worker
- 用 `miniflare` 模拟 Durable Objects
- 测试场景：速率限制（快速连续提交 → 第 N 次被 429）、敏感词过滤、评论长度截断

### cloudflare-worker（Spotify 同步）

- Mock Spotify API 响应（`msw` 或 `nock`）
- 验证 R2 写入的 JSON 结构符合 `lib/spotify-types.ts` 定义

### 其他 Worker

- `genius-worker`：Mock Genius scraper，验证缓存 hit/miss 逻辑
- `spotify-image-proxy`：验证非法域名（非 `*.scdn.co`）被拒绝（403）
- `wardrobe-supabase-worker`：验证 CORS header 注入正确

**工具：** Vitest + [Cloudflare Vitest pool](https://developers.cloudflare.com/workers/testing/vitest-integration/)（官方支持，可真实运行 Workers 运行时）

---

## 五、基础设施需求

### 5.1 测试环境隔离

| 资源 | 隔离方案 |
|------|---------|
| Supabase DB | Supabase Preview Branch（每个 PR 独立分支）或 `npx supabase start`（本地 Docker） |
| Cloudflare R2 | 独立测试 bucket（`arthurs-blog-test`） |
| Workers | `wrangler dev --local`（不触达生产 DO/KV） |
| 外部 API | msw 拦截（Turnstile、Spotify、Genius、CF Zones API） |

### 5.2 Secrets 管理

测试环境需要独立的 Secret 集合：
- `SUPABASE_TEST_URL` + `SUPABASE_TEST_SERVICE_ROLE_KEY`（测试 DB）
- `CLOUDFLARE_TURNSTILE_TEST_SECRET_KEY`（`1x0000000000000000000000000000000AA`，永远通过）
- `R2_TEST_BUCKET_NAME`

存储方式：GitHub Actions Secrets（CI）+ `.env.test.local`（本地，gitignore）

### 5.3 CI/CD 集成

```yaml
# 推荐的 GitHub Actions 流水线结构
on: [pull_request]
jobs:
  unit:        # L0 — 2分钟内
  integration: # L1 — 启动 supabase local，5分钟内
  api:         # L2 — 启动 next dev，3分钟内
  workers:     # Cloudflare Vitest pool，3分钟内
  e2e:         # L3 — Playwright，按变更范围选择性运行，10分钟内
  visual:      # L4 — 仅在 UI 文件变更时触发
```

**总 CI 目标时间：≤ 15 分钟（变更感知优化后）**

---

## 六、优先级路线图

### Phase 1 — 地基（2周）

1. 配置 Vitest + Supabase local Docker
2. 为 `lib/` 所有纯函数编写 L0 单元测试（AI 辅助生成）
3. 为 5 个最高风险 API 路由编写 L2 合约测试
4. 接入 GitHub Actions 基础流水线

**交付物：** 40+ 单元测试，5 个 API 合约测试，CI 绿灯

### Phase 2 — E2E 骨干（3周）

1. 配置 Playwright + Turnstile 测试 key
2. 实现 6 个 P0 用户旅程测试
3. engagement-worker 速率限制测试（miniflare）
4. 接入变更感知优先级逻辑

**交付物：** 6 个 E2E 场景，worker 测试套件，智能 CI

### Phase 3 — Agent 增强（持续）

1. 接入 Claude API 实现 AI 测试用例生成脚本
2. 探索性测试 Agent（定期运行，如每周）
3. 失败根因分析接入 CI 通知（Slack/邮件）
4. 评估自愈选择器方案（Shortest vs 自建）

---

## 七、关键风险与约束

| 风险 | 影响 | 缓解 |
|------|------|------|
| Supabase Realtime 测试复杂 | E2E 实时同步场景难以稳定 | Playwright 多 context 模拟多标签；加 500ms 等待断言 |
| engagement-worker Durable Objects 本地模拟不完整 | Worker 测试覆盖有盲区 | 接受此盲区，用 staging 环境做集成验证 |
| 外部 API（Spotify/Genius）不稳定 | CI 随机失败 | msw 全量拦截，不依赖真实外部 API |
| 无测试历史 → AI 生成质量不稳定 | 初期测试可信度低 | 人工 review 所有 AI 生成的测试文件后合入 |
| Turnstile bypass 仅限测试环境 | 生产 CAPTCHA 无法 E2E 覆盖 | 接受：安全控件不做 E2E 功能测试；做单元测试（verify 函数的分支） |

---

## 八、技术栈推荐汇总

| 层次 | 工具 | 选型理由 |
|------|------|---------|
| L0 单元 | **Vitest** | ESM 原生、速度快、与 Next.js/Vite 生态对齐 |
| L1 集成 | **Vitest** + Supabase local | 统一测试运行器 |
| L2 API | **Vitest** + `msw` | msw 拦截外部依赖，不影响真实路由逻辑 |
| L3 E2E | **Playwright** | Next.js 官方推荐；多 browser；强网络拦截 |
| L4 视觉 | **Playwright Screenshot** + Argos | 基础像素 diff；后期叠加视觉 AI |
| Workers | **Vitest + Cloudflare pool** | 官方支持，Workers 运行时真实 |
| AI 生成 | **Claude API** (sonnet-4-6) | 当前最佳代码生成能力；本项目已有 Anthropic 上下文 |
| 探索性测试 | **Playwright MCP** + Claude agent | 浏览器工具调用链；无需额外框架 |
