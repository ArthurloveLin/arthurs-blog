# PRD：多主题系统（暗色模式 + 渐变色方案）

**状态**：待办（性能优化完成后执行）  
**优先级**：中  
**预估工时**：2-3 小时

---

## 背景与动机

当前主题系统存在两个问题：

1. **Hydration 闪烁**：Navbar 用 `useEffect` 读取 localStorage 来恢复主题，导致首屏渲染时出现短暂的主题不一致（白底闪成深色，或反之）。这是 perf-optimization-plan Step 14 记录的问题。

2. **功能局限**：只有亮色/暗色二选一，缺乏个性化空间。用户希望提供一组渐变色主题方案，提升视觉品质和可玩性。

---

## 目标

- 彻底解决 hydration 闪烁问题
- 支持亮色 / 暗色 / 多套渐变主题自由组合
- 主题选择持久化，刷新不丢失
- 对现有组件改动最小（利用已有 CSS 变量体系）

---

## 技术方案

### 核心依赖

引入 `next-themes` 库，替换 Navbar 中现有的手写 toggle 逻辑。

`next-themes` 的优势：
- 在 React hydration 之前注入 `<script>` 完成主题恢复，彻底消除闪烁
- 原生支持多主题（不只是 dark/light）
- 兼容 Tailwind CSS + CSS 自定义属性方案
- API 简单，迁移成本低

### 主题标识机制

在 `<html>` 元素上使用双属性标记：

```html
<!-- 示例：海洋主题 + 暗色模式 -->
<html data-theme="ocean" class="dark">
```

- `data-theme`：控制配色方案（default / ocean / sunset / forest）
- `class="dark"`：控制明暗（叠加在配色方案之上）

### CSS 变量结构

在 `globals.css` 中，每个主题定义一套完整的 CSS 变量，明暗各一套：

```css
/* ── 默认主题（当前紫色系，保持不变） ── */
:root { ... }
.dark { ... }

/* ── 海洋主题 ── */
[data-theme="ocean"]:root { ... }
[data-theme="ocean"].dark { ... }

/* ── 日落主题 ── */
[data-theme="sunset"]:root { ... }
[data-theme="sunset"].dark { ... }

/* ── 森林主题 ── */
[data-theme="forest"]:root { ... }
[data-theme="forest"].dark { ... }
```

每套主题在现有 token 基础上额外引入渐变变量：

```css
[data-theme="ocean"] {
  --primary: #0ea5e9;
  --ring: #0ea5e9;
  --gradient-primary: linear-gradient(135deg, #0ea5e9, #6366f1);
  --gradient-accent: linear-gradient(135deg, #06b6d4, #3b82f6);
}
```

### 初步配色方案设计

| 主题 | 主色调 | 渐变方向 | 关键词 |
|------|------|------|------|
| **default** | 紫色 `#7c3aed` | - | 当前样式，保持不变 |
| **ocean** | 天蓝 `#0ea5e9` | 蓝→靛 | 清爽、科技感 |
| **sunset** | 橙色 `#f97316` | 橙→玫红 | 温暖、活力 |
| **forest** | 翠绿 `#10b981` | 绿→青 | 自然、沉静 |

---

## 实现步骤

### Step 1：安装依赖（5 分钟）

```bash
npm install next-themes
```

### Step 2：接入 ThemeProvider（15 分钟）

修改 `app/layout.tsx`，用 `ThemeProvider` 包裹：

```tsx
import { ThemeProvider } from 'next-themes'

export default function RootLayout({ children }) {
  return (
    <html suppressHydrationWarning>
      <body>
        <ThemeProvider
          attribute={['class', 'data-theme']}
          defaultTheme="system"
          themes={['light', 'dark', 'ocean', 'ocean-dark', 'sunset', 'sunset-dark', 'forest', 'forest-dark']}
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
```

### Step 3：扩展 globals.css（60 分钟）

为 ocean / sunset / forest 三套主题各自定义亮色和暗色变量集，复用现有 token 结构。

### Step 4：改造 Navbar 主题切换 UI（45 分钟）

将现有的单按钮 toggle 改为主题选择器，方案选项：

**方案 A（简洁）**：下拉菜单，列出所有主题名称  
**方案 B（直观）**：小色块选择器，点击色块切换主题，当前主题高亮显示  
**推荐 B**，视觉更直观，在 Navbar 右侧 icon 区域占空间也少

Navbar 逻辑替换：

```tsx
// 删除现有手写逻辑
- const [theme, setTheme] = useState<'light' | 'dark'>('light')
- useEffect(() => { ... }, [])
- const toggleTheme = () => { ... }

// 替换为
+ import { useTheme } from 'next-themes'
+ const { theme, setTheme } = useTheme()
```

### Step 5：验证 hydration 无闪烁（15 分钟）

在 `<html>` 上加 `suppressHydrationWarning`，next-themes 会在 hydration 前同步主题，无需其他处理。

---

## 验收标准

- [ ] 刷新页面不出现主题闪烁
- [ ] 4 套主题可正常切换，亮暗各独立保存
- [ ] localStorage 持久化，关闭后重新打开主题不丢失
- [ ] 移动端主题切换入口可用
- [ ] 现有所有页面（首页、博客、衣橱、Session）在各主题下显示正常

---

## 风险与注意事项

- **Prose（博客正文）样式**：`globals.css` 中有大量 `.dark .prose` 覆盖规则，新主题也需要对应补充，否则博客暗色下文字颜色会不对。建议抽象成 `.themed .prose` 统一处理。
- **硬编码颜色**：Navbar 中存在少量硬编码色值（如 `bg-[#1D1D1F]`、`text-[#1D1D1F]`），在渐变主题下可能显示异常，需要替换为 CSS 变量引用。
- **渐变变量的使用范围**：渐变主题的 `--gradient-primary` 目前只是定义，需要在具体组件（按钮、卡片高亮等）中显式使用，否则渐变效果体现不出来。可以按需逐步应用，不必一次全改。

---

## 参考资料

- [next-themes 文档](https://github.com/pacocoursey/next-themes)
- 现有主题变量定义：`app/globals.css` `:root` 和 `.dark` 块
- 现有主题 toggle 逻辑：`components/Navbar.tsx` `toggleTheme` 函数
