// components/views/FlowView.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Masonry-column grid of memo cards.
//
// THIS COMPONENT IS INTENTIONALLY THIN:
//   • It handles layout only (CSS columns, column count by density).
//   • Card appearance (colours, tape, shadows, jitter) belongs in
//     <MemoCard> — a component you own and style to taste.
//   • `onLike` is threaded through as a stable callback ref.

"use client";

import type { Memo } from "@/lib/types";
import { MemoCard } from "./MemoCard";
import styles from "./FlowView.module.css";

type Density = "cozy" | "standard" | "dense";

interface Props {
  memos:   Memo[];
  onLike:  (id: string) => void;
  density?: Density;
}

const DENSITY_COLS: Record<Density, number> = {
  cozy:     3,
  standard: 4,
  dense:    5,
};

export function FlowView({ memos, onLike, density = "standard" }: Props) {
  const cols = DENSITY_COLS[density];

  if (memos.length === 0) {
    return (
      <div className={styles.empty}>— 这里还没有便签 —</div>
    );
  }

  return (
    // CSS columns — simplest masonry without JS.
    // For true JS masonry (consistent heights across columns) replace
    // with a library like masonic or react-masonry-css.
    <div
      className={styles.grid}
      style={{ "--cols": cols } as React.CSSProperties}
    >
      {memos.map(memo => (
        <MemoCard key={memo.id} memo={memo} onLike={() => onLike(memo.id)} />
      ))}
    </div>
  );
}
