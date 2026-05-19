# 质量效能平台 · 设计与执行档案

> 性质：入职前练习项目 | 被测系统：arthurs-blog | 周期：2026-05-19 ~ 2026-06-18

---

## 一、项目定义

### 这是什么

一个独立的 Web 应用，提供测试用例管理、自动化执行、报告分析、AI 辅助生成等核心能力，以 arthurs-blog 作为被测系统验证平台功能。

### 这不是什么

- 不是 arthurs-blog 的测试套件（为 arthurs-blog 写 Vitest/Playwright 测试文件）
- 不是 GitHub Actions workflow 的简单扩展

### 与真实工作的对应

大厂质量效能团队的核心产品就是这类平台——接收被测系统的接口定义，管理用例，调度执行，出具报告，持续降低测试编写成本。arthurs-blog 在这里的角色是**被测对象**，而非平台本身。

---

## 二、系统架构

```
┌───────────────────────────────────────────────────┐
│                  测试平台 (Web App)                  │
│  ┌──────────┐ ┌──────────┐ ┌─────────┐ ┌───────┐  │
│  │ 用例管理  │ │ 执行调度  │ │ 报告看板 │ │AI生成 │  │
│  └────┬─────┘ └────┬─────┘ └────┬────┘ └───┬───┘  │
│       └────────────┴────────────┴───────────┘      │
│                    平台数据库 (Supabase)              │
└──────────────────────┬────────────────────────────┘
                       │ HTTP
              ┌────────▼────────┐
              │   执行引擎 Runner  │
              └────────┬────────┘
                       │ 发起请求
              ┌────────▼────────┐
              │   被测系统        │
              │   arthurs-blog  │
              │   (dev/staging) │
              └────────┬────────┘
                       │
              ┌────────▼────────┐
              │  GitHub Actions  │
              │  (CI 触发入口)   │
              └─────────────────┘
```

---

## 三、技术栈

| 模块 | 技术 | 理由 |
|------|------|------|
| 平台前端 + 后端 | Next.js + Tailwind | 已熟悉，聚焦领域知识而非技术学习 |
| 平台数据库 | Supabase (PostgreSQL) | 已有实例，快速建模 |
| 执行引擎 | Node.js（Next.js Route Handler） | HTTP 执行 + 结果回写同仓库 |
| AI 生成 | Claude API (claude-sonnet-4-6) | 最强代码生成；项目已有 Anthropic 上下文 |
| 报告可视化 | Recharts | 轻量，Next.js 友好 |
| CI 集成 | GitHub Actions 调用平台 Webhook | 保留现有 CI，平台作为执行层 |

---

## 四、核心模块设计

### 4.1 项目 & 环境管理

每个"项目"对应一个被测系统（本项目只有 arthurs-blog 一个）。

- 项目 CRUD（名称、描述、baseURL）
- 环境配置：dev / staging，各有独立 baseURL、全局 Headers、全局变量（如 `admin_token`，加密存储）
- 全局变量在用例中以 `{{变量名}}` 引用

### 4.2 测试用例管理

用例是平台的核心资产，结构如下：

**元信息**
- 名称、所属套件、优先级（P0 / P1 / P2）、标签、状态（草稿 / 激活）

**请求定义**
- HTTP 方法、路径（支持 `{{变量}}`）、Query Params、Headers、Body（JSON / Form）

**断言规则**（AND 关系，全部通过才算 PASS）
- 状态码断言：`status_code == 200`
- 响应字段断言：JSONPath + 操作符（equals / contains / exists / regex）
- 响应时间断言：`duration_ms < 500`

**变量提取**（供下游用例使用）
- JSONPath 表达式 → 变量名（如 `$.data.id` → `created_recipe_id`）

**前置 / 后置操作**（进阶，Week 3 后考虑）
- 前置：执行另一条用例，用于构造数据
- 后置：清理测试数据

### 4.3 测试套件管理

- 套件 = 一组有序用例，可独立执行
- 支持用例间变量传递（上游提取 → 下游 `{{变量}}`）
- 套件粒度是 CI 触发的基本单元

### 4.4 执行引擎

技术核心，处理流程：

```
接收任务（suite_id + environment_id）
  → 按序加载用例
  → 变量替换（全局变量 + 上游提取变量）
  → 发起 HTTP 请求，记录完整 req/res
  → 执行断言，标记 PASS / FAIL / ERROR
  → 提取变量，写入当前执行上下文
  → 结果写入 test_results
  → 更新 test_runs 状态
  → 触发 Webhook 回调（通知 CI）
```

**触发方式**
- 平台 UI 手动触发（选套件 + 环境）
- GitHub Actions 调用 `POST /api/trigger-run`（带 API Key）
- （进阶）定时调度

### 4.5 报告看板

**单次执行报告**
- 执行概览：总用例数、通过率、总耗时
- 用例明细：每条用例的状态、耗时、请求/响应折叠展示、断言详情
- 失败用例高亮 + 错误原因

**历史趋势（跨多次执行）**
- 通过率趋势折线图（按时间）
- 失败频率 Top N 用例排行
- 执行耗时分布

### 4.6 AI 用例生成

**三种输入来源**

| 输入 | 说明 |
|------|------|
| 自然语言 | "测试管理员创建食谱后，访客访问草稿返回 404" |
| OpenAPI / Swagger JSON | 解析接口定义，批量生成用例骨架 |
| 已有用例 + 变体指令 | "为这条用例生成边界值和异常路径变体" |

**生成流程**
1. 调用 Claude API，Prompt 包含接口 schema + 平台用例 JSON 格式
2. 生成的用例进入**草稿状态**，在平台 UI 内 inline 编辑
3. 人工 review（修改断言/路径）后点击"激活"入库
4. 记录每次生成的 Prompt + 输出，用于评估生成质量

