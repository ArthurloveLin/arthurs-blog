'use client';

import React from 'react';
import { useAlbumColors, usePlayback } from '@/hooks/useAlbum';
import { rgb, fmt } from '@/utils/colorExtractor';
import { HeartBeat, SpinningDisc, StatBlockLight } from './SubComponents';
import styles from './PlayerVariantCLight.module.css';

export interface TrackData {
  title: string;
  artist: string;
  album: string;
  cover: string;
  duration: number;
  currentTime: number;
  monthlyPlays: number;
  firstPlayed: string;
  lastPlayed: string;
  totalPlays: number;
}

export interface PlayerVariantCLightProps {
  track: TrackData;
  onMonthlyPlaysClick?: () => void;
  onFirstPlayedClick?: () => void;
  onLastPlayedClick?: () => void;
}

const INK = '#15131a';
const INK_SOFT = 'rgba(21, 19, 26, 0.6)';
const INK_FAINT = 'rgba(21, 19, 26, 0.35)';
const PAPER = '#f5f1ea';

/**
 * Now Playing 组件 - 日间版编辑杂志风
 * 暖米白底 + 墨黑字
 */
export const PlayerVariantCLight: React.FC<PlayerVariantCLightProps> = ({
  track,
  onMonthlyPlaysClick,
  onFirstPlayedClick,
  onLastPlayedClick,
}) => {
  const colors = useAlbumColors(track.cover);
  const { time, playing } = usePlayback(track.duration);

  if (!colors) {
    return <div className={styles.placeholder} />;
  }

  const c1 = colors[0];
  const c2 = colors[1] || c1;

  // 日间版选一个中等明度的强调色（避免亮色被白底吞掉）
  const accent = colors.find((c) => {
    const lum = 0.299 * c.r + 0.587 * c.g + 0.114 * c.b;
    const sat = Math.max(c.r, c.g, c.b) - Math.min(c.r, c.g, c.b);
    return lum > 60 && lum < 180 && sat > 50;
  }) || colors.find((c) => 0.299 * c.r + 0.587 * c.g + 0.114 * c.b < 160) || c1;

  const progress = (time / track.duration) * 100;

  return (
    <div className={styles.container}>
      {/* 柔光斑点 */}
      <div
        className={styles.glow1}
        style={{
          background: `radial-gradient(circle, ${rgb(c1, 0.32)} 0%, transparent 65%)`,
        }}
      />
      <div
        className={styles.glow2}
        style={{
          background: `radial-gradient(circle, ${rgb(c2, 0.28)} 0%, transparent 65%)`,
        }}
      />

      {/* 米色暖膜 */}
      <div className={styles.warmOverlay} />

      {/* 纸张噪点 */}
      <div className={styles.noise} />

      {/* 网格线 */}
      <div className={styles.grid} />

      {/* 顶部铭牌 */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.spotifyBadge}>
            <svg width={14} height={14} viewBox="0 0 24 24" fill="#1DB954">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.59 14.41c-.18.3-.57.39-.87.21-2.39-1.46-5.4-1.79-8.94-.98-.34.08-.68-.14-.76-.48-.08-.34.14-.68.48-.76 3.88-.89 7.21-.51 9.89 1.13.31.18.4.57.2.88zm1.22-2.72c-.23.37-.71.49-1.08.26-2.74-1.68-6.91-2.17-10.15-1.18-.41.12-.85-.11-.97-.52-.12-.41.11-.85.52-.97 3.71-1.13 8.31-.58 11.46 1.34.37.23.49.71.22 1.07zm.11-2.84C14.66 8.85 9.4 8.7 6.3 9.64c-.49.15-1.01-.13-1.16-.62s.13-1.01.62-1.16c3.56-1.08 9.36-.87 13.04 1.31.44.26.58.83.32 1.27-.26.43-.83.58-1.27.32z" />
            </svg>
            <span style={{ color: INK }}>SPOTIFY</span>
          </div>
          <div className={styles.liveIndicator}>
            <HeartBeat size={14} color={rgb(accent)} playing={playing} />
            <span style={{ color: INK_SOFT }}>NOW PLAYING</span>
          </div>
        </div>
        <div className={styles.trackCounter} style={{ color: INK_FAINT }}>
          TRACK · 014 / {String(track.totalPlays).padStart(3, '0')} TOTAL
        </div>
      </div>

      {/* 主区域 */}
      <div className={styles.mainContent}>
        {/* 左：黑胶 + 封面 */}
        <div className={styles.leftColumn}>
          <SpinningDisc src={track.cover} size={252} playing={playing} />
          <div className={styles.albumCoverWrapper}>
            <div
              className={styles.albumCoverGlow}
              style={{
                background: `linear-gradient(135deg, ${rgb(accent, 0.35)}, transparent)`,
              }}
            />
            <img
              src={track.cover}
              alt={track.album}
              className={styles.albumCover}
            />
          </div>
        </div>

        {/* 右：标题信息 */}
        <div className={styles.rightColumn}>
          <div className={styles.albumLabel}>
            <div
              className={styles.accentLine}
              style={{ background: rgb(accent) }}
            />
            <span style={{ color: rgb(accent) }}>{track.album}</span>
          </div>
          <h1 className={styles.title} style={{ color: INK }}>
            {track.title}
          </h1>
          <p className={styles.artist} style={{ color: INK_SOFT }}>
            by{' '}
            <span
              style={{
                color: INK,
                borderBottom: `2px solid ${rgb(accent)}`,
                paddingBottom: 1,
              }}
            >
              {track.artist}
            </span>
          </p>

          {/* 进度条 */}
          <div className={styles.progressSection}>
            <div className={styles.progressBar}>
              <div
                className={styles.progressFill}
                style={{
                  width: `${progress}%`,
                  background: rgb(accent),
                }}
              />
              <div
                className={styles.progressHandle}
                style={{
                  left: `${progress}%`,
                  background: rgb(accent),
                  boxShadow: `0 0 12px ${rgb(accent, 0.6)}`,
                }}
              />
            </div>
            <div className={styles.timings} style={{ color: INK_SOFT }}>
              <span>{fmt(time)}</span>
              <span>{fmt(track.duration)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 底部统计条 */}
      <div className={styles.statsBar}>
        <StatBlockLight
          label="本月播放"
          value={track.monthlyPlays}
          unit="次"
          accent={rgb(accent)}
          clickable
          highlight
          onClick={onMonthlyPlaysClick}
        />
        <StatBlockLight
          label="首次播放"
          value={track.firstPlayed}
          accent={rgb(accent)}
          clickable
          onClick={onFirstPlayedClick}
        />
        <StatBlockLight
          label="最近播放"
          value={track.lastPlayed}
          accent={rgb(accent)}
          clickable
          onClick={onLastPlayedClick}
        />
      </div>

      <style jsx>{`
        @keyframes spin {
          from {
            transform: rotate(0);
          }
          to {
            transform: rotate(360deg);
          }
        }
        @keyframes heartbeat {
          0%,
          100% {
            transform: scale(1);
          }
          14% {
            transform: scale(1.25);
          }
          28% {
            transform: scale(1);
          }
          42% {
            transform: scale(1.18);
          }
          70% {
            transform: scale(1);
          }
        }
      `}</style>
    </div>
  );
};

export default PlayerVariantCLight;
