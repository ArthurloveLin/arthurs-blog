# Life Gallery — LifeGallerySlider

全屏电影感轮播组件。5 层叠卡布局 + GSAP 动画 + canvas 取色背景。

## File Map

```
LifeGallerySlider.tsx      — 单文件，739 行，全部逻辑在此
LifeGallerySlider.module.css — 样式隔离（sliderSlide、sliderTitleLine 等）
lib/life-gallery.ts        — 服务端 R2 读取，LifeGalleryRound / LifeGallerySlide 类型
app/life-gallery/page.tsx  — 服务端：拉取 initialRound，传入 LifeGallerySlider
```

## 关键常量（时序耦合，不可独立修改）

```ts
const AUTOPLAY_DELAY = 4000       // 自动播放间隔（ms）
const NAVIGATION_LOCK_MS = 900    // 导航冷却（ms）—— 必须 < AUTOPLAY_DELAY
const TRANSITION_DURATION = 0.72  // GSAP 动画时长（s）—— 必须 < NAVIGATION_LOCK_MS / 1000
```

三者强耦合：`TRANSITION_DURATION * 1000 < NAVIGATION_LOCK_MS < AUTOPLAY_DELAY`。调整任意一个必须同步检查其他两个。

## 5 层叠卡布局

每次渲染维护 5 个 DOM 节点（`slideEntriesRef`），对应 step -2 / -1 / 0 / 1 / 2。`getSlideProps(step)` 返回硬编码位置表（x、y、rotation、scale、blur、opacity），是 `positionSlide` 的唯一来源。导航时：
1. GSAP 动画旧 step 位置 → 新 step 位置（`animateSlides`）
2. 用 `mod(index, total)` 计算循环索引，替换滑出视野的卡片内容（`replaceSlideContent`）

`mod()` 用 `((index % total) + total) % total` 实现，处理 JS 对负数取模的错误结果。不能用 `index % total`。

## 背景颜色提取

每张幻灯片切换时，背景色从对应图片的像素中提取（`extractColorFromSlide`）：
1. 渲染缩略图（72×72 canvas）
2. 采样每第 16 个像素取 RGB 均值
3. 乘以 0.52 压暗（电影感黑底效果）
4. 存入 `colorCacheRef`（Map，key = slide.key），避免重复提取

降级：图片加载失败时用 `getFallbackBackdrop(seed)` 生成 hash-based HSL 颜色（确定性，同一张幻灯片总返回同色）。

`syncBackgroundColor` 检查 `activeBackgroundKeyRef.current` 防止异步竞态：如果颜色提取期间用户已切换到另一张幻灯片，回调中丢弃过期结果。

## 导航锁

`animatingRef.current = true` 在动画开始时置位，动画完成（GSAP `onComplete`）后清除。`NAVIGATION_LOCK_MS` 作为 throttle 限制，双保险防止 GSAP 动画未结束时再次触发。

`advanceRef`/`retreatRef` 存储对导航函数的稳定引用（而非在 `useEffect` 里捕获闭包），供 autoplay 定时器和键盘事件回调调用，避免失活闭包持有旧 state。

## Autoplay 与 preload

切换到新幻灯片时立即 `preloadRound(round)` 预加载所有图片（创建 `new Image()` + 触发颜色提取）。Autoplay 定时器在每次手动导航后重置。`reducedMotionRef` 在 `useEffect` 中读取 `prefers-reduced-motion`，为 true 时 `duration` 设为 0.01s，`stagger` 设为 0。

## 硬约束

- throttle / debounce 为本地实现（`throttle()` / `debounce()`），不依赖 lodash。不要引入外部工具函数替换，样式与计时与 GSAP 有精确配合。
- GSAP 动画必须使用 `force3D: true` 以触发 GPU 合成层，去掉后低端设备会掉帧。
- 标题字符动画（`animateTitle`）对每个 Unicode 字符单独创建 `<span>`，空格用 ` ` 代替（普通空格在 CSS 中会被折叠）。
- `getOptimizedImageUrl` 当前直接返回原始 URL（`void width / quality`），是预留桩位，不要删除参数签名。
