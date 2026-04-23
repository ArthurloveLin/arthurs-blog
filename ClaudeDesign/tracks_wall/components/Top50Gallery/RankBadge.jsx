'use client';

export default function RankBadge({ rank, hovered, hoveredRank }) {
  const displayed = hovered ? hoveredRank : rank;
  return (
    <div className={`rank-badge ${hovered ? 'rank-badge-active' : ''}`}>
      <div className="rank-badge-label">{hovered ? 'NOW' : 'CENTER'}</div>
      <div className="rank-badge-num">#{displayed}</div>
      <div className="rank-badge-total">/ 50</div>
    </div>
  );
}
