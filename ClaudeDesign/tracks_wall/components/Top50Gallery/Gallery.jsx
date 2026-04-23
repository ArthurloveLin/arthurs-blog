'use client';

import { useMemo, useRef, useEffect, useCallback } from 'react';
import CoverTile from './CoverTile';
import RankBadge from './RankBadge';
import { generateLayout } from '@/lib/layout';
import { extractDominantColor } from '@/lib/color';
import { CELL_SIZE, GAP } from '@/lib/constants';

export default function Gallery({
  tracks, tweaks,
  hoveredTrack, setHoveredTrack,
  hoverColor, setHoverColor,
  visibleRank, setVisibleRank,
}) {
  const cols = tweaks.gridCols;
  const layout = useMemo(
    () => generateLayout(tracks, cols, CELL_SIZE, GAP),
    [tracks, cols]
  );

  const viewportRef = useRef(null);
  const wallRef = useRef(null);
  const offsetRef = useRef({ x: 0, y: 0 });
  const rafRef = useRef(null);
  const lastTimeRef = useRef(0);
  const pausedRef = useRef(false);

  useEffect(() => {
    const speed = tweaks.panSpeed;
    if (!speed) return;

    function tick(t) {
      if (!lastTimeRef.current) lastTimeRef.current = t;
      const dt = (t - lastTimeRef.current) / 1000;
      lastTimeRef.current = t;

      if (!pausedRef.current) {
        offsetRef.current.x -= speed * dt;
        offsetRef.current.y -= speed * 0.6 * dt;

        const wall = wallRef.current;
        const viewport = viewportRef.current;
        if (wall && viewport) {
          const maxX = layout.totalWidth - viewport.clientWidth;
          const maxY = layout.totalHeight - viewport.clientHeight;
          if (-offsetRef.current.x > maxX) offsetRef.current.x = -maxX;
          if (offsetRef.current.x > 0) offsetRef.current.x = 0;
          if (-offsetRef.current.y > maxY) offsetRef.current.y = -maxY;
          if (offsetRef.current.y > 0) offsetRef.current.y = 0;

          wall.style.transform = `translate3d(${offsetRef.current.x}px, ${offsetRef.current.y}px, 0)`;
        }

        if (viewport && wall) {
          const cx = -offsetRef.current.x + viewport.clientWidth / 2;
          const cy = -offsetRef.current.y + viewport.clientHeight / 2;
          let bestRank = visibleRank;
          let bestDist = Infinity;
          for (const item of layout.items) {
            const itemCx = item.x + item.width / 2;
            const itemCy = item.y + item.height / 2;
            const d = (itemCx - cx) ** 2 + (itemCy - cy) ** 2;
            if (d < bestDist) { bestDist = d; bestRank = item.track.rank; }
          }
          if (bestRank !== visibleRank) setVisibleRank(bestRank);
        }
      }

      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [tweaks.panSpeed, layout, visibleRank, setVisibleRank]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    offsetRef.current.x = -(layout.totalWidth - viewport.clientWidth) / 2;
    offsetRef.current.y = -(layout.totalHeight - viewport.clientHeight) / 2;
  }, [layout]);

  const handleHover = useCallback((track, url) => {
    pausedRef.current = !!track;
    setHoveredTrack(track);
    if (track && url) {
      extractDominantColor(url).then((c) => setHoverColor(c.dominant));
    } else {
      setHoverColor(null);
    }
  }, [setHoveredTrack, setHoverColor]);

  const bgGradient = useMemo(() => {
    if (!hoverColor) return null;
    const [r, g, b] = hoverColor;
    return `radial-gradient(ellipse at center, rgba(${r},${g},${b},0.55) 0%, rgba(${r},${g},${b},0.15) 35%, rgba(0,0,0,0) 70%)`;
  }, [hoverColor]);

  return (
    <div className="card">
      <div className="card-bg-glow" style={{ background: bgGradient || 'transparent', opacity: hoverColor ? 1 : 0 }} />

      <div className="header">
        <div className="header-left">
          <div className="eyebrow">PERSONAL · 2024</div>
          <h1 className="title">My Top 50</h1>
        </div>
        <RankBadge rank={visibleRank} hovered={!!hoveredTrack} hoveredRank={hoveredTrack?.rank} />
      </div>

      <div className="viewport" ref={viewportRef}>
        <div className="wall" ref={wallRef} style={{ width: layout.totalWidth, height: layout.totalHeight }}>
          {layout.items.map((item) => (
            <CoverTile
              key={item.track.rank}
              item={item}
              hovered={hoveredTrack?.rank === item.track.rank}
              anyHovered={!!hoveredTrack}
              blurStrength={tweaks.blurStrength}
              onEnter={() => handleHover(item.track, item.track.coverUrl)}
              onLeave={() => handleHover(null, null)}
            />
          ))}
        </div>

        <div className="fade fade-top" />
        <div className="fade fade-bottom" />
        <div className="fade fade-left" />
        <div className="fade fade-right" />
      </div>

      <div className="footer">
        <div className="footer-stat"><span className="footer-num">50</span><span className="footer-label">tracks</span></div>
        <div className="footer-divider" />
        <div className="footer-stat"><span className="footer-num">3h 24m</span><span className="footer-label">total</span></div>
        <div className="footer-divider" />
        <div className="footer-stat"><span className="footer-num">8,492</span><span className="footer-label">plays</span></div>
        <div className="footer-spacer" />
        <div className="footer-hint">{hoveredTrack ? 'paused' : 'drifting'}</div>
      </div>
    </div>
  );
}
