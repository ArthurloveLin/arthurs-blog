## Plan: Blog Engagement 评论边缘队列

新增名为 blog-engagement 的 Cloudflare Worker，只接管 /api/comments* 这组评论接口：在边缘先做敏感词/链接/频率规则拦截，再把被接受的评论写入 Durable Object 队列，并由 scheduled handler 每 5 分钟批量刷回 Supabase。为了让“边缘成功就算评论成功”成立，读取链路也要一起改成“可缓存的公开线程 + 不缓存的 viewer overlay”，这样刷新页面时仍能读到尚未落库的评论。评论编辑这次不做服务端自动保存，而是补齐本地草稿自动保存与恢复。

**Steps**
1. ~~Phase 1: 建立边界与共享契约。新建 /home/arthur/project/wardrobe-picks/workers/engagement-worker Worker 项目骨架，wrangler 名称设为 blog-engagement，配置 compatibility_date、nodejs_compat、observability、Cron Trigger（*/5 * * * *）以及 Durable Object 绑定。并在 /home/arthur/project/wardrobe-picks/package.json 与 /home/arthur/project/wardrobe-picks/eslint.workers.config.mjs 中补上新 Worker 的 lint/type-check 脚本。此步不依赖其他改动。~~
2. ~~Phase 1: 提取共享的评论 DTO、排序/合并规则和基础限制常量，避免 Next 与 Worker 两边各自维护一份评论结构。建议新增一个纯工具模块，例如 /home/arthur/project/wardrobe-picks/lib/comments.ts 或 /home/arthur/project/wardrobe-picks/lib/comment-contract.ts，承载 comment DTO、sync_state 字段、公开线程排序规则、worker/public API URL 解析、COMMENT_MAX_LENGTH 复用点。此步可与 Step 1 并行。~~
3. ~~Phase 2: 在 Worker 内实现评论入口。fetch handler 只处理 /api/comments*：GET /api/comments 返回公开线程，不返回 viewer-specific 反应；POST /api/comments 先做内容长度校验、敏感词/链接/频率规则，再生成最终 comment id 与 created_at，写入 Durable Object 并立即返回；PATCH/DELETE /api/comments/:id 先检查该 comment 是否还在 DO 的 pending 队列里，若在则直接在 DO 内编辑/删除，若已落库则直接在 Worker 内查 Supabase、校验权限并执行删改。reaction/emoji 这次继续走原有 Next origin，不迁入 blog-engagement。~~
4. ~~Phase 2: 采用“单例 CommentQueue DO + 单独 IP 级 RateLimit DO”的最小架构。CommentQueue DO 用 SQLite-backed Durable Object storage 保存 pending_comments，按 target_type + target_id 建索引，支持 create/listThread/update/delete/flushDueComments；CommentRateLimiter DO 按 client IP 做窗口计数。选择单例队列而不是按线程分片，是因为当前站点评论量有限，单例 DO 能直接满足“Cron 每 5 分钟 flush 一次”而不需要额外做脏线程注册器；后续流量增长时再拆为 thread DO + coordinator。~~
5. ~~Phase 2: 新增 Supabase migration /home/arthur/project/wardrobe-picks/supabase/migrations/027_comment_batch_rpc.sql，提供 idempotent 的 apply_comment_batch RPC。RPC 负责把 Worker 已接受的评论批量插入 comments 表，并允许显式写入 comment id、created_at、updated_at；对 wardrobe_item 评论同时补 item_id；使用 ON CONFLICT (id) DO UPDATE 保证 flush 重试安全。此步依赖 Step 2，对 Step 3/4 提供持久化出口。~~
6. ~~Phase 3: 改造读取链路为“公开线程 + viewer overlay”。新增 /home/arthur/project/wardrobe-picks/app/api/comments/viewer-state/route.ts，只返回当前 identity 对某个线程的 viewer_reaction 与 viewer_emojis，复用 /home/arthur/project/wardrobe-picks/lib/comment-reactions.ts 的 attachViewerReactions 和 /home/arthur/project/wardrobe-picks/lib/comment-emojis.ts 的 attachViewerEmojiReactions。Worker 的 GET /api/comments 只返回公开评论内容并在无 identity 时走 edge cache。此步依赖 Step 2 到 Step 5。~~
7. ~~Phase 3: 把博客页首屏评论切到公开线程 loader。/home/arthur/project/wardrobe-picks/app/blog/[slug]/page.tsx 当前直接从 Supabase 查询 comments，这会绕过 DO pending 状态，必须改成通过 shared public loader 读取 worker 返回的公开线程。/home/arthur/project/wardrobe-picks/components/ItemDetail.tsx 当前的 CommentBox 是 ssr: false 且 /home/arthur/project/wardrobe-picks/app/session/[token]/item/[id]/page.tsx 没有预取 comments，因此衣橱详情页只需要依赖客户端新链路，不需要额外的 SSR 评论查询改造。此步依赖 Step 6。~~
8. ~~Phase 4: 改造 /home/arthur/project/wardrobe-picks/components/CommentBox.tsx。客户端先拉公开线程，再在 identity ready 后拉 viewer-state 并本地 merge；保留现有 optimistic 动画，但用 worker 返回的最终 id 和 created_at 作为 canonical comment；评论对象新增 sync_state（pending 或 persisted），pending 评论在 flush 前继续可编辑/删除，但 reaction/emoji 按钮需要禁用或隐藏，避免打到 origin 后 404。此步依赖 Step 3 到 Step 7。~~
9. ~~Phase 4: 补齐评论草稿缓存和编辑恢复。对新增评论草稿、replyTo、编辑中的评论草稿分别做 localStorage 持久化，建议新增一个纯前端存储模块，例如 /home/arthur/project/wardrobe-picks/lib/comment-draft-storage.ts。键名应至少包含 targetType、targetId，以及编辑模式下的 commentId；页面刷新后恢复 compose draft、reply 上下文和 edit draft；在提交成功、保存成功或用户显式放弃时清理对应 key。此步与 Step 8 强相关，建议同一阶段完成。~~
10. ~~Phase 5: 做评论公开线程缓存和失效。Worker 对无 identity 的 GET /api/comments 使用 caches.default 做短 TTL 缓存；在 comment create、pending patch、pending delete、以及 flush 成功后主动删除对应线程 cache key。viewer overlay 不缓存。/home/arthur/project/wardrobe-picks/lib/blog.ts 中的 getCommentCounts 继续保持 Supabase + 30s unstable_cache，这意味着首页/归档的评论计数会比线程详情多出“flush 周期 + 30 秒”的 eventual consistency，这次明确记录为已知范围边界，不在本次一并改造。~~
11. ~~Phase 5: 补齐代理与部署前提。blog-engagement 应只挂在站点的 /api/comments* 路径前，不接管其他接口；为了避免 Worker 自己代理自己，需要新增一个非循环的 origin 配置，例如 NEXT_ORIGIN_BASE_URL 或等价 secret，指向真实 Next 源站；Worker 对 reaction/emoji/viewer-state 这类仍在 Next 的接口经由这个地址访问，评论 PATCH/DELETE 不再回到 origin route。此步阻塞正式部署，但不阻塞本地实现。~~
12. ~~Phase 5: 增加结构化日志与回归验证。Worker 记录 moderation reject、rate-limit reject、queue length、flush success/failure、origin proxy failure；Next 侧重点验证 CommentBox 状态机、草稿恢复和 pending sync UI。此步依赖所有实现步骤。~~

