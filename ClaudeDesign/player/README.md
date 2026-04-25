# Now Playing 组件 — Next.js 16 实现

将设计稿转为可直接使用的 React 组件。

## 📁 文件结构

```
nextjs/
├── components/
│   ├── PlayerVariantC.tsx              # 暗黑版本组件
│   ├── PlayerVariantC.module.css       # 暗黑版样式
│   ├── PlayerVariantCLight.tsx         # 日间版本组件
│   ├── PlayerVariantCLight.module.css  # 日间版样式
│   └── SubComponents.tsx               # 共用子组件 (Heart, Disc, Stats)
├── hooks/
│   └── useAlbum.ts                     # 专辑色提取、播放进度 hooks
├── utils/
│   └── colorExtractor.ts               # Canvas 色彩量化工具
└── app/
    └── player-example/
        └── page.tsx                    # 使用示例页面
```

## 🚀 快速开始

### 1. 安装依赖
```bash
npm install
# 或
yarn install
```

### 2. 在页面中导入

```tsx
'use client';

import { PlayerVariantC, type TrackData } from '@/components/PlayerVariantC';
import { PlayerVariantCLight } from '@/components/PlayerVariantCLight';

const track: TrackData = {
  title: 'Song Title',
  artist: 'Artist Name',
  album: 'Album Name',
  cover: 'https://image-url.jpg',
  duration: 244,
  currentTime: 87,
  monthlyPlays: 47,
  firstPlayed: '2023.08.14',
  lastPlayed: '2 小时前',
  totalPlays: 312,
};

export default function Page() {
  return (
    <>
      {/* 暗黑版 */}
      <PlayerVariantC
        track={track}
        onMonthlyPlaysClick={() => router.push('/stats/monthly')}
        onFirstPlayedClick={() => router.push('/history')}
        onLastPlayedClick={() => router.push('/recent')}
      />

      {/* 日间版 */}
      <PlayerVariantCLight
        track={track}
        onMonthlyPlaysClick={() => {}}
        onFirstPlayedClick={() => {}}
        onLastPlayedClick={() => {}}
      />
    </>
  );
}
```

## 🎨 组件 Props

### PlayerVariantC / PlayerVariantCLight

```tsx
interface PlayerVariantCProps {
  track: TrackData;
  onMonthlyPlaysClick?: () => void;      // 本月播放点击回调
  onFirstPlayedClick?: () => void;        // 首次播放点击回调
  onLastPlayedClick?: () => void;         // 最近播放点击回调
}

interface TrackData {
  title: string;                         // 歌曲标题
  artist: string;                        // 歌手名
  album: string;                         // 专辑名
  cover: string;                         // 专辑封面 URL (CORS)
  duration: number;                      // 总时长 (秒)
  currentTime: number;                   // 当前播放位置 (秒)
  monthlyPlays: number;                  // 本月播放次数
  firstPlayed: string;                   // 首次播放时间
  lastPlayed: string;                    // 最近播放时间
  totalPlays: number;                    // 总播放次数
}
```

## 🎯 核心特性

- **自动取色**：从专辑封面提取主色，用于进度条、强调元素、光晕
- **实时进度**：每秒更新播放进度（可基于实际播放状态修改）
- **响应式 hover**：统计卡片 hover 时高亮并上浮
- **可点击统计**：三个统计项都可点击，可链接到对应页面
- **无需外部图标库**：所有 SVG 内联，保证加载速度
- **CSS Modules**：样式隔离，避免冲突
- **TypeScript**：完整类型定义

## 🛠️ 自定义

### 改变组件尺寸
在对应的 `.module.css` 中修改 `.container` 的 `width` 和 `height`：
```css
.container {
  width: 1040px;  /* 改这里 */
  height: 480px;  /* 改这里 */
}
```

### 改变进度自动走动的速度
在 `hooks/useAlbum.ts` 中修改 `setInterval` 的间隔：
```tsx
const id = setInterval(() => {
  setTime((t) => (t + 1) % totalDuration);
}, 1000); // 改成 500 是 0.5 秒走 1 秒
```

### 禁用自动播放进度
```tsx
const { time, playing, setPlaying } = usePlayback(track.duration);
// 改为
const [time, setTime] = useState(track.currentTime);
// 不再自动更新，除非手动调用 setTime
```

### 改变爱心跳动速度
在组件中修改 `HeartBeat` 的 `playing` 属性，或改 CSS 动画：
```css
@keyframes heartbeat {
  /* 改这里的时间 */
  0%, 100% { transform: scale(1); }
  14% { transform: scale(1.25); }
  /* ... */
}
```

## 📊 浏览器兼容性

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

（支持所有现代浏览器的 Canvas、CSS Grid、backdrop-filter）

## 🔗 相关文件

- 设计稿预览：[Now Playing.html](../Now%20Playing.html)
- 共用工具：`utils/colorExtractor.ts`
- 共用 hooks：`hooks/useAlbum.ts`
- 子组件库：`components/SubComponents.tsx`

## 📝 Notes

- 专辑封面 URL 需要支持 CORS（跨域资源共享），否则 Canvas 取色会失败
- 在生产环境中，可考虑在后端预先计算专辑主色，避免客户端 Canvas 操作
- 进度条走动是演示用，实际应连接到音乐播放器的真实进度状态