---

## 五、数据模型

```sql
-- 核心表结构（精简版，实际迁移时展开字段）

projects        -- id, name, description, base_url, created_at
environments    -- id, project_id, name, base_url, headers_json, variables_json
test_suites     -- id, project_id, name, description, created_at
test_cases      -- id, suite_id, name, method, path, headers_json, body_json,
                --   query_params_json, assertions_json, extractors_json,
                --   priority, status[draft/active], ai_generated, created_at
test_runs       -- id, suite_id, environment_id, status[running/passed/failed/error],
                --   trigger_source[manual/ci/schedule], triggered_by,
                --   started_at, finished_at, pass_count, fail_count, total_count
test_results    -- id, run_id, case_id, status[pass/fail/error],
                --   request_json, response_json, assertions_detail_json,
                --   extracted_vars_json, duration_ms, error_message
ai_gen_logs     -- id, input_type, input_content, output_json, reviewed_at, created_at
```

---

## 六、四周执行计划

### Week 1（5/19–5/25）：数据层 + 用例管理

**目标：** 平台骨架运行，能录入和管理测试用例

| 任务 | 产出验收点 |
|------|---------|
| 初始化平台项目（独立 Next.js 仓库） | 本地 `npm run dev` 可访问 |
| 设计并建立 Supabase 表结构 | migration 文件，6 张核心表建立 |
| 项目 + 环境配置页面 | 创建 arthurs-blog 项目，配置 dev 环境 |
| 测试套件 + 用例 CRUD 页面 | 完整表单含断言、提取器字段 |
| 为 arthurs-blog 手工录入首批用例 | ≥ 10 条用例覆盖 Auth、Recipe、Comment 接口 |

---

### Week 2（5/26–6/1）：执行引擎 + 单次报告

**目标：** 用例能跑起来，结果有地方看

| 任务 | 产出验收点 |
|------|---------|
| HTTP 执行器核心逻辑 | 发请求、收响应、执行断言、标记结果 |
| 变量提取与替换（JSONPath） | 链式用例可互相传参（如先创建再查询） |
| 执行任务 + 结果入库 | `test_runs` / `test_results` 完整记录 |
| 单次执行报告页面 | 概览 + 用例列表 + 请求/响应折叠详情 |
| 执行 arthurs-blog 套件 | 点击执行，1 分钟内看到 PASS/FAIL 结果 |

---

### Week 3（6/2–6/8）：历史报告 + AI 生成

**目标：** 平台有洞察力，有 AI 辅助能力

| 任务 | 产出验收点 |
|------|---------|
| 历史趋势看板 | 多次 Run 后通过率折线图、失败 Top N 可见 |
| AI 生成：自然语言 → 用例草稿 | 输入中文描述，生成可编辑的用例结构 |
| AI 生成：OpenAPI JSON → 批量草稿 | 上传 arthurs-blog schema，批量生成 ≥ 5 条草稿 |
| 草稿 review 流程 | 草稿激活/拒绝，激活后可加入套件执行 |

---

### Week 4（6/9–6/15）：CI 集成 + 收尾

**目标：** 平台完整闭环，接入真实 CI，可演示

| 任务 | 产出验收点 |
|------|---------|
| 平台对外执行 API（API Key 鉴权） | `POST /api/trigger-run` 可被外部调用 |
| arthurs-blog GitHub Actions 集成 | PR 触发平台执行，Actions 日志可见触发成功 |
| 执行结果回调（或 GitHub Status Check） | PR 页面出现测试状态标记 |
| 整体 UI 打磨 | 完整 Demo 流程无卡顿 |
| 复盘文档 | 设计决策记录、遇到的问题、与真实平台的差距分析 |

**最终验收：** 向 arthurs-blog 推一个 PR → Actions 自动触发平台执行 → PR 页面显示测试通过/失败

---

## 七、arthurs-blog 被测套件规划

平台所有功能以这些套件作为真实数据验证。

| 套件 | 优先级 | 用例数 | 核心验证点 |
|------|-------|-------|---------|
| Auth & 权限 | P0 | 6 | `/api/me` 各角色返回值；未登录访问 admin 路由返回 403 |
| Recipe CRUD | P0 | 8 | 创建/更新/删除链式用例；slug 冲突 409；非 admin 403 |
| Comments | P1 | 5 | 速率限制；字数截断（500 字）；重复投票 upsert 行为 |
| Note Board | P1 | 4 | 8000 字限制；admin_only 可见性权限边界 |
| Blog Reindex | P2 | 3 | delta 检测触发；响应含 `cloudflare.purged > 0` |

---

## 八、进阶方向（时间充裕时）

不在主线内，但如果某周提前完成可以选做：

- **定时调度**：cron 表达式配置，定时跑冒烟套件
- **Mock 服务**：平台内配置 Mock 接口，隔离 Turnstile / Spotify 等外部依赖
- **并发执行**：多用例并发执行，记录并发场景下的异常
- **性能断言统计**：多次 Run 的 P95 响应时间趋势图

---

## 九、关键风险

| 风险 | 缓解策略 |
|------|---------|
| 执行引擎链式变量传递实现复杂 | Week 2 重点投入；先实现简单顺序执行，变量传递作为第二步 |
| arthurs-blog 部分接口需要真实 Auth Token | 环境全局变量存储 admin session token；定期手动刷新 |
| AI 生成质量不稳定 | 所有 AI 生成用例必须经过草稿 review 流程才能激活；不跳过 |
| Week 4 CI 集成依赖平台已部署（非 localhost） | Week 3 末期部署平台到可公网访问的地址（Vercel 免费层） |
