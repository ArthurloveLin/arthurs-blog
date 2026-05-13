// components/views/MemoCard.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Single card used in FlowView.
//
// ⚠️  SKELETON ONLY — this is a structural placeholder.
//     All visual decisions (sticky note paint, tape, paper grain, jitter,
//     rotation, shadows) are deliberately omitted so you can apply your
//     own design system without untangling someone else's CSS.
//
// Props mirror the Memo type directly — no transformation needed.

"use client";

import type { Memo, Block } from "@/lib/types";
import { fmtShort } from "@/lib/utils";
import styles from "./MemoCard.module.css";

interface Props {
  memo:   Memo;
  onLike: () => void;
}

export function MemoCard({ memo, onLike }: Props) {
  return (
    <article
      className={`${styles.card} ${memo.pin ? styles.pinned : ""}`}
      // data-color is available for CSS [data-color="rose"] selectors
      data-color={memo.color}
    >
      {/* ── Header ── */}
      <header className={styles.header}>
        <div className={styles.author}>
          <span className={styles.avatar}>A</span>
          <span>{memo.id /* replace with author display name */}</span>
          {memo.pin && <span className={styles.pinLabel}>置顶</span>}
        </div>
        <div className={styles.actions}>
          {/* Replace with your icon buttons */}
          <button aria-label="编辑">✎</button>
          <button aria-label="复制">⎘</button>
          <button aria-label="删除">⌫</button>
        </div>
      </header>

      <p className={styles.meta}>已编辑于 {fmtShort(memo.edited)}</p>

      {/* ── Content blocks ── */}
      <div className={styles.body}>
        {memo.content.map((block, i) => (
          <ContentBlock key={i} block={block} />
        ))}
      </div>

      {/* ── Footer / reactions ── */}
      <footer className={styles.footer}>
        <button
          className={`${styles.react} ${memo.reactions.heart > 0 ? styles.liked : ""}`}
          onClick={onLike}
          aria-label="喜欢"
        >
          ♥ {memo.reactions.heart}
        </button>
        <span className={styles.react}>↓ {memo.reactions.down}</span>
        <span className={styles.stamp}>{fmtShort(memo.date)}</span>
      </footer>
    </article>
  );
}

// ── Content block renderer ─────────────────────────────────────────────────

function ContentBlock({ block }: { block: Block }) {
  switch (block.type) {
    case "h":
      return <h3 className={styles.blockH}>{block.text}</h3>;
    case "p":
      return <p className={styles.blockP}>{block.text}</p>;
    case "tag":
      return <span className={styles.blockTag}>{block.text}</span>;
    case "quote":
      return <blockquote className={styles.blockQuote}>「{block.text}」</blockquote>;
    case "code":
      return <pre className={styles.blockCode}><code>{block.text}</code></pre>;
    case "todo":
      return (
        <div className={`${styles.blockTodo} ${block.done ? styles.done : ""}`}>
          <span className={styles.checkbox} aria-hidden />
          <span>
            {block.lead && <strong>{block.lead}</strong>}
            {block.text}
          </span>
        </div>
      );
    case "b":
      return (
        <div className={styles.blockBullet}>
          <strong>{block.lead}</strong>
          {block.text}
        </div>
      );
    default:
      return null;
  }
}
