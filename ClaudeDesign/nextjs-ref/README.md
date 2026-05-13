# Memo Workspace — Next.js 架构参考

> **仅供参考**，不可直接运行。所有样式为骨架级占位，视觉实现需要你按设计稿补充。

---

## 文件树

```
nextjs-ref/
├── app/
│   ├── globals.css          # CSS 变量 + reset（设计 token）
│   ├── layout.tsx           # Root layout — 字体、<html> 属性
│   └── page.tsx             # Server Component：fetch memos → 传 props
│
├── components/
│   ├── MemoWorkspace.tsx    # ★ Client root — 所有交互状态从这里分发
│   ├── MemoWorkspace.module.css
│   │
│   ├── sidebar/
│   │   ├── Sidebar.tsx      # 左侧栏容器（品牌 + 日历 + 筛选 + 标签）
│   │   ├── Sidebar.module.css
│   │   ├── Calendar.tsx     # 迷你月历（热力点、今日环、日期选中）
│   │   ├── Calendar.module.css
│   │   ├── TagCloud.tsx     # 标签芯片（多选、频率排序、彩点）
│   │   └── TagCloud.module.css
│   │
│   ├── topbar/
│   │   ├── TopBar.tsx       # 顶栏（标题 + 搜索 + 排序 + 视图切换 + 筛选 chip）
│   │   └── TopBar.module.css
│   │
│   └── views/
│       ├── FlowView.tsx     # 便签墙 — CSS columns 瀑布流
│       ├── FlowView.module.css
│       ├── MemoCard.tsx     # 单张便签卡（骨架）
│       ├── MemoCard.module.css
│       ├── ListView.tsx     # 时间线 — 按天分组 + sticky 日期头
│       └── ListView.module.css
│
├── hooks/
│   └── useMemoFilter.ts     # ★ 所有筛选 / 排序逻辑，useReducer 驱动
│
└── lib/
    ├── types.ts             # 核心 TypeScript 类型（Memo, Block, ViewMode…）
    ├── utils.ts             # 纯函数工具（ymd, fmtShort, aggregateTags…）
    └── sample-data.ts       # 静态示例数据（page.tsx 占位用）
```

---

## 数据流

```
page.tsx (Server)
  └─ fetch memos, aggregate tags/byDay
       └─ <MemoWorkspace initialMemos={…} today={…} byDay={…} tags={…}>  (Client)
             ├─ useMemoFilter(memos, today)  →  state, actions, visible, counts
             ├─ <Sidebar …/>                →  日历点击 / 标签切换 → actions.*
             ├─ <TopBar …/>                 →  搜索 / 排序 / 视图 → actions.*
             └─ view === "flow"
                  ? <FlowView memos={visible} onLike={…}/>
                  : <ListView memos={visible} onLike={…}/>
```

## 关键设计决策

| 决策 | 原因 |
|------|------|
| `useMemoFilter` 集中管理全部筛选状态 | 避免 prop drilling；也方便后续换成 URL search params |
| 视图组件（FlowView / ListView）无状态 | 只负责渲染，便于独立替换 |
| `MemoCard` 骨架无视觉 CSS | 颜色/胶带/阴影属于设计实现层，不耦合进结构 |
| Server Component 做 fetch | 初始页面 SSR，减少客户端 loading 态 |
| CSS Modules | 与 Next.js App Router 零配置兼容；token 用全局 CSS 变量 |

## 接入真实数据

```ts
// app/page.tsx — 替换 getMemos()
async function getMemos(): Promise<Memo[]> {
  return prisma.memo.findMany({
    orderBy: { date: "desc" },
    include: { author: true },
  });
}
```

## 乐观更新模式（reactions）

`MemoWorkspace` 中的 `handleLike` 先更新本地 state，再异步调用 API：

```ts
const handleLike = useCallback((id: string) => {
  setMemos(prev => prev.map(m =>
    m.id === id
      ? { ...m, reactions: { ...m.reactions, heart: m.reactions.heart > 0 ? 0 : 1 } }
      : m
  ));
  // await api.patch(`/memos/${id}/react`, { type: "heart" });
}, []);
```

同样的模式适用于编辑、删除、置顶。
