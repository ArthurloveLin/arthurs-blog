## Plan: Recipe Best-Practice Optimization

在保留“单页书本翻页”与“管理员内联编辑”两个约束下，优先解决 recipe 模块当前最明显的三类偏差：全量过取数与重复序列化、共享数据在每个 spread 重复拉取、客户端边界和重型交互代码过早加载。推荐做法不是重做信息架构，而是把数据分层、把共享查询上提、把编辑和图谱的客户端成本延后到真正需要时再支付。

**Steps**
1. ~~Phase 1 — 建立基线与数据契约。recipe 页面已拆成轻量列表类型与详情类型：目录与分页壳只消费 summary 字段，每个 spread 再独立获取 detail。/home/arthur/wardrobe-picks/lib/recipes.ts 与 recipe API routes 已从通配查询切到显式字段选择，列表与修订记录不再返回 full row。~~
2. ~~Phase 2 — 重构服务端数据流。把 /home/arthur/wardrobe-picks/components/recipe/RecipeSpread.tsx 中每个 spread 都执行的共享查询拆开：skill graph 改为在 /home/arthur/wardrobe-picks/app/recipe/page.tsx 顶层只取一次；revisions 改成显式缓存函数，至少做到按 recipeId 去重和 tag revalidate。若同一次请求内仍可能重复命中，补充 React.cache 级别的 request-scoped dedupe。此步依赖步骤 1。~~
3. ~~Phase 2 — 引入分层渲染和 Suspense。保持书本翻页容器不变，为每个 recipe spread 增加独立的异步服务端片段与骨架占位，让 revisions 等较慢数据不再阻塞整页，目录与书壳可以先返回。轻量列表数据契约的进一步收敛仍归步骤 1 处理。~~
4. ~~Phase 2 — 消除 skill graph 的重复序列化。当前 graph 是全局共享数据，却会通过每个 right page 传给客户端图组件。改为在更高层只注入一次共享 graph 数据，例如新增一个图谱 provider 或单次客户端数据源，让每个图组件只接收 currentRecipeId 或极小的 recipe 关联摘要。这样能避免同一份 nodes/links 在多个客户端边界反复序列化。此步依赖步骤 2。~~
5. ~~Phase 3 — 缩小管理员客户端边界。管理员浏览态已改成“服务端渲染的 viewing spread + 极小的客户端控制层 + 按需动态加载的 editor”。浏览状态复用服务端页面组件，只有进入编辑时才加载编辑器与对应 hook。~~
6. ~~Phase 3 — 延迟加载重型前端依赖。SkillTreeGraph 已改为动态导入，且会随着 spread 的邻近挂载策略只在图谱所在页接近激活时才真正参与客户端加载。~~
7. ~~Phase 3 — 控制单页 DOM 与 hydration 规模。BookShell 已引入邻近挂载策略，仅保留当前页及相邻两页的真实内容，其余位置渲染等宽占位页，维持原有翻页尺寸与滚动手感。~~
8. ~~Phase 4 — 统一 mutation 反馈与刷新策略。管理员发布操作已切到 transition 驱动并带局部状态更新；编辑保存会在成功后通过 transition 包裹 refresh，减少阻塞式刷新感知。~~
9. ~~Phase 4 — 收敛缓存策略。管理员 recipe 页面已切回缓存列表与缓存详情查询，依赖现有 revalidateTag 失效链路，而不再默认走 fresh query。~~
10. ~~Phase 4 — 清理 API 与模块接口。recipe list/detail/revision API 已对齐新的显式字段契约，避免列表与修订接口继续返回 full row。~~

