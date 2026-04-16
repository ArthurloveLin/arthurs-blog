     Plan: Blog Like → 完整 THANKYOU 动画迁移

     Context

     将 CodePen 的完整动画（THANKYOU! 字母逐笔绘制 + 第二行文字）迁移到博客点赞交互。点赞后在互动区正上方弹出完整动画：
     - 第一部分：THANKYOU! 字母逐笔绘制（完全保留）
     - 第二部分：原 "You're Awesome" → 替换为 "for Liking My Blog"
     - 无粉色背景，字母描边色从白色改为 plum #843B62（在白色背景上可见）
     - 彩色装饰元素（.dec：plum / blue / purple / lime）保持原色

     GSAP 2.x → 3.x 迁移对照

     ┌────────────────────────────────┬───────────────────────────────────────┐
     │             GSAP 2             │                GSAP 3                 │
     ├────────────────────────────────┼───────────────────────────────────────┤
     │ new TimelineLite({onComplete}) │ gsap.timeline({onComplete})           │
     ├────────────────────────────────┼───────────────────────────────────────┤
     │ TweenLite.to(el, dur, {prop})  │ gsap.to(el, {duration: dur, ...prop}) │
     ├────────────────────────────────┼───────────────────────────────────────┤
     │ Back.easeInOut                 │ "back.inOut"                          │
     ├────────────────────────────────┼───────────────────────────────────────┤
     │ Quad.easeOut/In                │ "quad.out"/"quad.in"                  │
     ├────────────────────────────────┼───────────────────────────────────────┤
     │ Cubic.easeOut                  │ "cubic.out"                           │
     ├────────────────────────────────┼───────────────────────────────────────┤
     │ Quart.easeInOut                │ "quart.inOut"                         │
     ├────────────────────────────────┼───────────────────────────────────────┤
     │ .timescale = 0.6               │ .timeScale(0.6)                       │
     └────────────────────────────────┴───────────────────────────────────────┘

     ▎ SVG 底层属性动画（el.x2.baseVal, el.points[0], el.rx.baseVal, strokeDashoffset）在 GSAP 3 中语法相同，仍可直接使用。

     文件改动

     1. 新建 components/ThankYouAnimation.tsx

     结构：
     - 'use client'，props：{ onComplete: () => void }
     - 用 next/font/google 加载 Oswald 700（模块级声明）
     - 内联完整 SVG（viewBox 0 0 800 280），与 CodePen 原始 SVG 保持一致
     - 用 useRef 持有每个需要动画的 SVG 元素
     - useEffect 中还原完整 GSAP timeline（参照 src/script.js）

     颜色调整（无背景适配）：
     line, polyline, ellipse, path → stroke: #843B62（plum，原为 #fff）
     .purple → stroke: #B191FF（保留）
     .lime → stroke: #DCE2AA（保留）
     .plum → stroke: #843B62（保留）
     .blue → stroke: #241E4E（保留）
     text fill → #843B62（原为 #fff）

     文字改动：
     原：<tspan>Y</tspan><tspan>O</tspan>...<tspan>E</tspan>  ("YOU'RE AWESOME")
     新：<tspan>f</tspan><tspan>o</tspan><tspan>r</tspan>...  ("for Liking My Blog")
     共 18 个字符（含空格），每个字符单独 <tspan>，对应 useRef 数组。

     Timeline 顺序： T → H → A → N → K → Y → O → U → ! → TEXT（完整保留，仅更新 tspan refs 数组长度）

     动画结束后： 整体 fade out + 调用 onComplete（在 onComplete 之前加 ~1s hold）

     2. 修改 components/ArticleEngagementPanel.tsx

     改动位置（line 170 return 处）：

     1. 新增 state：
     const [showAnimation, setShowAnimation] = useState(false)
     2. 在 handleReaction（line 117）中，当真正点赞时触发：
     const nextReaction = summary.viewer_reaction === value ? 0 : value
     if (nextReaction === 1) setShowAnimation(true)
     3. 修改 return，用外层 <div className="relative"> 包裹，在 <section> 上方绝对定位：
     return (
       <div className="relative">
         {showAnimation && (
           <div className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-3 -translate-x-1/2">
             <ThankYouAnimation onComplete={() => setShowAnimation(false)} />
           </div>
         )}
         <section className="relative overflow-hidden rounded-[32px] ...">
           {/* 原内容不变 */}
         </section>
       </div>
     )

     ▎ <section> 有 overflow-hidden，动画必须在其外部 DOM 节点上渲染，通过外层 relative div + absolute bottom-full 实现「悬浮于面板正上方」。

     尺寸与响应

     - SVG 原始 viewBox 800×280，设置 width="100%" style={{ maxWidth: 700 }}
     - 移动端自动缩放（保留 CodePen 原有的 window.innerWidth < 600 逻辑，用 onMount CSS 或 inline style 处理）

     验证步骤

     1. npm run dev
     2. 打开任意博客文章内页
     3. 点击点赞 → 互动区正上方弹出完整 THANKYOU! 逐字绘制动画
     4. 第二行显示 "for Liking My Blog" 文字淡入动画
     5. 动画结束后约 1s fade out 消失
     6. 取消点赞不触发动画
     7. 再次点赞可重新触发