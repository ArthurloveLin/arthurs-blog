# Behind the Lyrics — Design Rationale

> Genius-style annotated lyric reader with hover popover + pinning interaction.

---

## 一、产品背景与设计目标

本组件是音乐播放器内嵌的"歌词注释"阅读模式，参考 Genius "Behind the Lyrics" 功能。

**核心目标**
1. **让歌词有诗的气质** — 去掉干扰性底色/胶囊，保留手写字体本身的节奏感
2. **注释与歌词强关联** — 用视觉手段把"被注释的词"和右侧注释卡明确绑定
3. **渐进式信息披露** — 不读注释时，注释不打扰；想读时，流畅浮现
4. **专辑氛围沉浸** — 配色从专辑封面取色，每首歌有自己的调性

---

## 二、版式系统

### 字体选型

| 用途 | 字体 | 原因 |
|------|------|------|
| 歌词正文 | **Caveat** (cursive) | 手写质感，保留艺术个性；可用 Patrick Hand 备选 |
| 标题 / 引言 | **Fraunces** (variable serif) | 可变字轴（SOFT/WONK）适合音乐场景的戏剧感；比 Playfair 更当代 |
| UI / 注释正文 | **Inter** | 高密度文本可读性最优 |

> 避免了 Roboto / Arial / system-ui 等过度中性的字体；Fraunces 的 `opsz` 可变轴在大小尺寸下自动调整衬线粗细。

### 颜色逻辑

专辑色盘（以 drop dead / Olivia Rodrigo 为例）：

```
--bg      #F4EFE6   ← 奶油纸底（暖）
--ink     #2A1F2C   ← 深茄紫（比纯黑柔）
--accent  #7A4FB5   ← 薰衣草紫（封面主色）
--accent2 #C8689B   ← 脏玫瑰（封面副色）
--warm    #E8A14B   ← 暖金（Premium / 高亮点）
```

**取色策略（生产实现建议）：**
1. 服务端用 `sharp` 或 `@canvas/image` 从 CDN 专辑图提取调色板
2. 提取 5 色（K-means 聚类），选出饱和度最高的 2 色作为 `accent / accent2`
3. 背景固定用浅奶油 + 噪点纹理，不跟随封面，避免反差太强

### 背景层次

```
bg-wash   → radial-gradient 从上往下，paper → bg → bgDeep
bg-grain  → SVG feTurbulence 噪点，opacity .14，mix-blend-mode: multiply
bg-glow-1 → accent 色径向模糊光晕，左上角
bg-glow-2 → accent2 色径向模糊光晕，右中
```

这构成一个"纸张 + 印刷油墨渗透"的视觉基底，而非塑料感渐变。

---

## 三、核心交互设计

### 状态机

每个被注释词组（`Phrase`）有以下状态：

```
idle → hovered → active(hover)
idle → clicked → pinned (sticky)
pinned → Esc / × → idle
```

右侧注释卡（`AnnotationCard`）镜像同样状态：
- 任何 phrase active → 对应 card `is-active`，其他 card `is-dimmed`
- Card hover → 对应 phrase 高亮，歌词区滚到可见
- Card click → 等同 phrase click，pin 状态

### Hover → Popover

Popover **不挂载在 phrase DOM 内**，而是 `position: fixed` 浮层，避免 `overflow: hidden` 截断。

坐标计算逻辑：
1. 未 pin：`mousemove` 实时更新坐标（跟随光标 + 18px offset）
2. 已 pin：锚定 phrase 的 `getBoundingClientRect()`，定位在其右侧
3. 视口 clamp：右边超出 → 翻转到左侧；下边超出 → 上移

### Pin / Unpin

```
click phrase → setPinnedId(id)
click same phrase again → setPinnedId(null)
Esc → setPinnedId(null)
Popover × → setPinnedId(null)
```

Pin 状态时：
- 对应 phrase 加 `is-pinned` class（background fill + border）
- 对应 card 加 `is-pinned` class（左移 + 加深阴影）
- Header 显示 "Clear pin · Esc" 快捷按钮
- Popover 变 `pointer-events: auto`，显示 × 关闭按钮

