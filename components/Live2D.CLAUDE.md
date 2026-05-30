# Live2D.tsx — CLAUDE.md

桌面端首页吉祥物(tororo 猫)。`BlogHero.tsx` 通过 `next/dynamic` + `ssr:false` 懒加载,仅 `lg+` 渲染。渲染层 = **PixiJS v6 + `pixi-live2d-display@0.4.0`(`/cubism2` 入口)**。

> 历史背景:此前用的是裸 `loadlive2d` 全局函数(2019 年起官方下架的 Cubism 2.1 widget),其内部 rAF 无法暂停。重写为 Pixi 是为了拿到可控的 ticker。

## 硬约束(改之前务必读)

1. **Pixi 锁死 v6,不要升级。** `pixi-live2d-display@0.4.0` 的 peerDependencies 是 `@pixi/* ^6`。升到 Pixi 7/8 会运行时崩溃。真要上新 Pixi,必须**换库**(维护中的 `pixi-live2d-display-lipsyncpatch`,或 PixiJS v8 的 `untitled-pixi-live2d-engine`),不是改版本号能解决的。

2. **外部 Cubism 2 core 脚本是必需的,别删。** `/cubism2` 入口**不打包** Cubism 2.1 运行时,它挂的是全局 `Live2D` / `Live2DModelWebGL` / `UtSystem`。这些由 `live2d_engine_js_url` 指向的脚本注入(见 `ensureCubism2Core`)。看到「已经用 pixi 了」就删这个脚本 → 猫直接加载失败。
   - 当前默认 `cdn.arthurlovegrace.top/js/live2d.js` 经实测是 **core + widget 的完整包**(暴露上述全局)。`live2d_engine_js_url` 若要改,必须指向 Cubism 2 **core** 构建,不能是只有 `loadlive2d` 的纯 widget。

3. **`npm audit` 的两个 critical 是噪音,不要 `audit fix --force`。** 它们(`pixi-live2d-display ← gh-pages` 和 `gh-pages` 本身)根因是 pixi-live2d-display 把部署 CLI `gh-pages` 误声明成了普通 dependency。`dist/` 运行时代码从不 import 它,进不了客户端 bundle。上游 0.4.0 已不维护、修不了;强行 fix 会动到 pixi 包、可能弄坏挂件。

## 非显而易见的耦合

暂停渲染的逻辑跨「一个 observer + 两个 effect」:`IntersectionObserver` → `isVisible` → `app.ticker.start()/stop()`。且模型用 `autoUpdate:false`(原因见源码注释),**手动 ticker 是唯一推进动作/物理的东西**——所以停 ticker 能真正完全暂停。改其中任一环(比如图省事设 `autoUpdate:true`)都会让「滚出视口暂停」失效,退回老版本那个停不下来的循环。

## 配置来源

`live2d_model_url`、`live2d_engine_js_url`、`live2d_canvas_width/height` 全部来自 `useSiteConfig()`(DB 站点配置,经 `SiteDataProvider`),不是写死的。改尺寸/换模型走配置,不改代码。
