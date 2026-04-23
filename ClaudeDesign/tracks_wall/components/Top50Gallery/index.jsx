'use client';

import { useState } from 'react';
import Gallery from './Gallery';
import TweaksPanel from './TweaksPanel';
import { TRACKS } from '@/data/tracks';
import { TWEAK_DEFAULTS } from '@/lib/constants';
import './top50.css';

export default function Top50Gallery({ tracks = TRACKS, showTweaks = false }) {
  const [tweaks, setTweaks] = useState(TWEAK_DEFAULTS);
  const [hoveredTrack, setHoveredTrack] = useState(null);
  const [hoverColor, setHoverColor] = useState(null);
  const [visibleRank, setVisibleRank] = useState(1);

  const updateTweak = (key, value) => {
    setTweaks((prev) => ({ ...prev, [key]: value }));
  };

  const dark = tweaks.theme === 'dark';

  return (
    <div className={`page ${dark ? 'dark' : 'light'}`}>
      <Gallery
        tracks={tracks}
        tweaks={tweaks}
        hoveredTrack={hoveredTrack}
        setHoveredTrack={setHoveredTrack}
        hoverColor={hoverColor}
        setHoverColor={setHoverColor}
        visibleRank={visibleRank}
        setVisibleRank={setVisibleRank}
      />
      {showTweaks && <TweaksPanel tweaks={tweaks} updateTweak={updateTweak} />}
    </div>
  );
}
