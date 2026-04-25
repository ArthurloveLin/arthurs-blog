'use client';

import React from 'react';

/**
 * 跳动的爱心
 */
export const HeartBeat: React.FC<{
  size?: number;
  color?: string;
  playing?: boolean;
}> = ({ size = 16, color = '#ff3b5c', playing = true }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={color}
      style={{
        animation: playing ? 'heartbeat 1.1s ease-in-out infinite' : 'none',
        filter: `drop-shadow(0 0 6px ${color}88)`,
      }}
    >
      <path d="M12 21s-7-4.5-9.5-9C1 9 2.5 5 6.5 5c2 0 3.5 1 5 3 1.5-2 3-3 5-3 4 0 5.5 4 4 7C19 16.5 12 21 12 21z" />
    </svg>
  );
};

/**
 * 旋转黑胶
 */
export const SpinningDisc: React.FC<{
  src: string;
  size?: number;
  playing?: boolean;
}> = ({ src, size = 200, playing = true }) => {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: `radial-gradient(circle at center, #1a1a1a 22%, #2a2a2a 22.5%, #1a1a1a 23%, #2a2a2a 24%, #0f0f0f 25%, #1a1a1a 28%, #0f0f0f 32%, #1a1a1a 35%, #0a0a0a 40%, #181818 60%, #050505 100%)`,
        position: 'relative',
        animation: playing ? 'spin 8s linear infinite' : 'none',
        boxShadow: '0 30px 60px rgba(0,0,0,0.5), inset 0 0 40px rgba(0,0,0,0.8)',
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- crossOrigin needed for canvas color extraction */}
      <img
        src={src}
        crossOrigin="anonymous"
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: size * 0.42,
          height: size * 0.42,
          borderRadius: '50%',
          objectFit: 'cover',
          border: '2px solid rgba(255,255,255,0.08)',
        }}
        alt="Album cover"
      />
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: '#000',
          boxShadow: '0 0 0 2px rgba(255,255,255,0.1)',
        }}
      />
    </div>
  );
};

/**
 * 统计卡片 (暗黑版)
 */
export const StatBlockDark: React.FC<{
  label: string;
  value: string | number;
  unit?: string;
  accent: string;
  clickable?: boolean;
  highlight?: boolean;
  onClick?: () => void;
}> = ({ label, value, unit, accent, clickable, highlight, onClick }) => {
  const [hover, setHover] = React.useState(false);

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={onClick}
      style={{
        flex: 1,
        padding: '14px 18px',
        borderRadius: 14,
        background: highlight
          ? `linear-gradient(135deg, ${accent}, transparent)`
          : hover && clickable
            ? 'rgba(255,255,255,0.09)'
            : 'rgba(255,255,255,0.04)',
        border: `1px solid ${highlight ? accent : hover && clickable ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.1)'}`,
        backdropFilter: 'blur(30px)',
        cursor: clickable ? 'pointer' : 'default',
        transition: 'transform 0.2s, background 0.2s',
        transform: clickable && hover ? 'translateY(-3px)' : 'none',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
        color: '#fff',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: 10,
          letterSpacing: 1.5,
          textTransform: 'uppercase',
          opacity: 0.7,
          marginBottom: 4,
        }}
      >
        <span>{label}</span>
        {clickable && (
          <span style={{ opacity: hover ? 1 : 0.5 }}>
            <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M7 17L17 7M7 7h10v10" />
            </svg>
          </span>
        )}
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>
        {value}
        {unit && (
          <span style={{ fontSize: 12, opacity: 0.6, marginLeft: 4, fontWeight: 500 }}>
            {unit}
          </span>
        )}
      </div>
    </div>
  );
};

/**
 * 统计卡片 (日间版)
 */
export const StatBlockLight: React.FC<{
  label: string;
  value: string | number;
  unit?: string;
  accent: string;
  clickable?: boolean;
  highlight?: boolean;
  onClick?: () => void;
}> = ({ label, value, unit, accent, clickable, highlight, onClick }) => {
  const [hover, setHover] = React.useState(false);
  const ink = '#15131a';

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={onClick}
      style={{
        flex: 1,
        padding: '14px 18px',
        borderRadius: 14,
        background: highlight
          ? `linear-gradient(135deg, ${accent}, ${accent.replace(/[\d.]+\)$/, '0.15)')})`
          : hover && clickable
            ? 'rgba(255,255,255,0.85)'
            : 'rgba(255,255,255,0.5)',
        border: `1px solid ${highlight ? accent : hover && clickable ? 'rgba(21,19,26,0.25)' : 'rgba(21,19,26,0.1)'}`,
        backdropFilter: 'blur(30px)',
        cursor: clickable ? 'pointer' : 'default',
        transition: 'transform 0.2s, background 0.2s',
        transform: clickable && hover ? 'translateY(-3px)' : 'none',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
        color: highlight ? '#fff' : ink,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: 10,
          letterSpacing: 1.5,
          textTransform: 'uppercase',
          opacity: highlight ? 0.95 : 0.65,
          marginBottom: 4,
        }}
      >
        <span>{label}</span>
        {clickable && (
          <span style={{ opacity: hover ? 1 : 0.5 }}>
            <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M7 17L17 7M7 7h10v10" />
            </svg>
          </span>
        )}
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>
        {value}
        {unit && (
          <span style={{ fontSize: 12, opacity: 0.7, marginLeft: 4, fontWeight: 500 }}>
            {unit}
          </span>
        )}
      </div>
    </div>
  );
};
