'use client';

export default function CoverTile({ item, hovered, anyHovered, blurStrength, onEnter, onLeave }) {
  const { track, x, y, width, height } = item;
  const dimmed = anyHovered && !hovered;

  return (
    <div
      className={`tile ${hovered ? 'tile-hover' : ''} ${dimmed ? 'tile-dim' : ''}`}
      style={{
        transform: `translate3d(${x}px, ${y}px, 0)`,
        width,
        height,
        '--blur': `${blurStrength}px`,
      }}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
    >
      <div className="tile-inner">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={track.coverUrl} alt={track.title} draggable="false" />
        <div className="tile-rank">#{track.rank}</div>
      </div>

      {hovered && (
        <div className="tile-info">
          <div className="info-rank">#{track.rank}</div>
          <div className="info-title">{track.title}</div>
          <div className="info-artist">{track.artist}</div>
          <div className="info-meta">
            <span>{track.album}</span>
            <span className="info-dot">·</span>
            <span>{track.plays} plays</span>
            <span className="info-dot">·</span>
            <span>{track.duration}</span>
          </div>
        </div>
      )}
    </div>
  );
}
