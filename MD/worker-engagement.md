## Plan: Engagement Edge Worker

推荐新增 1 个独立的 engagement Worker，而不是拆成 2 个。原因是这 3 类需求共用同一个公网信任边界、同一套站点级 CORS 与观测、同一类前端接入方式，但内部要分两种存储职责：点赞/未来浏览量这种热写路径用 Durable Objects；评论线程缓存、敏感词/限流元数据这类读多写少或允许短暂陈旧的数据用 KV 或短 TTL 缓存。现有 wardrobe-supabase-worker 保持纯 Supabase 代理，不承载业务逻辑。

**Steps**
1. ~~Phase 1 — 边界与接入契约。新增一个独立 engagement Worker 项目，使用独立域名或站点路由承接公开互动流量；不要把业务逻辑塞进现有 Supabase 代理。复用仓库现有 Worker 的 Wrangler、observability、worker URL helper 风格，新增前端公共 helper，让文章点赞、评论读取/提交优先走 Worker，保留 Next API 作为回退或内部对照路径。这个阶段先定义 4 条能力边界：文章点赞写入、评论线程读取、评论提交审核、未来页面浏览量镜像；评论编辑/删除继续留在 Next origin。~~
2. ~~Phase 2 — 点赞写并发削峰。把当前文章点赞的浏览器 POST 从直接命中 Next API，改成命中 Worker。Worker 内为每个 postId 路由到一个 Durable Object，由它维护“当前批次内每个 identity 的最终反应状态”和“可立即返回给前端的聚合计数”，这样可以继续提供毫秒级反馈，不必等待 Supabase。不要把点赞主状态放进 KV，因为同一个 postId 是热 key，KV 最终一致会放大竞态。~~
3. ~~Phase 2.1 — 点赞批量回写策略。推荐让 Durable Object 在首次脏写后设置 5 分钟 alarm，flush 时按 postId 汇总出本窗口内的 upsert/delete 集合，并通过 Supabase RPC 一次性落库到 post_reactions，再回写 posts.upvotes/downvotes。这样可以把当前“每次点击至少一次读、一次写、一次聚合”的路径，压缩成“每 5 分钟每个热点 post 一次批量事务”。如果必须做全局 wall-clock cron，再额外维护 dirty object registry；不建议把这个作为首选，因为对象枚举与补偿会更复杂。~~
4. ~~Phase 2.2 — 点赞一致性与回退。保留现有 lib/post-reactions.ts 逻辑作为回退/校验基准，但把 normalize 和 summary 计算中可复用的纯函数抽到共享模块，避免 Worker 与 Next API 各维护一套规则。Worker flush 失败时，Durable Object 保留未提交 mutation 并在下一次 alarm 或显式重试时继续提交；前端收到的 summary 仍来自 DO 的即时状态，而不是 Supabase。~~
5. ~~Phase 3 — 评论缓存改造。当前 GET /api/comments 会把 viewer_reaction 和 viewer_emojis 一起返回，这使得“按 identity 维度缓存整包评论”几乎没有收益。先把评论读取拆成两层：一层是仅按 target_type + target_id 的公共线程数据（评论内容、聚合点赞数、聚合 emoji），这一层由 Worker 做 KV 或短 TTL 缓存；另一层是当前 identity 的 viewer reaction/viewer emojis 覆盖层，继续走 origin 小接口或按需保留现有专用 reactions 接口。CommentBox 先拿缓存线程，再补 viewer-specific overlay。~~
6. ~~Phase 3.1 — 评论提交边缘审核。评论创建 POST 先进入 Worker，在到达 Next/Supabase 前完成轻量审核：基础字段与长度校验、敏感词/正则、URL/重复字符/重复内容启发式、按 IP + identity 的限频；可插入第三方反垃圾 API，但默认先做本地规则并保留可插拔接口。命中规则时直接在边缘返回 400/429；通过时再转发给现有 Next 评论写接口。写成功后，失效对应 target 的评论线程缓存。~~
7. ~~Phase 3.2 — 评论编辑/删除边界。评论 PATCH/DELETE 初期不要放进 Worker，因为现有 app/api/comments/[id]/route.ts 里有 getUserRole() 的管理员判断，依赖站点 origin 的登录态。先只把公开读取和公开创建放进 Worker，编辑/删除维持 origin；等后续如果要统一边缘入口，再补同源路由或 service binding 方案。~~
8. ~~Phase 4 — 评论草稿自动保存与恢复。为 CommentBox 的主评论草稿和每个 CommentCard 的编辑草稿分别加 localStorage 持久化，key 至少包含 targetType、targetId、replyTo 或 commentId、模式（compose/edit）。在 mount 时恢复草稿，在成功提交/成功保存后清理对应 key，在 UI 上给一个轻量“已恢复草稿/草稿已保存”提示。这个功能纯前端，不需要 Worker。~~
9. Phase 5 — 浏览量保留 Umami 展示源。当前 ArticleMetaStats 与 /api/analytics/post 仍以 Umami 为展示来源，先不要切换。若后续需要把浏览量镜像到 Supabase 便于自定义聚合，则复用同一个 engagement Worker，再加第二个 Durable Object namespace（按 pathname 聚合 pageview 增量），只做异步镜像写入，不改变前台展示。等镜像数据稳定后，再决定是否把展示源从 Umami 切走。
10. Phase 6 — 观测、脚本与验证。把新 Worker 纳入根目录 package.json 的 lint:workers 和 check:workers；启用 logs + traces；为 DO flush、评论审核命中、缓存 miss/hit、转发失败打结构化日志。验证分三层：本地 wrangler dev 行为验证、Worker 运行时测试（含 DO alarm/flush）、以及端到端手动验证（点赞立即反馈、5 分钟后 Supabase 对账、评论草稿恢复、评论审核拦截、评论缓存命中与失效）。

