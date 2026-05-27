# Calorie Agent Plan

## 本轮执行边界

- [x] 固定通用 agent runtime 的放置点与命名空间
- [x] 落地 runtime 环境配置与目录准备骨架
- [x] 落地 Node-only 的 runtime health 接口
- [-] 执行 agy 最小 smoke test（已验证隔离 HOME 会触发登录；默认 HOME 下识图结果待复测）
- [x] 完成知识库 Markdown -> JSON 导出脚本与 JSON 资产生成
- [x] 收束到阶段 2：通用与 calorie 数据模型迁移文件已落地

本轮到此为止：已完成 Phase 1、Phase 2、Phase 3、Phase 4 与 Phase 5。下一轮转入 live agy / 数据库联调，并继续收束 Phase 6 的状态流细节。

## Phase 0 运行时边界

- [x] 新增通用 runtime 配置模块，集中管理 `AGY_BIN`、`AGY_UPLOAD_ROOT`、`AGY_HOME_ROOT`、`AGY_TIMEOUT_MS`、`AGY_MAX_CONCURRENCY`
- [x] 明确 agy 相关接口运行在 Node.js runtime
- [x] 新增 `/api/agents/runtime/health` 作为最小可执行诊断入口
- [-] 完成 agy 图片读取 smoke test
- [x] 补充部署/环境变量说明

说明：本轮 smoke test 已执行。结论是“隔离 HOME 需要认证 bootstrap”已经被证实，但图片识别结果尚未在当前会话中稳定返回，因此保留为 `[-]`，下一轮继续复测。

## Phase 1 知识库运行时资产

- [x] 设计 calorie 知识库 JSON 结构
- [x] 编写 Markdown -> JSON 导出脚本
- [x] 生成知识库版本号与 hash
- [x] 提供服务端加载器

## Phase 2 通用与 calorie 数据模型

- [x] 落地 `agent_threads`
- [x] 落地 `agent_messages`
- [x] 落地 `agent_attachments`
- [x] 落地 `agent_runs`
- [x] 落地 `calorie_day_logs`
- [x] 落地 `calorie_meals`
- [x] 落地 `calorie_entries`
- [x] 落地 `calorie_reference_overrides`

说明：阶段 2 当前完成的是 Supabase migration 文件编写，尚未实际 apply 到数据库实例。

## Phase 3 通用 runtime 服务层

- [x] 定义 runtime service 接口与输入输出契约
- [x] 实现附件物化到本地目录
- [x] 实现 agy 执行器
- [x] 实现结构化输出解析与校验
- [x] 实现运行审计与失败重试

说明：本轮已新增 runtime contracts、repository、attachments、executor、registry、service，并把 calorie workspace adapter 接入统一 registry。当前仍缺 live agy 成功样本与生产级队列，但 Phase 3 的代码骨架已可调用。

## Phase 4 HTTP API

- [x] 实现 `/api/agents/threads`
- [x] 实现 `/api/agents/threads/[id]`
- [x] 实现 `/api/agents/threads/[id]/attachments`
- [x] 实现 `/api/agents/threads/[id]/messages`
- [x] 实现 `/api/agents/runs`
- [x] 实现 `/api/agents/runs/[id]`
- [x] 实现 `/api/calorie/workspaces`
- [x] 实现 `/api/calorie/workspaces/[id]/messages`
- [x] 实现 `/api/calorie/days/[date]`
- [x] 实现 `/api/calorie/runs/[id]/commit`
- [x] 实现 `/api/calorie/reports`

说明：通用 route 已收束为 service 的薄封装；`/api/agents/runs/[id]` 同时支持 GET 与 retry POST。calorie 域 route 已覆盖 workspace message -> run -> draft -> commit -> day/report 读取。

## Phase 5 页面与交互

- [x] 实现 `/calorie` 今日工作台
- [x] 实现 `/calorie/day/[date]` 单日详情页
- [x] 实现 `/calorie/reports` 报表页
- [x] 打通聊天流、图片流、草稿确认流

说明：本轮已完成 Phase 5 的页面层。当前站内已有三个入口页和一套统一视觉语言：`/calorie` 工作台负责消息、图片上传、草稿确认与今日摘要；`/calorie/day/[date]` 负责单日账页；`/calorie/reports` 负责趋势与来源拆解。按你的要求，本轮未补自动化测试，只做了窄范围 lint/诊断验证。

## 本轮新增实现锚点

- `lib/agent-runtime/config.ts`
- `app/api/agents/runtime/health/route.ts`
- `scripts/export-calorie-db.ts`
- `lib/calorie/knowledge.ts`
- `ClaudeDesign/calorie/calorie-db.json`
- `ClaudeDesign/calorie/runtime-env.md`
- `supabase/migrations/20260527193000_agent_runtime_and_calorie_tables.sql`
- `lib/agent-runtime/contracts.ts`
- `lib/agent-runtime/repository.ts`
- `lib/agent-runtime/attachments.ts`
- `lib/agent-runtime/executor.ts`
- `lib/agent-runtime/registry.ts`
- `lib/agent-runtime/service.ts`
- `lib/calorie/agent.ts`
- `lib/calorie/service.ts`
- `app/api/agents/threads/*`
- `app/api/agents/runs/*`
- `app/api/calorie/workspaces/*`
- `app/api/calorie/days/[date]/route.ts`
- `app/api/calorie/runs/[id]/commit/route.ts`
- `app/api/calorie/reports/route.ts`
- `app/calorie/page.tsx`
- `app/calorie/day/[date]/page.tsx`
- `app/calorie/reports/page.tsx`
- `components/calorie/CalorieWorkspace.tsx`
- `components/calorie/CalorieWorkspace.module.css`
- `components/calorie/CalorieDayDetail.tsx`
- `components/calorie/CalorieDayDetail.module.css`
- `components/calorie/CalorieReports.tsx`
- `components/calorie/CalorieReports.module.css`
- `components/calorie/client.ts`

## 下一轮建议起点

从联调收口开始：1) live agy 图片链路复测；2) migration apply 后的数据库真机验证；3) 视联调结果补 Phase 6 的草稿编辑/撤回/重提交流。