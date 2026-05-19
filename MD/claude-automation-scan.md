# Claude Code 自动化扫描报告

> 扫描时间：2026-05-19

## 项目技术栈画像

- **框架**：Next.js 16（启用 `viewTransition`）、React 19、TypeScript、Tailwind CSS 4
- **数据层**：Supabase（PostgreSQL + Auth + SSR）、Cloudflare R2（通过 AWS S3 SDK）
- **Workers**：6 个 Cloudflare Worker（Durable Objects）
- **前端库**：D3、GSAP、Lenis、SWR、react-markdown + KaTeX
- **CI 安全网**：无测试套件，唯一保障是 `tsc --noEmit && eslint`

## 现有配置现状

| 项 | 状态 |
|---|---|
| `.claude/settings.local.json` allow 规则 | 112 条 |
| Hooks | **零** |
| 已安装 Skills | `frontend-design`、`vercel-composition-patterns` |
| 自定义 Subagents | 无 |

---

## 建议优先级总览

| 优先级 | 类型 | 名称 |
|--------|------|------|
| ★★★ | Hook | PostToolUse 自动 lint |
| ★★★ | MCP | Supabase MCP |
| ★★☆ | Hook | PreToolUse 阻断 .env 编辑 |
| ★★☆ | MCP | context7 |
| ★★☆ | Subagent | engagement-worker-reviewer |
| ★☆☆ | Skill | deploy-worker |

---

## ⚡ Hooks

### 1. PostToolUse — 编辑 TypeScript 文件后自动 lint

**为什么**：CLAUDE.md 明确说明 lint 是唯一安全网，目前每次都靠手动触发。该 Hook 在每次 Edit/Write `.ts`/`.tsx` 文件后立即运行 `npx eslint <file>`，错误在改动时暴露，而非任务结束时才发现。

**配置位置**：`.claude/settings.json` 或 `.claude/settings.local.json`

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "file=$(echo '$CLAUDE_TOOL_INPUT' | python3 -c \"import json,sys; d=json.load(sys.stdin); f=d.get('file_path',''); print(f) if f.endswith(('.ts','.tsx')) else None\"); [ -n \"$file\" ] && npx eslint \"$file\" || true"
          }
        ]
      }
    ]
  }
}
```

---

### 2. PreToolUse — 阻断 .env.local 直接编辑

**为什么**：`.env.local` 含 Supabase service role key、Cloudflare API token、R2 凭证。历史配置记录显示曾被手动保护，改为 Hook 自动执行更可靠。

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "echo '$CLAUDE_TOOL_INPUT' | python3 -c \"import json,sys; f=json.load(sys.stdin).get('file_path',''); exit(2 if '.env.local' in f or '.env.production' in f else 0)\" || (echo 'Blocked: 禁止直接编辑 .env 文件' && exit 2)"
          }
        ]
      }
    ]
  }
}
```

---

## 🔌 MCP Servers

### 1. Supabase MCP（最高优先级）

**为什么**：频繁使用 `npx supabase db query --linked` 和迁移命令。MCP 让 Claude 直接查询 schema、执行 SQL、检查迁移状态，无需 CLI 绕行。

项目 ref 已在 CLAUDE.md 中记录：`ymdwknyxmbhckgftfena`

```bash
claude mcp add supabase -- npx -y @supabase/mcp-server-supabase@latest --project-ref ymdwknyxmbhckgftfena
```

---

### 2. context7

**为什么**：Next.js 16 和 React 19 都非常新，模型训练数据中的文档已过时（`use()` hook、`viewTransition`、Supabase SSR 新模式等）。context7 按需拉取最新官方文档。

```bash
claude mcp add context7 -- npx -y @upstash/context7-mcp
```

---

## 🤖 Subagents

### engagement-worker-reviewer

**为什么**：CLAUDE.md 明确标记 `engagement-worker` 为高爆炸半径区域——它是所有评论、反应、emoji 的**唯一写入通道**。专项子代理能在提交前发现 Durable Objects 并发 bug 和队列刷新安全问题。

**配置位置**：`.claude/agents/engagement-worker-reviewer.md`

```markdown
---
name: engagement-worker-reviewer
description: 专项审查 engagement-worker 变更。理解 Durable Objects、限速、批量评论队列，以及该 worker 作为所有评论和反应唯一写入路径的高爆炸半径性质。
---

你是 arthurs-blog 中 engagement-worker（workers/engagement-worker/）的专项审查员。
该 worker 是所有评论、反应、emoji 的唯一写入通道。

审查重点：
1. Durable Object 状态一致性——写入是否原子，读取是否可能读到过期状态
2. 限速正确性——限制是否按 guest token 生效，而非全局共享
3. 队列刷新安全性——批量操作在出错时是否会静默丢失数据
4. 任何可能导致评论无法写入的变更（整个博客的互动功能依赖此 worker）
5. 鉴权绕过风险——guest token 不能获得管理员写入路径

必须报告：高并发下可能出错的场景，以及如何回滚。
```

---

## 🎯 Skills

### deploy-worker（用户调用型）

**为什么**：6 个 Worker 各有独立的 `wrangler deploy` 流程。`/deploy-worker <name>` 技能可消除记忆路径的心智负担并标准化部署操作。

**配置位置**：`.claude/skills/deploy-worker/SKILL.md`

```markdown
---
name: deploy-worker
description: 部署指定的 Cloudflare Worker。用法：/deploy-worker <worker-name>。
disable-model-invocation: true
---

有效 worker 名称：
- engagement-worker
- cloudflare-worker
- genius-worker
- spotify-now-playing-worker
- spotify-image-proxy
- wardrobe-supabase-worker

步骤：
1. 确认 worker 名称有效
2. 执行：npm --prefix workers/<worker-name> run deploy
3. 报告部署输出及错误
```