**Relevant files**
- /home/arthur/project/wardrobe-picks/components/ArticleEngagementPanel.tsx — 当前文章点赞前端入口；需要把 reaction 请求切到 Worker，并保留现有 optimistic UI。
- /home/arthur/project/wardrobe-picks/app/api/posts/[id]/reaction/route.ts — 当前文章点赞 origin API；改为回退/调试入口，或改成仅内部对照路径。
- /home/arthur/project/wardrobe-picks/lib/post-reactions.ts — 当前直写 Supabase 的点赞逻辑；作为批量 flush 规则与 summary 口径的参考，并抽取纯函数复用。
- /home/arthur/project/wardrobe-picks/supabase/migrations/024_post_engagement.sql — 现有 posts/post_reactions 结构；需要在新 migration 中补批量 flush RPC 或相关 SQL 支撑。
- /home/arthur/project/wardrobe-picks/lib/blog.ts — 已有 supabaseAdmin.rpc 调用范式；可复用到批量 flush RPC 接入。
- /home/arthur/project/wardrobe-picks/components/CommentBox.tsx — 当前评论线程、主草稿、编辑草稿都在这里；需要拆分线程读取与 viewer overlay，并加 localStorage 草稿恢复。
- /home/arthur/project/wardrobe-picks/app/api/comments/route.ts — 当前评论 GET/POST origin 入口；GET 需要拆成更适合缓存的公共线程数据，POST 继续作为 Worker 审核通过后的落库目标。
- /home/arthur/project/wardrobe-picks/app/api/comments/[id]/route.ts — 当前评论 PATCH/DELETE；Phase 1 继续保留在 origin，因为管理员鉴权在这里。
- /home/arthur/project/wardrobe-picks/components/ArticleMetaStats.tsx — 当前浏览量展示组件；Phase 1 不改展示源。
- /home/arthur/project/wardrobe-picks/app/api/analytics/post/route.ts — 当前 Umami 统计读取 API；Phase 1 不改，后续若要镜像浏览量再从这里旁路扩展。
- /home/arthur/project/wardrobe-picks/lib/spotify-public-api.ts — 已有 Worker URL helper 风格；可参考同样的环境变量与 fallback 组织方式。
- /home/arthur/project/wardrobe-picks/package.json — 需要把新 Worker 纳入 check:workers / lint:workers。
- /home/arthur/project/wardrobe-picks/workers/wardrobe-supabase-worker/src/index.ts — 明确保持为纯代理，不承载 engagement 业务。
- /home/arthur/project/wardrobe-picks/workers/wardrobe-supabase-worker/wrangler.jsonc — 当前自定义域名代理配置；作为“不要复用此 Worker 承载业务逻辑”的边界参考。
- /home/arthur/project/wardrobe-picks/workers/cloudflare-worker/wrangler.toml — 现有 observability 与 trigger 配置参考。
- /home/arthur/project/wardrobe-picks/workers/genius-worker/wrangler.toml — 现有 KV namespace 配置参考。
- /home/arthur/project/wardrobe-picks/lib/guest.ts — 现有 localStorage key 与浏览器端 identity 存储风格，可复用到评论草稿恢复。

