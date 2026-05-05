     NoteBoardProvider 拆分与优化方案

     Context

     用户询问 NoteBoardProvider.tsx（1439 行）是否臃肿需要拆分，以及 note 模块的性能症结和优化方向。

     核心发现： Context 层已经正确拆分成 6 个独立 Context（BoardState、EditorState、Toast、Actions、Meta、Bindings）。但文件内部有 两个严重的 memoization
     缺陷，导致这套拆分策略完全失效，所有消费者仍然在每次 state 变化时全量重渲染。

     ---
     症结诊断

     Bug 1 — noteItems 未 memoize（最严重）

     // 当前：每次 render 都生成新数组，引用永远不稳定
     const noteItems: NoteCardViewModel[] = visibleMessages.map((message) => { ... })

     // boardState 的 useMemo 依赖了不稳定的 noteItems
     const boardState = useMemo(..., [
       ..., noteItems, ...  // ← 永远是新引用 → boardState 永远重新计算
     ])

     noteItems 是一个普通 const 赋值，没有 useMemo。每次 render 都是新数组引用，导致 boardState 的 useMemo 完全失效——每当 toast 定时器、editor value
     等任何无关状态更新时，所有 useNoteBoardBoardState() 消费者都会重渲染。

     Bug 2 — actions 对象未 memoize

     // 当前：每次 render 生成新对象
     const actions: NoteBoardActions = {
       toggleMobileView: ..., handleLoadMore: ..., ...
     }
     // → 所有 useNoteBoardActions() 消费者每次 render 都重渲染

     连锁根因 — viewerIdentityAliases 未 memoize

     // 第 393 行：每次 render 生成新数组
     const viewerIdentityAliases = identityAliases.length > 0 ? identityAliases : [identity].filter(Boolean)

     这个不稳定的引用作为 dep 传入 noteItems 的 handler 闭包，是 Bug 1 的上游原因。

     次要问题 — 异步 handler 未 useCallback

     submitDraft、saveEditingNote、handleLoadMore、handleNextPage、handleDelete、handleReaction、handleEmojiReaction、handlePriorityChange、handleSortModeChange
     、handleSwitchArchiveView、handleToggleArchive、handleSubmit 都是普通函数声明，没有 useCallback。

     ---
     关于拆分 — 是否有必要？

     Context 分层已经正确，不需要再拆分 Provider。 6 个 Context 的粒度是合理的。

     文件拆分（提取自定义 hooks）是可选的认知优化，不是性能必需项。修复上述两个 Bug 才是性能关键路径。

     如果要做文件拆分，推荐的 Hook 分层如下（纯组织目的）：

     ┌──────────────────────┬───────────────────────────────┬─────────────────────────────────────────────────┐
     │         Hook         │             文件              │                      职责                       │
     ├──────────────────────┼───────────────────────────────┼─────────────────────────────────────────────────┤
     │ useViewportDetection │ hooks/useViewportDetection.ts │ isMobileViewport + matchMedia 监听              │
     ├──────────────────────┼───────────────────────────────┼─────────────────────────────────────────────────┤
     │ useNotifications     │ hooks/useNotifications.ts     │ toast + fresh 标记 + 定时器                     │
     ├──────────────────────┼───────────────────────────────┼─────────────────────────────────────────────────┤
     │ useBoardSurface      │ hooks/useBoardSurface.ts      │ 容器尺寸 + 卡片位置/z-index + scatter           │
     ├──────────────────────┼───────────────────────────────┼─────────────────────────────────────────────────┤
     │ useBoardNoteItems    │ hooks/useBoardNoteItems.ts    │ noteItems 的 useMemo 纯变换                     │
     ├──────────────────────┼───────────────────────────────┼─────────────────────────────────────────────────┤
     │ useNoteEditor        │ hooks/useNoteEditor.ts        │ draft/edit 状态 + submitDraft/saveEditingNote   │
     ├──────────────────────┼───────────────────────────────┼─────────────────────────────────────────────────┤
     │ useBoardMutations    │ hooks/useBoardMutations.ts    │ reaction/emoji/delete/archive/priority 乐观更新 │
     ├──────────────────────┼───────────────────────────────┼─────────────────────────────────────────────────┤
     │ useBoardData         │ hooks/useBoardData.ts         │ SWR + messages + 分页 + sort/archive 切换       │
     └──────────────────────┴───────────────────────────────┴─────────────────────────────────────────────────┘

     ---
     实施计划

     Phase 1：修复性能 Bug（必做，一个 atomic commit）

     关键文件： components/note-board/NoteBoardProvider.tsx

     步骤（按顺序执行）：

     1. 稳定 viewerIdentityAliases（第 393 行）
     const viewerIdentityAliases = useMemo(
       () => identityAliases.length > 0 ? identityAliases : [identity].filter(Boolean),
       [identity, identityAliases]
     )
     2. 将所有异步 handler 改为 useCallback，补全 dep 数组：
       - fetchBoardMessages（已是 useCallback，检查 deps）
       - replaceMessages → useCallback（deps: sortMode, mutateBoardPayload）
       - resetBoardSurface → useCallback（deps: board.initialPageLimit, cancelEditingNote, sortMode）
       - submitDraft → useCallback
       - saveEditingNote → useCallback
       - handleLoadMore → useCallback
       - handleNextPage → useCallback
       - handlePreviousPage → useCallback
       - handleSubmit → useCallback
       - handleSwitchArchiveView → useCallback
       - handleSortModeChange → useCallback
       - handleToggleArchive → useCallback
       - handleDelete → useCallback
       - handleReaction → useCallback
       - handleEmojiReaction → useCallback
       - handlePriorityChange → useCallback
       - startEditingNote → useCallback
     3. 修复 Bug 1：memoize noteItems（第 1068–1112 行）
     const noteItems = useMemo<NoteCardViewModel[]>(() =>
       visibleMessages.map((message) => { ... }),
     [
       visibleMessages,
       isAdmin,
       viewerIdentityAliases,
       editingNoteId,
       editContent,
       isUpdatingNote,
       priorityUpdatingIds,
       reactionUpdatingIds,
       emojiUpdatingIds,
       freshMessageIds,
       measuredHeights,
       priorityEnabled,
       handleDelete,
       startEditingNote,
       handleToggleArchive,
       handlePriorityChange,
       handleReaction,
       handleEmojiReaction,
       saveEditingNote,
       cancelEditingNote,
     ])
     4. 修复 Bug 2：memoize actions（第 1187–1206 行）
     const actions = useMemo<NoteBoardActions>(() => ({
       toggleMobileView: ...,
       ...
     }), [
       bringCardToFront, handleCardHeightChange, handleLoadMore,
       handlePreviousPage, handleNextPage, handleSubmit,
       handleSwitchArchiveView, handleSortModeChange, cancelEditingNote,
       isMobileViewport, editingMessage, saveEditingNote, submitDraft,
     ])

     验证： 在浏览器中打开 guestbook/memo 页面，确认：
     - 切换 toast、修改 editor value 时，便签卡片不会触发无谓的重渲染（可用 React DevTools Profiler 确认）
     - 提交便签、点赞、加表情等乐观更新流程正常
     - 桌面端翻页、移动端加载更多、归档切换正常

     ---
     Phase 2：文件拆分（可选，认知优化）

     如需进行，推荐从无依赖的 hook 开始，逐步向外扩展：

     1. useNotifications — 完全无依赖，风险最低
     2. useViewportDetection — 无内部依赖
     3. useBoardSurface — 只依赖 layout utils，无网络请求
     4. useBoardNoteItems — 纯 useMemo 变换
     5. useNoteEditor — 需注意与 useBoardData 的循环依赖（用 callbackRef 解耦）
     6. useBoardMutations — 需 callbackRef 接收 cancelEditingNote
     7. useBoardData — 最后提取，依赖最多

     循环依赖处理： useBoardData 调用 cancelEditingNote（来自 useNoteEditor），useNoteEditor 调用 replaceMessages（来自 useBoardData）。解法：两个 hook 都接受
     callbackRef 参数，Provider 在两个 hook 都初始化后赋值 ref.current。这些回调只在异步操作/事件中调用，不在 render 阶段调用，因此安全。

     杂项清理： 将 applyOptimisticReactionToMessage、applyOptimisticEmojiToMessage、isSameBoardSurfacePayload、buildOptimisticSnapshot 这四个纯函数移入
     utils/board.ts。

     ---
     不需要做的事

     - 不需要继续增加 Context 数量
     - 不需要改动任何子组件（StickyNoteCard、NoteEditor 等均为 props-driven，设计已正确）
     - 不需要改动公开 hook API（useNoteBoardBoardState 等保持不变）
     - 不需要引入状态管理库（Zustand 等）

     ---
     关键文件

     - components/note-board/NoteBoardProvider.tsx — Phase 1 的唯一修改目标
     - components/note-board/utils/board.ts — Phase 2 可迁入纯函数
     - components/note-board/hooks/ — Phase 2 新建各 hook 文件