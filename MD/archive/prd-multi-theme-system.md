# PRD：多主题系统（暗色模式 + 渐变色方案）

**状态**：待办（设计对齐已完成，准备开发）  
**优先级**：中  
**预估工时**：2-3 小时

---

## 背景与动机

当前主题系统存在两个问题：

1. **Hydration 闪烁**：Navbar 用 `useEffect` 读取 localStorage 来恢复主题，导致首屏渲染时出现短暂的主题不一致（白底闪成深色，或反之）。
2. **功能局限**：只有亮色/暗色二选一，缺乏个性化空间。用户希望提供一组渐变色主题方案，提升视觉品质和可玩性。

---

## 目标

- 彻底解决 hydration 闪烁问题。
- 支持 亮色默认 / 暗色 / 多套亮色渐变主题（海洋、日落、森林） 的独立切换。
- 主题选择持久化，刷新不丢失。
- 替换现有的硬编码颜色，引入渐变色相关的 CSS 变量以提升质感。

---

## 技术方案

### 核心依赖

引入 `next-themes` 库，替换 Navbar 中现有的手写 toggle 逻辑。使用 `ThemeProvider` 可以在 React hydration 之前注入 `<script>` 完成主题恢复，彻底消除闪烁。

### 主题体系设计 (更新版)

根据设计确认，**渐变色全部归属为亮色模式，暗色模式作为独立的方案**。
因此，抛弃原计划的双属性 (`data-theme` + `class="dark"`) 叠加方案。直接使用 `next-themes` 默认的 `attribute="class"` 作为控制。

共计5套独立主题方案：
- `light`（默认主题，紫色调）
- `dark`（统一暗色模式，深色调）
- `ocean`（海洋主题，蓝/靛渐变，亮底）
- `sunset`（日落主题，橙/玫红渐变，亮底）
- `forest`（森林主题，绿/青渐变，亮底）

### CSS 变量结构

在 `app/globals.css` 中，扩展原有的 `:root` 变量表：

```css
/* ── 默认亮色主题（当前紫色系） ── */
:root {
  --primary: #7c3aed;
  /* 新增渐变变量 */
  --gradient-primary: linear-gradient(135deg, #7c3aed, #c084fc);
  /* ... */
}

/* ── 统一暗色主题 ── */
.dark {
  --primary: #a78bfa;
  --gradient-primary: linear-gradient(135deg, #a78bfa, #c084fc);
  /* ... */
}

/* ── 海洋主题 ── */
.ocean {
  --background: #F5F5F7; /* 保持明色底，或者其他亮色配置 */
  --primary: #0ea5e9;
  --ring: #0ea5e9;
  --gradient-primary: linear-gradient(135deg, #0ea5e9, #6366f1);
}

/* ── 日落主题 ── */
.sunset { 
  /* 类似上述设定... */
}

/* ── 森林主题 ── */
.forest {
  /* 类似上述设定... */
}
```

### 渐变生效范围规划

除了基础色调的改变，`--gradient-primary` 渐变变量将在以下关键区域生效，以提升设计感：
1. Navbar 的 Logo 背景块。
2. PostCard 的占位封面图（取代现有的硬编码数组随机）。
3. 主按钮（如需要强调的Primary Button）。
4. 各个卡片的选中/高亮状态等。

---

## 实现步骤

### Step 1：安装依赖与配置
- 安装：`npm install next-themes`
- 修改 `app/layout.tsx`：引入 `<ThemeProvider>` 包裹应用，取消 `<body>` 上硬编码的 `bg-[#F5F5F7]`，改为完全依赖 `bg-background`（或使用 CSS 里的默认声明），否则主题切换背板不会刷新。

### Step 2：扩展 globals.css
- 构建 `ocean`, `sunset`, `forest` 的 CSS 类及其专属变量集合。
- 重点引入 `--gradient-primary`。
- 修正 Prose（博客正文）暗色模式的相关选择器，确保采用类似 `:where([class~="dark"]) .prose` 等不会被干扰的做法。

### Step 3：新的 Theme 选择 UI
- 移除 Navbar 原来的 toggle 逻辑。引入 `useTheme`。
- 新增一个带**弹出式菜单**的交互组件：在 Navbar 的主题按钮被点击时，弹出一个菜单，包含上述5种方案的名字和对应预览色块。

### Step 4：清理硬编码颜色
- 全局搜索并清理项目中散落的 `bg-[#F5F5F7]`, `bg-[#1D1D1F]`, `text-[#1D1D1F]` 等硬编码值，用对应的语义化 CSS 变量替换，保证各主题色系自洽。

### Step 5：检验与完善
- 运行应用并检验首屏刷新是否存在白屏向黑屏的闪动现象。
- 逐个切换所有主题方案，确认配色更新且一致，持久化正常。

---

## 验收标准

- [ ] 首屏不再有 Hydration 所致的主题闪烁。
- [ ] 5套主题无缝切换，下拉菜单交互流畅、状态记忆正确。
- [ ] 关键位置（如 Logo 背景、文章占位图等）成功渲染新的渐变颜色。
- [ ] 移动端显示与交互正常。
- [ ] 不再存在使得深色模式漏出刺面白底的硬编码 CSS 类属性。
