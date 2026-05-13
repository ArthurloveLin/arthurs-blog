// components/sidebar/TagCloud.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Frequency-sorted tag chips.
// Active tags are highlighted; click to toggle multi-select.

"use client";

import type { TagSummary } from "@/lib/types";
import styles from "./TagCloud.module.css";

interface Props {
  tags:      TagSummary[];
  activeTags: Set<string>;
  onToggle:  (tag: string) => void;
}

// Stable colour assignment by index — stays the same across renders.
const CHIP_COLORS = [
  "#c0644a","#7a5ae0","#1f8a5b",
  "#2a6fdb","#b2841f","#a14d8b","#4a8c7a",
];

export function TagCloud({ tags, activeTags, onToggle }: Props) {
  if (tags.length === 0) {
    return <p className={styles.empty}>暂无标签</p>;
  }

  return (
    <div className={styles.cloud}>
      {tags.map((t, i) => {
        const color  = CHIP_COLORS[i % CHIP_COLORS.length];
        const active = activeTags.has(t.tag);

        return (
          <button
            key={t.tag}
            className={`${styles.chip} ${active ? styles.active : ""}`}
            style={{ "--chip-color": color } as React.CSSProperties}
            onClick={() => onToggle(t.tag)}
            aria-pressed={active}
          >
            <span className={styles.chipDot} aria-hidden />
            <span className={styles.chipLabel}>{t.tag}</span>
            <span className={styles.chipCount}>{t.count}</span>
          </button>
        );
      })}
    </div>
  );
}