**Relevant files**
- /home/arthur/wardrobe-picks/app/recipe/page.tsx — 当前页面会一次性读取整个 recipe 列表并渲染全部 spreads；需要改成“轻量列表 + 分片详情加载 + 顶层共享查询”。
- /home/arthur/wardrobe-picks/lib/recipes.ts — 当前 recipe list/detail/skill graph/revisions 查询集中在这里；需要拆字段选择、缓存职责与共享查询。
- /home/arthur/wardrobe-picks/components/recipe/RecipeSpread.tsx — 当前每个 spread 都重复取 revisions 和 skill graph；需要拆成共享数据与局部数据两层。
- /home/arthur/wardrobe-picks/components/recipe/RecipeSpreadClient.tsx — 当前 admin 浏览态也落在较大的客户端边界内；需要拆 view/edit 两条路径。
- /home/arthur/wardrobe-picks/components/recipe/RecipeRightPage.tsx — 当前向图组件传入完整 skill graph；需要改为共享数据消费点或只传最小标识。
- /home/arthur/wardrobe-picks/components/recipe/SkillTreeGraph.tsx — 当前 d3 为 eager import，图谱在每次挂载时完整初始化；需要动态导入、按需挂载与更稳定的输入接口。
- /home/arthur/wardrobe-picks/components/recipe/BookShell.tsx — 当前所有书页都同时挂载；需要窗口化/邻近挂载策略。
- /home/arthur/wardrobe-picks/hooks/useRecipeEditor.ts — 当前 mutation 路径未统一使用 transition，也没有区分局部更新与全局刷新。
- /home/arthur/wardrobe-picks/app/api/recipes/route.ts — 当前 list/create route 仍返回和处理过大的 full row 结构。
- /home/arthur/wardrobe-picks/app/api/recipes/[slug]/route.ts — 当前 detail/update route 需要跟随新的缓存与最小返回模型调整。
- /home/arthur/wardrobe-picks/app/api/recipes/[slug]/revisions/route.ts — 需要与 revisions 缓存和最小化返回对齐。
- /home/arthur/wardrobe-picks/app/blog/[slug]/page.tsx — 可复用其“先取元信息、再以 Suspense 流式分发较重内容”的模式。
- /home/arthur/wardrobe-picks/components/MobileDrawers.tsx — 可复用其 dynamic import 延迟重型客户端组件的模式。
- /home/arthur/wardrobe-picks/components/SessionList.tsx — 可复用其 useTransition 驱动 mutation 的交互模式。

**Verification**
1. 运行 npm run lint -- app/recipe components/recipe lib/recipes.ts hooks/useRecipeEditor.ts app/api/recipes，确认类型与 lint 规则在 recipe 相关范围内通过。
2. 手动验证 public recipe 页面：目录和书壳先可交互，后续 spread 允许渐进出现，视觉上不破坏当前翻页体验。
3. 手动验证 public 页面网络行为：skill graph 数据只请求/序列化一次，图谱代码只在需要时下载。
4. 手动验证 admin 页面：初始浏览态不加载编辑器重型逻辑，点击编辑后才进入编辑态，保存/发布/新增草稿在过渡态下仍保持交互响应。
5. 手动验证缓存：新增、保存、发布、删除 recipe 后，列表、详情、图谱、修订记录都能在 revalidate 后正确更新，且管理员页面不再默认走全量 fresh query。
6. 若环境允许，额外运行 next build 或结合 bundle analyzer 对比 recipe 改造前后的首屏 JS 与 d3 相关 chunk，确认客户端负载下降。

**Decisions**
- 保留当前“单页书本翻页”结构，不拆成独立 detail route。
- 保留管理员同页内联编辑，不改为外部编辑页或抽屉。
- 本计划优先优化首屏关键路径、重复查询、重复序列化和客户端包体积，不追求在当前 IA 下彻底消除 O(N) 数据规模。
- 不包含视觉重设计；只允许为骨架屏、延迟加载和窗口化引入必要的占位表现。

**Further Considerations**
1. 在保留单页结构的前提下，总 payload 仍会随 recipe 数量增长。若后续 recipe 数量继续扩张，需要再评估“仅当前页详情 SSR，其余按需请求”的更激进方案。
2. 如果技能图谱未来继续增大，除动态导入外，可能还需要把图谱数据拆成“全局拓扑一次加载 + 单 recipe 邻接索引轻量消费”的两层结构。