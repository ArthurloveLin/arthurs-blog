/**
 * 示例：如何在 Next.js 16 页面中使用 Now Playing 组件
 */

'use client';

import { PlayerVariantC, type TrackData } from '@/components/PlayerVariantC';
import { PlayerVariantCLight } from '@/components/PlayerVariantCLight';

// 示例数据
const exampleTrack: TrackData = {
  title: 'Midnight City',
  artist: 'M83',
  album: 'Hurry Up, We\'re Dreaming',
  cover: 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=600&h=600&fit=crop',
  duration: 244, // 4:04
  currentTime: 87, // 1:27
  monthlyPlays: 47,
  firstPlayed: '2023.08.14',
  lastPlayed: '2 小时前',
  totalPlays: 312,
};

export default function PlayerShowcase() {
  const handleMonthlyClick = () => {
    console.log('跳转到本月播放统计');
    // 可以用 router.push('/stats/monthly') 跳转
  };

  const handleFirstPlayedClick = () => {
    console.log('跳转到首次播放时间');
  };

  const handleLastPlayedClick = () => {
    console.log('跳转到最近播放历史');
  };

  return (
    <div style={{ padding: '40px', background: '#f5f5f5', minHeight: '100vh' }}>
      <h1 style={{ marginBottom: '40px', textAlign: 'center' }}>Now Playing 组件示例</h1>

      {/* 暗黑版 */}
      <div style={{ marginBottom: '60px' }}>
        <h2 style={{ marginBottom: '20px', color: '#333' }}>版本 1：暗黑编辑杂志风</h2>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <PlayerVariantC
            track={exampleTrack}
            onMonthlyPlaysClick={handleMonthlyClick}
            onFirstPlayedClick={handleFirstPlayedClick}
            onLastPlayedClick={handleLastPlayedClick}
          />
        </div>
      </div>

      {/* 日间版 */}
      <div>
        <h2 style={{ marginBottom: '20px', color: '#333' }}>版本 2：日间暖米白</h2>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <PlayerVariantCLight
            track={exampleTrack}
            onMonthlyPlaysClick={handleMonthlyClick}
            onFirstPlayedClick={handleFirstPlayedClick}
            onLastPlayedClick={handleLastPlayedClick}
          />
        </div>
      </div>
    </div>
  );
}
