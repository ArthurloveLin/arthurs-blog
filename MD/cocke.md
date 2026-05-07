# 菜谱模块（Recipe）实现计划

## Context

用户希望在现有博客/工具站基础上，新增一个「菜谱档案」功能页。视觉上模拟一本展开的书，内容上是长期维护的结构化菜谱（含版本日志、食材步骤、风味雷达、技能图谱），交互上支持目录翻页、书签导航和管理员页内编辑。

**技术选型确认：**
- 书本动画：迁移 CodePen CSS sprite + scroll-timeline 方案
- 风味雷达：6维（酸甜苦辣鲜香）
- 技能图谱：D3 力导向图（节点=菜谱，边=前置依赖）

---

## 阶段 1：解包评估 CodePen，建立书本壳组件

**目标：** 将 `CodePen/css-sprite-based-flip-carousel-using-scroll-timeline/` 的 sprite 动画迁移为可复用的 React 书本壳。

**任务：**
1. 解压 `css-sprite-based-flip-carousel-using-scroll-timeline.zip`，提取 sprite 图片资源（webp/png），放入 `public/recipe/` 目录
2. 创建 `components/recipe/BookShell.tsx`：
   - 包含 `.carousel`（横向 scroll 容器，`scroll-timeline: --carousel-timeline x`）
   - 包含 `.sprite`（sprite 背景动画层，`animation-timeline: --carousel-timeline`）
   - CSS 变量接口：`--slides`、`--sprite-f`、`--sprite-c` 通过 `style` prop 注入
   - `children` 为若干 `.carousel-item`，每个含 `.left-page` + `.right-page`
   - 提供 `onPageChange` 回调（监听 `scrollLeft` 变化）
3. 创建配套 `components/recipe/book-shell.css`：从原 CodePen 的 `style.css` 提炼，仅保留书本动画逻辑，移除 demo 样式
4. 添加降级方案：`@supports (scroll-timeline: none)` 不支持时，退化为标签页切换；`@media (prefers-reduced-motion: reduce)` 时禁用 sprite 动画

**验证：** 在 `/recipe` 路由中临时渲染 BookShell，Chrome 中滚动可看到书页翻转 sprite 动画

---

## 阶段 2：数据模型与 Supabase 建表

**目标：** 建立结构化数据层，覆盖菜谱全部字段。

**任务：**
1. 创建迁移文件 `supabase/migrations/029_recipes.sql`，包含三张表：

```sql
-- 主表
CREATE TABLE recipes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  title text NOT NULL,
  description text,
  cover_image text,          -- R2 public URL
  cover_image_key text,      -- R2 object key
  category text,
  version text NOT NULL DEFAULT '1.0',
  -- 量化指标
  prep_time_minutes int,
  cook_time_minutes int,
  servings int,
  -- 风味雷达（0-5）
  flavor_sour int CHECK (flavor_sour BETWEEN 0 AND 5),
  flavor_sweet int CHECK (flavor_sweet BETWEEN 0 AND 5),
  flavor_bitter int CHECK (flavor_bitter BETWEEN 0 AND 5),
  flavor_spicy int CHECK (flavor_spicy BETWEEN 0 AND 5),
  flavor_umami int CHECK (flavor_umami BETWEEN 0 AND 5),
  flavor_aromatic int CHECK (flavor_aromatic BETWEEN 0 AND 5),
  -- 技能与标签
  proficiency int CHECK (proficiency BETWEEN 1 AND 5),
  tags text[],
  suitable_occasions text[],
  failure_notes text,
  life_notes text,
  pairing_suggestions text,
  -- 结构化内容（JSONB，支持增删排序）
  -- ingredients: [{id, amount, unit, name, note}]
  -- steps: [{id, order, title, description, tip}]
  ingredients jsonb NOT NULL DEFAULT '[]',
  steps jsonb NOT NULL DEFAULT '[]',
  -- 发布状态
  published boolean NOT NULL DEFAULT false,
  published_at timestamptz,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 修订记录表
CREATE TABLE recipe_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id uuid NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  version text NOT NULL,
  change_summary text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 前置技能关系表（有向图，节点为菜谱）
CREATE TABLE recipe_prerequisites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_recipe_id uuid NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  to_recipe_id uuid NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  skill_label text NOT NULL,
  UNIQUE(from_recipe_id, to_recipe_id)
);
```

2. 添加 `updated_at` 自动触发器、RLS（已发布可公开读；admin 全权限）、索引
3. 创建 `lib/recipes.ts`，参照 `lib/blog.ts` 模式：
   - `getRecipesList()` — 带 `unstable_cache`，tag: `recipes`
   - `getRecipeBySlug(slug)` — 带 `unstable_cache`，tag: `recipe-${slug}`
   - `getAllRecipesWithPrerequisites()` — 用于技能图谱（返回节点+边数据）
4. R2 存储路径约定：`recipes/{recipeId}/cover.webp`

**验证：** 在 Supabase Studio 中手动插入一条测试菜谱，`getRecipeBySlug` 正常返回数据