**Verification**
1. 在新 Worker 项目中跑类型检查、wrangler types、以及本地 wrangler dev，确认 DO、KV、CORS、forwarding 均能工作。
2. 更新根目录 package.json 后运行全量 worker 检查，确保新 Worker 被 lint/type-check 覆盖。
3. 手动验证文章点赞：重复点击、取消点赞、快速切换正反应，确认前端即时反馈正确，且 5 分钟后 Supabase 中 post_reactions 与 posts 聚合值一致。
4. 手动验证评论线程：首次请求命中 origin，后续请求命中 Worker cache；成功发评论后对应 target 缓存失效；viewer-specific reaction 状态不会被公共缓存污染。
5. 手动验证评论审核：敏感词、过多链接、短时间重复提交会在 Worker 被拦截，正常评论可继续落到 origin。
6. 手动验证草稿恢复：新评论草稿、回复草稿、编辑草稿在刷新后可恢复；提交成功或保存成功后会清空对应草稿。
7. 如果后续开启浏览量镜像，再单独验证“展示仍取 Umami、Supabase 只做旁路镜像”的一致性与对账脚本。

**Decisions**
- 建议 1 个新 Worker，不建议现在拆 2 个。拆 2 个只有在下面两种情况下才值得做：一是后续浏览量完全脱离 Umami 并且吞吐明显高于评论流量；二是评论审核要接入重型第三方风控/AI，导致部署节奏和资源隔离需要独立。
- 点赞/未来浏览量聚合用 Durable Objects，不用 KV 作为热写主状态；KV 只用于评论线程缓存、规则集、以及允许短暂陈旧的辅助数据。
- 5 分钟批量回写推荐用 Durable Object alarm 触发，而不是先做全局 cron；如需兜底，再补低频 sweep cron。
- 评论缓存必须先拆 viewer-specific 数据，否则缓存命中率和正确性都不足。
- 页面浏览量 Phase 1 不改展示源；只保留同 Worker 扩展位，避免把范围一次性拉太大。
- 现有 wardrobe-supabase-worker 不扩展业务逻辑，避免把基础代理和产品能力耦合到同一个 Worker。

**Further Considerations**
1. 如果你后面确定要让浏览量也走自建计数，优先继续复用同一个 engagement Worker，加第二个 DO namespace；只有当页面浏览量与评论/点赞的发布节奏、SLO、成本模型明显分离时，再拆第二个 Worker。
2. 评论审核建议先上“本地规则 + 限频 + 可插拔 API 接口”，不要一开始就把第三方反垃圾服务放成强依赖；这样更容易观察误杀率并逐步调参。
3. 若希望把点赞 flush 做成严格事务，推荐新增 Supabase RPC；如果只想先快速落地，也可以先做批量 upsert + 单独聚合更新，但要接受失败补偿逻辑更复杂。