**Relevant files**
- /home/arthur/project/wardrobe-picks/workers/engagement-worker/package.json — 新 Worker 的 scripts 与依赖
- /home/arthur/project/wardrobe-picks/workers/engagement-worker/tsconfig.json — 新 Worker 的 TS 配置
- /home/arthur/project/wardrobe-picks/workers/engagement-worker/wrangler.jsonc — Worker 名称、Cron Trigger、DO 绑定、vars、observability
- /home/arthur/project/wardrobe-picks/workers/engagement-worker/src/index.ts — Worker fetch handler、scheduled handler、Durable Object 类
- /home/arthur/project/wardrobe-picks/package.json — 根级 check/lint:workers 脚本补充 blog-engagement
- /home/arthur/project/wardrobe-picks/eslint.workers.config.mjs — 把新 Worker 源码纳入 workers lint
- /home/arthur/project/wardrobe-picks/lib/engagement-public-api.ts — 评论公开线程 GET/POST 的 worker 入口；worker 缺失时显式失败，不再回退 same-origin /api/comments
- /home/arthur/project/wardrobe-picks/app/api/comments/viewer-state/route.ts — 新增 viewer-specific overlay 路由
- /home/arthur/project/wardrobe-picks/app/blog/[slug]/page.tsx — 首屏 initialComments 改走 public thread loader
- /home/arthur/project/wardrobe-picks/components/CommentBox.tsx — 公开线程加载、viewer overlay merge、pending sync UI、本地草稿恢复
- /home/arthur/project/wardrobe-picks/components/note-board/hooks/useBoardData.ts — guestbook 客户端读取改为 public thread + viewer overlay，与评论页保持一致
- /home/arthur/project/wardrobe-picks/components/note-board/hooks/useNoteEditor.ts — guestbook create/edit 直接打 worker，不再经由 note-board route 代理
- /home/arthur/project/wardrobe-picks/components/note-board/hooks/useBoardMutations.ts — guestbook delete 直接打 worker；archive 仍留在 note-board route
- /home/arthur/project/wardrobe-picks/lib/comment-reactions.ts — 复用 attachViewerReactions
- /home/arthur/project/wardrobe-picks/lib/comment-emojis.ts — 复用 attachViewerEmojiReactions
- /home/arthur/project/wardrobe-picks/lib/input-limits.ts — 复用 COMMENT_MAX_LENGTH，或迁移到纯共享 comment contract
- /home/arthur/project/wardrobe-picks/lib/comments.ts — 建议新增的共享评论 loader/contract/helper 模块
- /home/arthur/project/wardrobe-picks/lib/comment-draft-storage.ts — 建议新增的本地草稿缓存工具
- /home/arthur/project/wardrobe-picks/supabase/migrations/027_comment_batch_rpc.sql — 批量评论写回 RPC