---

## 阶段 3：路由骨架与站点集成

**目标：** 创建页面骨架，接入 Hero，添加工具入口。

**任务：**
1. 创建 `app/recipe/layout.tsx`（可选，用于设置 recipe 区域共用 metadata）
2. 创建 `app/recipe/page.tsx`（Server Component）：
   - 顶部：`<PageHero>` 复用 `components/PageHero.tsx`，title="菜谱档案"，自定义 blobColors
   - 主体：`<BookShell>` 包含目录页 + 各菜谱 Spread
   - 服务端 fetch 菜谱列表，传 props 给 BookShell
3. 创建 `app/recipe/[slug]/page.tsx`（暂时重定向或做单菜谱 URL alias，后期扩展用）
4. 修改 `components/ToolsCard.tsx`（lines 25-68）：在 `tools` 数组末尾新增：
   ```typescript
   {
     href: '/recipe',
     label: '菜谱档案',
     description: '我的私人菜谱书与烹饪技能树',
     icon: <ChefHat className="w-4 h-4" strokeWidth={1.75} />,
     external: false,
   }
   ```
5. 修改 `next.config.ts`：为 `/recipe` 添加 CDN 缓存头（对齐博客策略，1h stale-while-revalidate）

**验证：** 访问 `/recipe`，Hero 正常渲染，工具卡片有菜谱入口

---

## 阶段 4：只读展示 — 目录页与菜谱 Spread

**目标：** 完成完整的只读书本展示 UI。

**组件清单：**

| 组件 | 文件 | 说明 |
|------|------|------|
| TableOfContentsPage | `components/recipe/TableOfContentsPage.tsx` | 第1个 carousel-item，显示分类+最近更新+推荐入口 |
| RecipeSpread | `components/recipe/RecipeSpread.tsx` | 单道菜的 carousel-item 包装（含左右页） |
| RecipeLeftPage | `components/recipe/RecipeLeftPage.tsx` | 版本号、封面图、基础信息、食材表、步骤列表、量化参数、FlavorRadar |
| RecipeRightPage | `components/recipe/RecipeRightPage.tsx` | 标签、熟练度星级、SkillTreeGraph、适合场景、失败提醒、备注、搭配 |
| FlavorRadar | `components/recipe/FlavorRadar.tsx` | 6维 SVG 雷达图，参照 `components/MultiDimRating.tsx`（lines 63-175）的 SVG 路径方式，hardcode 6轴 |
| SkillTreeGraph | `components/recipe/SkillTreeGraph.tsx` | D3 力导向图，节点=菜谱，边=前置关系；`'use client'`；参照 `components/spotify/SpotifyTagStreamChart.tsx` 的 D3 用法 |
| RevisionTimeline | `components/recipe/RevisionTimeline.tsx` | 版本日志时间轴，展示 recipe_revisions 记录 |

**注意：**
- FlavorRadar 直接 fork `MultiDimRating.tsx` 的 SVG 绘制逻辑，axes 改为 `['酸','甜','苦','辣','鲜','香']`
- SkillTreeGraph 使用 `useRef` 挂载 D3，尺寸自适应容器宽度，`'use client'` 指令
- 所有组件移动端先正常渲染（响应式在阶段7处理）

**验证：** 在 `/recipe` 页，能看到目录页 + 至少一个菜谱的完整左右页展示，雷达图和技能图可见

---

## 阶段 5：书签交互与页内编辑表单

**目标：** 实现管理员书签 + 阅读/编辑态切换，非破坏性（显式保存/取消）。

**任务：**
1. 创建 `components/recipe/RecipeBookmarks.tsx`（`'use client'`）：
   - 书签项：目录、编辑、版本日志、发布状态（Admin 可见）
   - 管理员判定：客户端通过 `useAuth()` hook 获取 role
   - 书签触发 `onEdit()` / `onViewRevisions()` / `onTogglePublish()` 回调
2. 创建 `hooks/useRecipeEditor.ts`：
   - `isEditing: boolean`、`editData: RecipeDraft`、`setField()`、`save()`、`cancel()`
   - `save()` 调用 `PATCH /api/recipes/[slug]`，成功后 `router.refresh()` 触发 ISR revalidate
3. 创建 `components/recipe/InlineEditor.tsx`：通用 `<EditableField>` 组件，阅读态显示 value，编辑态切为 input/textarea
4. 食材、步骤列表编辑：复用 `@hello-pangea/dnd`（已有依赖），可拖拽排序 + 增删行
5. 技能前置编辑：在右页编辑态显示 `<select>` 下拉选择已有菜谱，添加/删除关系

**验证：** 管理员登录后，点击书签进入编辑态，修改标题保存，页面刷新后显示新标题

---

## 阶段 6：CRUD API 接入与版本日志

**目标：** 完成所有后端 API，接入创建、编辑、图片上传、版本记录、发布控制。

**API 文件清单：**

