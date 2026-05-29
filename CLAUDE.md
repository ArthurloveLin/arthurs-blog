# CLAUDE.md

Claude Code agent instructions.

> **Read `AGENT.md` first.** It contains all shared project conventions: architecture, data layer, coding rules, git policy, commands, worktree rules, Supabase migrations, and deployment. Everything below is Claude-specific.

---

## Module-level docs

- [`components/note-board/CLAUDE.md`](components/note-board/CLAUDE.md) — Note Board / Guestbook module: shell architecture, filter state flow, card component split, NoteActionButton convention, color theming.
- [`app/blog/CLAUDE.md`](app/blog/CLAUDE.md) — Blog module: `unstable_cache` TTL constraints, reindex delta detection, CF cache purge.
- [`components/recipe/CLAUDE.md`](components/recipe/CLAUDE.md) — Recipe module: book-shell theme switching, right-panel overlay context, revision system, skill graph.
- [`workers/engagement-worker/CLAUDE.md`](workers/engagement-worker/CLAUDE.md) — engagement-worker: routes, CommentRateLimiterDO, thread cache, dead code warnings.
- [`workers/cloudflare-worker/CLAUDE.md`](workers/cloudflare-worker/CLAUDE.md) — cloudflare-worker (spotify-sync-worker): public API routes, sync workflow, cron schedule.
- [`components/spotify/CLAUDE.md`](components/spotify/CLAUDE.md) — Spotify dashboard: server-vs-client data layers, pagination hook, poster system, tag component imports.
- [`workers/genius-worker/CLAUDE.md`](workers/genius-worker/CLAUDE.md) — genius-worker: 执行流程、Genius 非标 JSON 解析、歌词多步清理顺序、KV 缓存策略。
- [`workers/spotify-now-playing-worker/CLAUDE.md`](workers/spotify-now-playing-worker/CLAUDE.md) — now-playing worker: 内存 token 缓存、播放状态感知 Cache-Control、强制刷新绕过。
- [`app/session/CLAUDE.md`](app/session/CLAUDE.md) — Session 模块: 模板系统、custom 模板维度约束（3–6 个）、template_config 仅在 custom 时传入。
- [`components/life-gallery/CLAUDE.md`](components/life-gallery/CLAUDE.md) — Life Gallery: 5 层叠卡时序常量耦合、canvas 取色竞态保护、mod 环形导航。
- [`components/now-watching/CLAUDE.md`](components/now-watching/CLAUDE.md) — Now Watching: prefetchedRef 预加载策略、GSAP 视差列选择、IntersectionObserver 触底。
- [`app/memo/CLAUDE.md`](app/memo/CLAUDE.md) — Memo 页面: 流式 Suspense 分层、force-dynamic 原因、三源配置融合优先级。

---

## Living Documentation

This project uses a three-layer system. Claude is expected to actively maintain all three.

| Layer | Location | Purpose |
|---|---|---|
| Memory | `~/.claude/projects/.../memory/` | User preferences, session feedback, cross-session project state |
| Root CLAUDE.md | This file | Claude-specific conventions and sub-module index |
| Sub-module CLAUDE.md | `<module>/CLAUDE.md` | Module-specific non-obvious patterns |

Shared project conventions (architecture, git policy, coding rules) live in `AGENT.md` — update them there, not here.

### What is worth documenting

Write when you discover or establish:
- A pattern that cannot be derived by reading the code
- A convention decided in this session (naming, structure, visual rules)
- A hard constraint or banned alternative that would trip up a future Claude
- A stale entry — update or remove it immediately, never leave contradictory entries side by side

Do not document: things derivable from code reading, git history, ephemeral task state, or anything already captured elsewhere.

### Documentation decision gate (required before creating any CLAUDE.md)

Before writing a new sub-module CLAUDE.md — or adding a section to an existing one — **say out loud**:

> "If a Claude read only the source files, would it make a wrong decision here?"

- **Yes** → write it. State specifically what wrong decision would be made.
- **No / Unsure** → don't write it. Check if a code comment in the source file is the better home.

Two common failure modes to avoid:
1. **Re-explaining code** — documenting what `if (length >= 6) return` already enforces.
2. **Documenting comments** — if the source file already has comments explaining the design decision, a CLAUDE.md that paraphrases them adds maintenance cost with no benefit.

### When to propose documentation

- **Mid-task** — when a non-obvious pattern surfaces or a new convention is established, capture it then, not at the end.
- **After exploring a module** — apply the decision gate before asking whether a sub-module CLAUDE.md should be created.
- **After completing a significant task** — close with: "Should I document any findings from this session?"

### Sub-module CLAUDE.md checklist

A good sub-module CLAUDE.md answers four questions:
1. What does each file own? (brief file map)
2. What are the non-obvious architectural decisions?
3. What are the hard constraints? (must-use patterns, banned alternatives)
4. What would a future Claude naturally get wrong here?

---

## Claude-Specific Conventions

### Time Estimates

Use Claude's execution speed as the reference — not human hours. A task that takes a human 2 hours might take Claude 5 minutes. Express estimates in Claude-minutes or Claude-sessions.

### Think Before Coding

Before implementing, **state your interpretation** if a request could be read multiple ways. Don't pick silently — present the options and confirm. (See also: High-Blast-Radius Zones in `AGENT.md`.)

### Worktree creation (Claude only)

**Do not create a git worktree by default.** Work directly in the current checkout. Only create one when the user **explicitly** asks (e.g., "用 worktree", "新建 worktree", "in a worktree"). Spawning a sub-agent does not by itself imply a worktree.

When explicitly asked, create it under the sibling `arthurs-blog.worktrees/` directory — never inside the repo and never elsewhere:

```bash
git worktree add ../arthurs-blog.worktrees/<slug> -b feat/<scope>-<slug>
```

This governs only *when and where Claude creates* worktrees. The shared rules for working *inside* a worktree (branch naming, contention zones, migration serialization, completion protocol) live in `AGENT.md` § Parallel Worktree Development and still apply.
