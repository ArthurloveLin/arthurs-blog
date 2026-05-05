# 留言板便签纸（Guestbook Note）实现计划

## Context

在博客首页 Hero 区域添加一个拟物风格的"便签纸"留言板组件，复用现有评论后端（`/api/comments`）。默认状态自动滚动展示留言，点击后展开可输入留言。整体风格拟物、优雅，以 CSS 实现便签质感与动态效果。

---

## 数据层方案

### 复用现有 API
无需新建 API。直接使用 `/api/comments`（GET/POST）和 `/api/comments/[id]`（DELETE），传入：
- `target_type: 'guestbook'`
- `target_id: 'a0000000-0000-0000-0000-000000000001'`（固定 UUID 常量）

现有 API 无 `target_type` 值校验，可直接扩展。

### 新增迁移文件：`supabase/migrations/017_guestbook.sql`
```sql
-- 017_guestbook.sql
-- 留言板固定目标 UUID: a0000000-0000-0000-0000-000000000001
-- target_type = 'guestbook' 无需表结构变更，comments 表已支持任意 target_type。

-- 便于查询的视图（可选）
CREATE OR REPLACE VIEW guestbook_messages AS
  SELECT id, author, content, created_at, parent_id
  FROM comments
  WHERE target_type = 'guestbook'
    AND target_id = 'a0000000-0000-0000-0000-000000000001'
  ORDER BY created_at DESC;
```

### 常量定义：`lib/constants.ts`（新建或追加）
```ts
export const GUESTBOOK_TARGET_ID = 'a0000000-0000-0000-0000-000000000001'
export const GUESTBOOK_TARGET_TYPE = 'guestbook' as const
```

---

## 前端组件：`components/GuestbookNote.tsx`

### 两种状态
| 状态 | 外观 | 交互 |
|------|------|------|
| `collapsed`（默认）| 小便签，自动淡入淡出轮播留言 | 点击任意处展开 |
| `expanded` | 便签放大，显示留言列表 + 输入框 | 点击外部 / × 按钮收起 |

### CSS 拟物设计要点
```
便签纸本体：
  background: linear-gradient(135deg, #fef9c3 0%, #fef08a 100%)  // 淡黄色
  dark mode: #3d3a20 → #4a4520
  box-shadow: 3px 6px 20px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.6)
  border-radius: 2px
  transform: rotate(-1.5deg)  // 微斜

图钉（::before）：
  position: absolute; top: -8px; left: 50%
  width: 14px; height: 14px
  background: radial-gradient(circle at 35% 35%, #e53e3e, #9b2c2c)
  border-radius: 50%
  box-shadow: 0 2px 4px rgba(0,0,0,0.4)

折角（::after）：
  position: absolute; bottom: 0; right: 0
  border: 14px solid transparent
  border-bottom-color: rgba(0,0,0,0.08)
  border-right-color: rgba(0,0,0,0.08)

展开动画：
  CSS transition: all 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)  // spring feel
  展开时 rotate(0deg) scale(1.02)，收起时 rotate(-1.5deg)
```

### 留言滚动（collapsed 状态）
使用 `useEffect` + `setInterval(3000ms)` 循环索引，配合 CSS `opacity` 过渡淡入淡出切换留言。

### 留言列表（expanded 状态）
- 最新留言在上（降序）
- 每条留言：作者名（加粗）+ 内容 + 时间
- 不支持嵌套回复（留言板语义更扁平）
- 自己的留言旁显示删除 `×`（复用 `useAuth` 的 `identity` 逻辑）

### 输入表单
- 使用 `useAuth` 的 `identity` 作为 `author`
- 单行输入 + 发送按钮（主题色换成暖黄系）
- 不传 `parent_id`（留言板不需要回复层级）

---

## 服务端预取

### `app/page.tsx` 改动
在 `HomePage` Server Component 中并行预取留言：
```ts
const [posts, guestbookComments] = await Promise.all([
  getPostsByYear(...).catch(...),
  supabaseAdmin
    .from('comments')
    .select('id, author, content, created_at')
    .eq('target_type', 'guestbook')
    .eq('target_id', GUESTBOOK_TARGET_ID)
    .order('created_at', { ascending: false })
    .limit(30)
    .then(({ data }) => data ?? [])
    .catch(() => [])
])
```
将 `guestbookComments` 作为 prop 传入 `<BlogPage>`。

### `components/BlogPage.tsx` 改动
1. 新增 `initialGuestbookComments` prop
2. 在 Hero 区域内插入 `<GuestbookNote initialComments={initialGuestbookComments} />`
3. Hero 容器已有 `relative`，便签使用 `absolute` 定位（桌面端右侧），移动端 `static` 流布局

---

## 定位方案（Hero 内）

```
Hero 区域（relative, overflow-hidden）
├── Blob 装饰（absolute, pointer-events-none）
├── 内容区（max-w-7xl）
│   ├── 标题、描述文字（左侧）
│   ├── Live2D（右下）
│   └── GuestbookNote（absolute right-6 bottom-6 lg:right-10 lg:bottom-8）
│       collapsed: w-48, rotate(-1.5deg)
│       expanded:  w-72, z-20, rotate(0deg), shadow-xl
```

移动端（`< md`）：`static` 布局，展示在 Hero 底部，宽度 full。

---

## 需修改/新建的文件

| 文件 | 操作 | 说明 |
|------|------|------|
| `supabase/migrations/017_guestbook.sql` | 新建 | 留言板视图 + 常量注释 |
| `lib/constants.ts` | 新建/追加 | `GUESTBOOK_TARGET_ID` 常量 |
| `components/GuestbookNote.tsx` | 新建 | 便签组件（主要工作） |
| `components/BlogPage.tsx` | 修改 | 注入 `GuestbookNote`，接收新 prop |
| `app/page.tsx` | 修改 | 并行预取 guestbook 留言 |

---

## 验证方案

1. `npm run dev` 访问首页，确认便签出现在 Hero 区域
2. 留言为空时：便签显示占位文案（"暂无留言，来留下第一条吧~"）
3. 有留言时：collapsed 状态每 3s 淡入淡出切换显示
4. 点击便签 → 展开，显示留言列表 + 输入框
5. 输入留言提交 → 列表实时更新，无需刷新
6. 自己的留言出现删除按钮，点击后列表更新
7. 点击便签外部 → 自动收起
8. 暗色模式下颜色协调（深棕黄系便签纸）
9. `npm run build` 无类型错误
