## 待办优化项（扫描于 2026-04-05）

| # | 优先级 | 问题 | 文件 | 规则 |
|---|--------|------|------|------|
| Step 11 | 高 ✅ | `isDragging` 改为 `useRef`，消除拖拽时无意义全列表重渲染 | `components/DraggableImageGrid.tsx` | `rerender-use-ref-transient-values` |
| Step 12 | 高 ✅ | `getUserRole()` 与 session 查询并行，减少约 100ms | `app/session/[token]/page.tsx` | `async-parallel` |
| Step 13 | 中 ✅ | 删除 Emoji 选择器功能及依赖，直接减少 bundle | `components/CommentBox.tsx` | `bundle-conditional` |
| Step 14 | 中 | Navbar 主题切换 hydration 闪烁，注入 inline script 提前设置 class | `app/layout.tsx` + `components/Navbar.tsx` | `rendering-hydration-no-flicker` |
| Step 15 | 低 ✅ | `topLevel`/`repliesMap` 用 `useMemo` 包装，避免每次输入重新 O(n) 计算 | `components/CommentBox.tsx` | `rerender-derived-state-no-effect` |

---

## 已完成修复摘要（2026-04-05）

### Step 1 ✅ MarkdownRenderer 改为 Server Component
- **文件**：`components/MarkdownRenderer.tsx`
- **改动**：删除 `'use client'`
- **效果**：`react-markdown`、`rehype-highlight` 等依赖移出客户端 bundle，博客页初始 JS 大幅缩减

### Step 2 ✅ 首页消除数据获取瀑布流
- **文件**：`app/page.tsx`
- **改动**：将 posts 查询与 5 个侧边栏查询合并到同一 `Promise.all`，`commentCounts` 保留在后（依赖 posts.id）
- **效果**：首页数据获取从 2 轮串行降为 1 轮并行

### Step 3 ✅ ImageGrid 动态加载拖拽库
- **文件**：新建 `components/DraggableImageGrid.tsx`，更新 `components/ImageGrid.tsx`
- **改动**：将所有 `@hello-pangea/dnd` 逻辑迁移到新组件，ImageGrid 改用 `next/dynamic` 按需加载（`ssr: false`）
- **效果**：非拖拽场景不下载 DnD 库（~40KB gzip）

### 首页按钮延迟专项修复 ✅（Step 5 前置）
- **文件**：`lib/blog.ts`、`app/blog/[slug]/page.tsx`、`app/wardrobe/page.tsx`
- **改动**：
  - `getCategories`、`getAllTags`、`getSiteConfig`、`getPostsCount`、`getYearArchive` 用 `unstable_cache` 包装（300s 跨请求缓存）；分类/标签切换时侧边栏数据命中缓存，只重新查 posts
  - `app/blog/[slug]/page.tsx` 新增 `generateStaticParams`，构建时预渲染所有文章
  - `app/wardrobe/page.tsx` 新增 `export const revalidate = 60`

### Step 5 ✅ 博客详情页并行获取
- **文件**：`lib/blog.ts`、`app/blog/[slug]/page.tsx`
- **改动**：将 `getPostBySlug` 拆分为 `getPostMeta`（仅 Supabase）+ `getPostContent`（R2 拉取）；拿到元数据后立即并发启动 R2 拉取、`getAdjacentPosts`、评论查询
- **效果**：博客详情页总等待时间从 ~500ms 降至 ~400ms

### Step 6 ✅ 请求级查询去重
- **文件**：`lib/blog.ts`
- **改动**：`getPostMeta` 用 `React.cache` 包装；5 个侧边栏函数已由 `unstable_cache` 覆盖（更强），无需叠加
- **效果**：同一渲染树内相同 slug 的元数据查询自动去重

### Step 7 ✅ 修复 DraggableImageGrid 的 JSON.stringify 同步对比
- **文件**：`components/DraggableImageGrid.tsx`
- **改动**：渲染内联的 `JSON.stringify` 比较改为 `useEffect` + `.join(',')` 字符串比较
- **效果**：消除每次渲染的 O(n) 序列化开销

---

### Step 8 ✅ 拖拽排序批量 PATCH → 单次 API 调用
- **文件**：新建 `app/api/items/reorder/route.ts`，更新 `components/DraggableImageGrid.tsx`
- **改动**：新增 `POST /api/items/reorder` 接口，接受 `{ ids: string[] }` 批量 upsert position；DraggableImageGrid 改为单次调用
- **效果**：拖拽重排从 N 个并发 PATCH 降为 1 个 POST

