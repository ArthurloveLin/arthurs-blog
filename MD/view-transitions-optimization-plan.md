# Blog 文章详情页切换动画优化方案

## 当前实现梳理

### 基础设施
- `app/layout.tsx:31` 使用 `next-view-transitions` 库的 `<ViewTransitions>` 包裹整个应用
- `PostCard.tsx:1`、`page.tsx:2` 的 `<Link>` 均来自 `next-view-transitions`
- `ArticleBackButton.tsx:3` 使用 `useTransitionRouter()` + `router.back()`

### 共享元素（三个）

| 元素 | `viewTransitionName` | 列表侧 | 详情侧 |
|---|---|---|---|
| 封面图 | `post-cover-{id}` | `PostCard.tsx:36` | `page.tsx:75` |
| 标题 | `post-title-{id}` | `PostCard.tsx:58` | `page.tsx:98` |
| 元信息 | `post-meta-{id}` | `PostCard.tsx:67` | `page.tsx:106` |

---

## 优化建议汇总

### 1. API 升级：迁移到 React 原生 `<ViewTransition>`

**现状**：用 `style={{ viewTransitionName }}` 直接操作 CSS 属性，这是 CSS 层面的旧方案。

**问题**：无法与 React 并发特性集成，无法用 `addTransitionType` 标记方向，无法利用 `enter`/`exit`/`share` 语义控制触发时机。

Next.js App Router 内部已打包 React canary，`<ViewTransition>` 开箱即用，需在 `next.config.ts` 开启：
```js
experimental: { viewTransition: true }
```

---

### 2. 缺少过渡方向语义（`nav-forward` / `nav-back`）

**现状**：列表→详情、详情→列表动画完全相同，无方向感。

**应加**：
- 列表点击进入详情 → `addTransitionType('nav-forward')`，内容从右侧滑入
- 返回 → `addTransitionType('nav-back')`，内容从左侧退出
- 详情页「上一篇/下一篇」是有序序列，也应使用方向性动画

---

### 3. `ArticleBackButton` 使用了 `router.back()`（动画完全无效）

**问题**：`router.back()` 触发同步 `popstate`，与 `startViewTransition` 不兼容，**返回时不会触发任何 View Transition**。

`ArticleBackButton.tsx:10` 应改为：
```ts
startTransition(() => {
  addTransitionType('nav-back')
  router.push(referrerUrl)
})
```

---

### 4. 缺少 `default="none"` 防止动画污染

**现状**：没有限制动画触发时机。

**问题**：Suspense resolve、ISR 后台 revalidate 等都会意外触发浏览器默认交叉淡入淡出，产生视觉噪声。

所有 `<ViewTransition>` 都应设置 `default="none"`，仅对需要的触发器单独开启。

---

### 5. 列表页缺少 List Identity 动画

**现状**：博客列表没有给每个 `PostCard` 加 `<ViewTransition key={post.id}>`。

**缺失效果**：按分类/标签筛选时，卡片的进入、消失、重排没有动画，用户感知不到内容在重新排列。

---

### 6. 嵌套 VT 结构缺失（List Identity + Shared Element 组合）

**现状**：`PostCard` 里共享元素是平铺的，没有外层 List Identity VT。

**正确结构**（两层嵌套）：
```tsx
<ViewTransition key={post.id}>                          {/* 列表身份 */}
  <ViewTransition name={`post-cover-${post.id}`} share="morph" default="none">
    <Image ... />                                        {/* 共享元素 */}
  </ViewTransition>
</ViewTransition>
```

两者缺一会导致对应动画静默失效。

---

### 7. 无 Suspense Reveal 动画

**现状**：文章正文加载完成时没有入场动画。

**可加**：在 `MarkdownRenderer` 外用 `<Suspense>` + `<ViewTransition enter="slide-up" default="none">` 组合，内容出现时加入向上滑入效果。

---

## 优先级

| 优先级 | 优化项 | 原因 |
|---|---|---|
| 高 | 迁移到 React 原生 `<ViewTransition>` + 开启 flag | 后续所有优化的基础 |
| 高 | 修复 `ArticleBackButton` | 返回手势动画目前完全无效 |
| 高 | 加 `default="none"` + 方向类型标注 | 消除动画污染，建立方向感 |
| 中 | 嵌套 VT 结构（List Identity + Shared Element） | 筛选时列表动画 |
| 低 | Suspense Reveal | 内容加载体验提升 |

---

## 涉及文件

- `next.config.ts` — 开启 `experimental.viewTransition`
- `app/layout.tsx` — 移除 `next-view-transitions` 的 `<ViewTransitions>`
- `app/globals.css` — 添加 CSS recipes（timing 变量、keyframes、nav-forward/back、morph、reduced-motion）
- `components/PostCard.tsx` — 嵌套 VT 结构，`style={}` 改为 `<ViewTransition name>`，`<Link>` 加 `transitionTypes`
- `app/blog/[slug]/page.tsx` — 共享元素改为 `<ViewTransition name>`，页面包裹 `<DirectionalTransition>`
- `components/ArticleBackButton.tsx` — `router.back()` 改为 `router.push()` + `addTransitionType('nav-back')`
- `components/DirectionalTransition.tsx` — 新建，封装方向性 VT 逻辑（复用于各页面）