| 路由 | 文件 | 方法 |
|------|------|------|
| `/api/recipes` | `app/api/recipes/route.ts` | GET（列表）、POST（新建） |
| `/api/recipes/[slug]` | `app/api/recipes/[slug]/route.ts` | GET（单条）、PATCH（编辑）、DELETE |
| `/api/recipes/[slug]/revisions` | `app/api/recipes/[slug]/revisions/route.ts` | GET（列表）、POST（新增修订） |
| `/api/admin/upload-recipe-image` | `app/api/admin/upload-recipe-image/route.ts` | POST（图片上传 R2） |

**每个 API 统一模式：**
- 首行：`if (!await isAdminRequest()) return 403`（写操作）
- 使用 `supabaseAdmin` 执行 DB 操作
- 写操作成功后调用 `revalidateTag('recipes')` 和 `revalidateTag('recipe-${slug}')`
- 图片上传参照 `app/api/admin/upload-image/route.ts` 的 R2 路径+压缩模式

**验证：** 用 curl 或浏览器测试 GET `/api/recipes`，POST 新建一条菜谱，PATCH 编辑成功

---

## 阶段 7：移动端适配、搜索接入、可访问性收尾

**目标：** 移动端可用，搜索可发现，动画安全。

**任务：**
1. **移动端布局**（`book-shell.css` + `RecipeSpread.tsx`）：
   - `@media (max-width: 768px)`：`.book` 改为单列（`grid-template-columns: 1fr`），左右页垂直堆叠
   - 书本 sprite 动画在移动端改为简单的 `opacity` 过渡（sprite 在小屏不合适）
   - 书签改为底部固定浮动操作条（`position: fixed; bottom: 0`）
2. **scroll-timeline 降级**：
   ```css
   @supports not (animation-timeline: scroll()) {
     /* 回退：切换 currentPage state 驱动 transform */
   }
   ```
3. **reduced motion 降级**：`@media (prefers-reduced-motion: reduce)` 禁用 sprite/flip 动画，直接显示内容
4. **搜索接入**：若 `/search` 支持内部链接，在 `lib/recipes.ts` 添加接口供搜索索引调用
5. **ARIA**：BookShell 添加 `role="region"` + `aria-label`；翻页按钮添加 `aria-label`
6. **ISR/CDN 性能**：确认 `unstable_cache` tags 正确失效；`/recipe` 路由 CDN 头生效

**验证：** 手机尺寸（375px）下内容完整可读，减弱动画模式下无异常闪烁

---

## 关键文件总览

**新建：**
- `supabase/migrations/029_recipes.sql`
- `lib/recipes.ts`
- `app/recipe/page.tsx`
- `app/recipe/[slug]/page.tsx`（alias/redirect）
- `app/api/recipes/route.ts`
- `app/api/recipes/[slug]/route.ts`
- `app/api/recipes/[slug]/revisions/route.ts`
- `app/api/admin/upload-recipe-image/route.ts`
- `components/recipe/BookShell.tsx` + `book-shell.css`
- `components/recipe/TableOfContentsPage.tsx`
- `components/recipe/RecipeSpread.tsx`
- `components/recipe/RecipeLeftPage.tsx`
- `components/recipe/RecipeRightPage.tsx`
- `components/recipe/FlavorRadar.tsx`（fork `components/MultiDimRating.tsx`）
- `components/recipe/SkillTreeGraph.tsx`（D3，参照 `components/spotify/SpotifyTagStreamChart.tsx`）
- `components/recipe/RevisionTimeline.tsx`
- `components/recipe/RecipeBookmarks.tsx`
- `components/recipe/InlineEditor.tsx`
- `hooks/useRecipeEditor.ts`

**修改：**
- `components/ToolsCard.tsx`（lines 25-68，添加菜谱入口）
- `next.config.ts`（添加 `/recipe` CDN 缓存头）

**复用（不修改）：**
- `components/PageHero.tsx`（Hero 直接复用）
- `lib/auth.ts` → `isAdminRequest()`
- `lib/supabase-admin.ts` → `supabaseAdmin`
- `lib/r2.ts` → `putR2Object()`
- `components/AuthProvider.tsx` → `useAuth()`
- `@hello-pangea/dnd`（食材/步骤拖拽排序）

---

## 端到端验证检查单

- [ ] `npm run build` 无 TS 报错
- [ ] `/recipe` 页加载，Hero + 书本壳可见
- [ ] 首个 carousel-item 为目录页，后续为菜谱 Spread
- [ ] Chrome/Edge 中滚动触发 sprite 翻页动画
- [ ] 风味雷达 6 轴正常渲染（含数据时填充多边形）
- [ ] 技能图谱：有前置关系时显示节点+连线
- [ ] 管理员登录 → 书签出现 → 编辑态切换 → 保存成功 → 数据刷新
- [ ] 版本日志：新建修订后时间轴新增条目
- [ ] 移动端（375px）：单页堆叠，内容可读
- [ ] `prefers-reduced-motion: reduce`：无 sprite 动画，内容正常展示
- [ ] `npm run lint` 无报错
