# Top 50 Gallery — Next.js 集成说明

## 文件结构

把 `nextjs-export/` 下的内容放到你的 Next.js 项目：

```
your-nextjs-project/
├── data/
│   └── tracks.js              # 歌曲数据 + 占位封面生成
├── lib/
│   ├── layout.js              # 不规则布局算法
│   ├── color.js               # 主色提取
│   └── constants.js           # 常量 (CELL_SIZE / GAP / TWEAK_DEFAULTS)
└── components/
    └── Top50Gallery/
        ├── index.jsx          # 主入口 (import 这个)
        ├── Gallery.jsx        # 画廊容器
        ├── CoverTile.jsx      # 单张封面
        ├── RankBadge.jsx      # 右上角排名徽章
        ├── TweaksPanel.jsx    # Tweaks 面板（可选）
        └── top50.css          # 样式
```

## 使用方式

```jsx
// app/top50/page.jsx  或任意页面
import Top50Gallery from '@/components/Top50Gallery';

export default function Page() {
  return <Top50Gallery />;
}
```

如果想开 Tweaks 面板：
```jsx
<Top50Gallery showTweaks={true} />
```

想用自己的 tracks 数据：
```jsx
<Top50Gallery tracks={myTracksArray} />
```

## 依赖

需要在根 layout 引入 Google Fonts（推荐用 next/font）：

```jsx
// app/layout.jsx
import { Space_Grotesk, IBM_Plex_Mono } from 'next/font/google';

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-space-grotesk',
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-ibm-plex-mono',
});

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${spaceGrotesk.variable} ${ibmPlexMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
```

然后在 `top50.css` 里把 `'Space Grotesk'` 改成 `var(--font-space-grotesk)`，`'IBM Plex Mono'` 改成 `var(--font-ibm-plex-mono)`。

或者简单点，直接在 layout 里加 `<link>` 也行。

## Tracks 数据结构

每首歌需要：
```js
{
  rank: 1,
  title: "Song Name",
  artist: "Artist",
  album: "Album",
  plays: 428,
  duration: "4:03",
  coverUrl: "https://...",  // 可选；没有会自动生成占位
}
```

接入 Spotify 后，传入带 `coverUrl` 的 tracks 数组即可。

## 路径别名

代码用了 `@/` 别名（Next.js 默认配置）。如果你的 `tsconfig.json` / `jsconfig.json` 没有配：

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": { "@/*": ["./*"] }
  }
}
```