**Verification**
1. 运行 npm --prefix /home/arthur/project/wardrobe-picks/workers/engagement-worker run types，确认 Wrangler 绑定类型生成成功。
2. 运行 npm --prefix /home/arthur/project/wardrobe-picks/workers/engagement-worker run type-check，确认 Worker 代码通过 TS。
3. 运行 npm run lint:workers 与 npm run check，确认根仓库把新 Worker 纳入校验且 Next 侧改造无类型/ESLint 回归。
4. 本地使用 Wrangler dev 触发 scheduled handler，调用 /cdn-cgi/handler/scheduled?cron=*/5+*+*+*+*，确认 flush 路径和日志可用。
5. 手工验证：正常评论可被边缘接受并立即显示；刷新页面后在 flush 前仍能看到该评论；5 分钟 flush 后评论仍保留且 sync_state 消失。
6. 手工验证：敏感词、超长内容、异常外链密度、单位时间超频评论会在边缘层直接被拒绝，并给 CommentBox 返回明确错误。
7. 手工验证：pending 评论在 flush 前可编辑/删除，reaction/emoji 入口不可用；flush 后 reaction/emoji 恢复为现有逻辑。
8. 手工验证：新增评论草稿、replyTo、编辑草稿在刷新后能恢复；提交/保存/放弃后对应 localStorage key 被清除。
9. 手工验证：博客文章页与 wardrobe_item 评论都走同一 comments worker 边界；首页/归档的 comment count 仍可能延迟更新，这是本次已知边界。

**Decisions**
- 本次 Worker 范围限定为所有 /api/comments* 评论接口，不包含 post reaction 或其他 engagement worker 职责。
- 反垃圾首版使用本地规则：敏感词、链接密度、简单频率限制；外部反垃圾 API 仅预留扩展点，不在本次首版实现。
- “编辑已保存功能”按本地草稿自动保存与恢复落地，不做服务端自动保存，不新增编辑成功 toast 作为主需求。
- 公开线程缓存采用“public thread cached + viewer overlay uncached”模式，避免把 identity 相关反应状态缓存到边缘。
- 首页、归档等评论数统计仍以 Supabase 为准，因此在 flush 之前不会立即反映边缘已接受评论；这次不扩展到全站 comment count 实时化。
- 2026-05 的清理中，评论与 guestbook 的公开读取、create、edit、delete 均不再保留同源 Supabase fallback；guestbook archive 仍留在 note-board 路由，作为留言板独有能力。

**Further Considerations**
1. 若评论吞吐量明显上升，再把单例 CommentQueue DO 拆成按 thread 分片的 DO，并增加 coordinator DO 或 KV 脏索引来驱动 scheduled flush。
2. 若后续要把 reaction/emoji 也纳入边缘异步化，需要单独设计 pending comment 的 reaction 语义与 Supabase 聚合策略，本次先不混进同一个改造面。
3. 若需要管理员在 comment flush 前就能介入 pending 评论，需要补一个基于 origin auth 的管理鉴权桥接接口；当前计划默认 pending 编辑/删除以作者身份为主。