---

## 四、高亮样式系统

4 种高亮方案，通过 `data-hl` 属性切换，CSS attribute selector 控制：

| 方案 | 视觉表现 | 适用场景 |
|------|----------|----------|
| `dashed` | 虚线下划线 → hover 变实线 | **默认**，最克制，像学术注释 |
| `solid` | 实线下划线，hover 加色 | 经典 Genius 风格 |
| `fill` | 底部高亮色块（warm 25%）| 荧光笔感，适合强调密集段落 |
| `edge` | 左竖线 bracket | 最极简，适合大字号 |

实现上全用 CSS `background-image` + `background-size` 模拟，无需额外 DOM 元素。

---

## 五、响应式断点

| 断点 | 布局变化 |
|------|----------|
| > 1080px | 双栏网格 `1.35fr / 1fr`，全尺寸 |
| 920–1080px | 双栏网格 `1.2fr / 320px min`，标题缩小至 38px |
| < 920px | 单栏，rail 从 `position: sticky` 变 static，max-height: 60vh scroll |

Popover 在移动端：`width: calc(100vw - 32px)`，始终 clamp 在视口内。

---

## 六、组件树

```
<BehindTheLyricsPage>
  ├── <Backdrop />            背景光晕 + 噪点
  ├── <Header />              标题 + 元信息 + Clear Pin 按钮
  ├── <div.grid>
  │   ├── <section.lyrics>   歌词区
  │   │   └── <Phrase />     可注释词组（inline span）
  │   └── <aside.rail>       注释列表
  │       └── <AnnotationCard />
  └── <Popover />            fixed 浮层，挂在 root 下
```

状态管理完全在 `BehindTheLyricsPage` 层（`hoveredPhrase`, `pinnedId`, `anchorEl`），子组件无状态，通过 props 驱动，便于测试和 SSR。

---

## 七、数据结构

```typescript
// 一首歌的结构
interface Track {
  title: string
  artist: string
  album: string
  palette: AlbumPalette
  sections: Section[]
}

// 歌词段落
interface Section {
  label: string | null          // 'Chorus' | 'Verse 2' | null
  lines: Segment[][]            // 每行歌词 = 若干 segment 的数组
}

// 歌词片段（一行歌词由多个 segment 拼接）
type Segment =
  | { text: string }            // 普通文本
  | { ref: string; text: string } // 可注释词组，ref 对应 ANNOTATIONS key

// 注释条目
interface Annotation {
  title: string
  quote: string
  body: string
  helpful: number
}
```

---

## 八、生产扩展建议

1. **Genius API** — 替换 hardcoded `ANNOTATIONS` 为 `GET /api/genius/annotations?trackId=xxx`，服务端 fetch 并缓存
2. **封面取色** — `GET /api/palette?coverUrl=...` 用 sharp 生成调色板，通过 CSS custom properties 注入到页面
3. **歌词同步** — 接入 LRC / TTML 格式，用 `currentTime` 驱动当前行高亮，`Phrase` 组件接收 `isCurrentLine` prop
4. **注释编辑** — `AnnotationCard` 底部 "Edit" 按钮触发 inline textarea，提交至 Genius Write API
5. **动画** — Popover 进出场用 `@starting-style` + `transition` (Chrome 117+)，或 Framer Motion `AnimatePresence` 兼容旧浏览器

---

## 九、文件结构

```
app/
├── layout.tsx              全局 font + metadata
├── page.tsx                路由入口，注入 track data
└── globals.css             CSS 变量 + reset

components/BehindTheLyrics/
├── index.tsx               主状态容器 BehindTheLyricsPage
├── Phrase.tsx              可注释 inline 词组
├── AnnotationCard.tsx      右栏注释卡
├── Popover.tsx             fixed 浮层
├── Header.tsx              顶部 Now Playing 头
├── Backdrop.tsx            背景层
└── lyrics.module.css       所有样式（CSS Modules）

data/
└── track.ts                示例数据（生产替换为 API）

lib/
└── types.ts                TypeScript 类型定义
```