### Step 9 ✅ AuthProvider 添加 SWR 请求去重
- **文件**：`components/AuthProvider.tsx`
- **改动**：安装 `swr`，将手动 `useEffect + fetch` 替换为 `useSWR`，`revalidateOnFocus: false`，`dedupingInterval: 60_000`
- **效果**：页面切换时 `/api/me` 60 秒内不重复请求，消除重复鉴权闪烁

---

### Step 10 ✅ 提取 CommentItem 为顶层组件，消除 inline 组件 remount
- **文件**：`components/CommentBox.tsx`
- **改动**：将 `CommentItem` 从 `CommentBox` 函数体内部提取到模块顶层；同步将 `formatTime` 提升到模块级纯函数；通过 `repliesMap`、`onReply`、`onDelete`、`identity` props 传递所依赖的值
- **问题根因**：组件定义在另一个组件内部时，React 每次父组件渲染都会视其为全新的组件类型，触发完整的 unmount → remount。`CommentBox` 有 `text` state，每次用户输入文字都会重渲染，导致整个评论列表（含嵌套回复）反复销毁重建，Fiber 树无法复用
- **效果**：评论输入时不再触发评论列表的 unmount；React reconciler 可正确按 key 复用已有节点，避免焦点丢失与动画中断

### Step 11 ✅ DraggableImageGrid 的 isDragging 改为 useRef
- **文件**：`components/DraggableImageGrid.tsx`
- **改动**：`isDragging` state 替换为 `isDraggingRef = useRef(false)`；`onDragStart`/`onDragEnd` 改写 `.current`；`useEffect` 依赖数组移除 `isDragging`（ref 变化不触发 effect）
- **问题根因**：`isDragging` 仅在 `useEffect` 内作守卫条件使用，不影响渲染输出，却用 `useState` 存储。每次拖拽开始和结束都会触发 `setIsDragging`，导致整个列表（可能几十个 `Draggable`）额外重渲染两次
- **效果**：拖拽生命周期内消除 2 次无意义的全列表重渲染

### Step 12 ✅ session 页并行获取 getUserRole 与 session 查询
- **文件**：`app/session/[token]/page.tsx`
- **改动**：将串行的 `await getUserRole()` + `await supabaseAdmin.from('sessions')...` 合并为单次 `Promise.all`，items 查询仍在拿到 `session.id` 后串行
- **效果**：鉴权查询与 session DB 查询从 2 轮串行降为 1 轮并行，页面首字节时间减少约 100ms


### Step 13 ✅ 删除 Emoji 选择器，移除 @emoji-mart 依赖
- **文件**：`components/CommentBox.tsx`、`package.json`
- **改动**：删除 `@emoji-mart/data`、`@emoji-mart/react` 依赖及全部相关代码（`showEmoji` state、`emojiRef`、`insertEmoji`、外部点击关闭 `useEffect`、Picker 组件）；输入框 padding 调整为统一 `px-3`
- **决策原因**：操作系统输入法原生支持 Emoji 输入（Win/Mac/iOS/Android 均可），功能重复且成本高；`@emoji-mart/data` 为 ~3MB JSON，即使 dynamic import 也会作为独立 chunk 存在
- **效果**：彻底移除 2 个 npm 包，博文页/衣物详情页 JS 减少约 3MB（data chunk）+ Picker 组件 chunk；同时消除外部点击监听的 `useEffect`

### Step 15 ✅ topLevel / repliesMap 用 useMemo 包装
- **文件**：`components/CommentBox.tsx`
- **改动**：`topLevel`（`filter`）和 `repliesMap`（`reduce`）从渲染内联计算改为 `useMemo`，依赖 `[comments]`；同步在 import 中加入 `useMemo`
- **问题根因**：`CommentBox` 含 `text` state，用户每次输入都触发重渲染，而 `topLevel` 和 `repliesMap` 是两次 O(n) 遍历。在评论列表较长时，每次击键都白跑一遍，且产生新的对象引用，进而导致所有 `CommentItem` 子树接收到新 props
- **效果**：输入时跳过 `filter`/`reduce` 计算；只在评论真正增删时重算；`repliesMap` 引用稳定，`CommentItem` 的 props 不变，React bailout 生效

---

