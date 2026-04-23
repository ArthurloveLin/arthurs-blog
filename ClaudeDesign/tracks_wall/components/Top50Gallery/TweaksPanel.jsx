'use client';

export default function TweaksPanel({ tweaks, updateTweak }) {
  return (
    <div className="tweaks">
      <div className="tweaks-header">Tweaks</div>
      <div className="tweaks-row">
        <label>Pan speed</label>
        <input type="range" min="0" max="40" step="1" value={tweaks.panSpeed}
          onChange={(e) => updateTweak('panSpeed', +e.target.value)} />
        <span className="tweaks-val">{tweaks.panSpeed}</span>
      </div>
      <div className="tweaks-row">
        <label>Blur strength</label>
        <input type="range" min="0" max="30" step="1" value={tweaks.blurStrength}
          onChange={(e) => updateTweak('blurStrength', +e.target.value)} />
        <span className="tweaks-val">{tweaks.blurStrength}px</span>
      </div>
      <div className="tweaks-row">
        <label>Grid columns</label>
        <input type="range" min="6" max="16" step="1" value={tweaks.gridCols}
          onChange={(e) => updateTweak('gridCols', +e.target.value)} />
        <span className="tweaks-val">{tweaks.gridCols}</span>
      </div>
      <div className="tweaks-row">
        <label>Theme</label>
        <div className="seg">
          <button className={tweaks.theme === 'dark' ? 'on' : ''} onClick={() => updateTweak('theme', 'dark')}>Dark</button>
          <button className={tweaks.theme === 'light' ? 'on' : ''} onClick={() => updateTweak('theme', 'light')}>Light</button>
        </div>
      </div>
    </div>
  );
}
