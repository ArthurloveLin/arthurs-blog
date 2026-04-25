'use client';

import { useState, useEffect } from 'react';
import { extractColors, RGB } from './colorExtractor';

/**
 * 从专辑封面提取主色 hook
 */
export function useAlbumColors(src: string): RGB[] | null {
  const [colors, setColors] = useState<RGB[] | null>(null);

  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = src;

    img.onload = () => {
      try {
        const cols = extractColors(img);
        if (cols.length >= 2) {
          setColors(cols as RGB[]);
        } else {
          setColors([
            { r: 120, g: 80, b: 200 },
            { r: 200, g: 80, b: 120 },
          ]);
        }
      } catch {
        setColors([
          { r: 120, g: 80, b: 200 },
          { r: 200, g: 80, b: 120 },
        ]);
      }
    };

    img.onerror = () => {
      setColors([
        { r: 120, g: 80, b: 200 },
        { r: 200, g: 80, b: 120 },
      ]);
    };
  }, [src]);

  return colors;
}

/**
 * 播放进度 hook（每秒递增）
 */
export function usePlayback(totalDuration: number) {
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(true);

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      setTime((t) => (t + 1) % totalDuration);
    }, 1000);
    return () => clearInterval(id);
  }, [playing, totalDuration]);

  return { time, playing, setPlaying };
}
