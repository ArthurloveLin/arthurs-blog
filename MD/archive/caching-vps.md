## Plan: VPS 缓存收敛与分层

在当前单实例 VPS + Cloudflare CDN 的前提下，保留 Next.js 16 自带的数据缓存、全路由缓存与 revalidateTag/revalidatePath，不引入 Redis 或自定义 cacheHandler。核心工作不是“移除缓存”，而是把现在叠在一起的三层缓存重新分工：内容型数据走事件驱动失效，外部源数据走时间驱动 TTL，用户态与交互态保持动态或极短缓存；同时去掉 Vercel 时代遗留的重复控制面，尤其是全站 purge 和把半实时数据冻进无限静态页这两类问题。

**Steps**
1. Phase 1: 先把缓存策略分三类并定单一控制面。把公开页面、应用数据函数、公开 API 分成“事件驱动失效”“时间驱动 TTL”“完全动态”三类；对公开 HTML 优先让路由级 revalidate 成为主控制面，仅在 Cloudflare 边缘 TTL 必须与浏览器或源站 TTL 分离时才继续保留单独的 CDN 头。涉及 [next.config.ts](next.config.ts)、[app/page.tsx](app/page.tsx#L8)、[app/blog/[slug]/page.tsx](app/blog/[slug]/page.tsx#L32)、[app/category/[slug]/page.tsx](app/category/[slug]/page.tsx#L8)、[app/tag/[slug]/page.tsx](app/tag/[slug]/page.tsx#L8)、[app/archive/[year]/page.tsx](app/archive/[year]/page.tsx#L8)、[lib/blog.ts](lib/blog.ts#L56)、[lib/spotify.ts](lib/spotify.ts#L401)、[lib/now-watching.ts](lib/now-watching.ts#L208)、[lib/life-gallery.ts](lib/life-gallery.ts#L63)、[lib/comments-server.ts](lib/comments-server.ts#L54)。
2. ~~Phase 2: 优先修正“无限静态页里混入实时片段”的错误边界。当前 [app/category/[slug]/page.tsx](app/category/[slug]/page.tsx#L8)、[app/tag/[slug]/page.tsx](app/tag/[slug]/page.tsx#L8)、[app/archive/[year]/page.tsx](app/archive/[year]/page.tsx#L8) 都是 revalidate = false，但它们又通过 [components/BlogHero.tsx](components/BlogHero.tsx#L59) 渲染 guestbook 预览，这会让本不该长期静态的数据被一起冻住。推荐做法是把 guestbook 预览改成客户端 SWR 或单独的动态片段，让这些列表页继续高缓存；如果本轮不想动 UI 结构，则退一步给这些路由显式有限 TTL。并同时复核 [app/page.tsx](app/page.tsx#L8) 的 1800 秒首页 TTL，因为它同样会拖慢 guestbook 预览新鲜度。~~
3. ~~Phase 3: 收敛 blog 数据层的 TTL 与 tag 语义。把 [lib/blog.ts](lib/blog.ts#L56) 里的缓存分成两组：由后台操作明确驱动失效的数据，如 site config、categories、year archive、all tags、recent posts、post meta、post content、sessions list，应以 revalidateTag/revalidatePath 为主，时间 TTL 只保留为安全兜底或直接去掉；由外部源控制变化的数据，如 Spotify、now-watching、life-gallery，则继续保留明确 TTL。这个阶段还要清理 tag 设计，避免 posts、单篇 tag、原始内容 tag 之间既重叠又不成体系。~~
4. ~~Phase 4: 用精准 CDN purge 替换全站 purge。当前 [app/api/blog/reindex/route.ts](app/api/blog/reindex/route.ts#L190) 在完成 Next 层 revalidate 后还会做 purge_everything，这在单 VPS + Cloudflare 下会把所有公开页一起打回 MISS，造成没有必要的回源与瞬时抖动。应改成只 purge 受影响的首页、文章详情、相关 category、tag、archive 路径，并在 Cloudflare 缓存这些资源时把对应 RSC 变体一并纳入考虑。~~同样的思想也要评估 [app/api/admin/config/route.ts](app/api/admin/config/route.ts#L89)、~~[app/api/admin/now-watching/revalidate/route.ts](app/api/admin/now-watching/revalidate/route.ts#L10)~~、~~[app/api/revalidate/route.ts](app/api/revalidate/route.ts#L16)~~ 这些只动 Next cache、不动 CDN cache 的路径。
5. ~~Phase 5: 简化边缘缓存头策略。等公开路由的 revalidate 值合理后，缩减 [next.config.ts](next.config.ts#L10) 里手写的页面级 CDN-Cache-Control 规则，把“路由级 revalidate + Next 自动 Cache-Control”作为主路径；只有确实需要把 Cloudflare 边缘 TTL 和浏览器 TTL 解耦时，才保留 Cloudflare-CDN-Cache-Control 或 CDN-Cache-Control。不要长期维护两套互相不直观的 TTL 来源，除非差异是有意且被记录下来的。~~
6. Phase 6: 校准 CDN 与反向代理的 App Router 兼容性。既然当前前面还有 Cloudflare，就要验证它正确转发 rsc 头、保留 _rsc 查询参数进入 cache key、不会缓存带用户态的响应，并且不会错误处理 Vary。对于使用 Suspense 流式输出的页面，例如 [app/blog/[slug]/page.tsx](app/blog/[slug]/page.tsx#L39)，还需要确认反向代理支持流式传输而不是默认缓冲。这个阶段顺带复查 [proxy.ts](proxy.ts) 的注释与约束是否仍然成立，但不把认证架构改造并入本轮缓存收敛。
7. Phase 7: 改完后用指标调参，而不是预先引入复杂设施。比较 Cloudflare HIT ratio、源站 TTFB、Next 进程 CPU、Supabase 查询量与 reindex 后的缓存恢复曲线；只有当单实例磁盘型 Next cache 明显不够用，或未来改成多实例部署，再进入 cacheHandler/Redis 方案，而不是现在就上共享缓存层。

**Relevant files**
- [next.config.ts](next.config.ts) — 当前页面级 Cloudflare 边缘缓存规则入口
- [app/page.tsx](app/page.tsx#L8) — 首页 ISR 与 guestbook 预览混合点
- [app/blog/[slug]/page.tsx](app/blog/[slug]/page.tsx#L32) — 文章详情静态生成与互动壳层
- [app/category/[slug]/page.tsx](app/category/[slug]/page.tsx#L8) — 当前无限静态的分类页
- [app/tag/[slug]/page.tsx](app/tag/[slug]/page.tsx#L8) — 当前无限静态的标签页
- [app/archive/[year]/page.tsx](app/archive/[year]/page.tsx#L8) — 当前无限静态的归档页
- [components/BlogHero.tsx](components/BlogHero.tsx#L59) — 被静态页一并冻结的 guestbook 预览
- [app/layout.tsx](app/layout.tsx#L35) — 全局 sidebar 数据预取与缓存扇出面
- [lib/blog.ts](lib/blog.ts#L56) — 主数据层 cache/tag 设计
- [app/api/blog/reindex/route.ts](app/api/blog/reindex/route.ts#L190) — 批量 revalidate 与当前 purge_everything
- [app/api/admin/config/route.ts](app/api/admin/config/route.ts#L89) — site config 失效路径
- [app/api/admin/now-watching/revalidate/route.ts](app/api/admin/now-watching/revalidate/route.ts#L10) — now-watching 失效路径
- [app/api/revalidate/route.ts](app/api/revalidate/route.ts#L16) — spotify 失效路径
- [app/api/blog/search/route.ts](app/api/blog/search/route.ts#L19) — 适合保留的短 TTL 公开 API 样板
- [lib/comments-server.ts](lib/comments-server.ts#L54) — 半实时读取适合的短 revalidate 模式
- [app/wardrobe/page.tsx](app/wardrobe/page.tsx#L9) — 会话列表的事件驱动缓存样板
- [proxy.ts](proxy.ts) — 需要重新确认是否仍受旧平台限制影响

**Verification**
1. 在改动前后都抓取 /、一篇文章详情、一个分类页、一个标签页、一个归档页、一个公开缓存 API 的响应头，比较 Cache-Control、CDN-Cache-Control、Vary、CF-Cache-Status。
2. 在完成 Phase 2 后，新增或编辑 guestbook 留言，验证首页、分类页、标签页、归档页的预览是否能按预期刷新，而不是依赖重新部署或偶然的 blog reindex。
3. 在完成 Phase 4 后，只改动一篇文章并执行 reindex，确认只有首页、受影响文章、受影响 category、tag、archive 路径发生 Cloudflare MISS 或 purge，其他公开页继续保持 HIT。
4. 同时验证浏览器整页直达和客户端路由跳转两种流量，确保 Cloudflare 对 RSC 与 HTML 的区分没有被破坏。
5. 对比改动前后的源站负载与数据层压力，重点看 Next 进程 CPU、Supabase 对 posts 或 site_config 的查询量、以及 Cloudflare HIT ratio。
6. 实施结束后运行 npm run lint 与 npm run build，确保缓存重构没有破坏构建与路由行为。

**Decisions**
- 已纳入范围：公开页面缓存策略、数据层 cache/tag 收敛、CDN 协同失效、Cloudflare 页面缓存规则校准。
- 暂不纳入：Redis 或自定义 cacheHandler、多实例缓存协调、全面迁移到 use cache、与缓存无直接关系的认证链路重构。
- 已确认前提：当前部署是单实例 VPS，前面仍有 Cloudflare，目标是继续保留高性能而不是只做最小复杂度方案。

**Further Considerations**
1. 本轮建议先保留 generateStaticParams，不把“构建期是否全量展开页面”当成首批改造目标；只有当发布耗时或内容规模继续增长，再把它单独立项。
2. 如果第一轮完成后还想继续简化，下一步最值得做的是把 blog 专属 sidebar 与 guestbook 预览从 [app/layout.tsx](app/layout.tsx#L35) 的全局缓存扇出里再拆出来。