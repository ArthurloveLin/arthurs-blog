// components/views/ListView.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Timeline view: memos grouped by day, sorted newest first.
// Sticky day headers; each memo is a <ListCard>.

"use client";

import { useMemo } from "react";
import type { Memo } from "@/lib/types";
import { ymd, weekdayCN, fmtShort } from "@/lib/utils";
import styles from "./ListView.module.css";

interface Props {
  memos:  Memo[];
  onLike: (id: string) => void;
}

export function ListView({ memos, onLike }: Props) {
  // Group memos by day, descending
  const groups = useMemo(() => {
    const map = new Map<string, Memo[]>();
    for (const m of memos) {
      const k = ymd(m.date);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(m);
    }
    return [...map.entries()].sort(([a], [b]) => (a < b ? 1 : -1));
  }, [memos]);

  if (memos.length === 0) {
    return <div className={styles.empty}>— 这里还没有便签 —</div>;
  }

  return (
    <div className={styles.list}>
      {groups.map(([day, items]) => {
        const dt = new Date(day);
        return (
          <section key={day} className={styles.group}>

            {/* ── Day header (sticky) ── */}
            <header className={styles.dayHeader}>
              <span className={styles.dayNum}>
                {dt.getDate()}
                <small>{weekdayCN(day)}</small>
              </span>
              <span className={styles.dayMonth}>
                {dt.getFullYear()}年{dt.getMonth() + 1}月
              </span>
              <hr className={styles.rule} />
              <span className={styles.count}>{items.length} 条</span>
            </header>

            {/* ── Cards ── */}
            <div className={styles.cards}>
              {items.map(m => (
                <ListCard key={m.id} memo={m} onLike={() => onLike(m.id)} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

// ── ListCard ──────────────────────────────────────────────────────────────────

function ListCard({ memo, onLike }: { memo: Memo; onLike: () => void }) {
  // Collect explicit tag blocks for display at card bottom
  const tagBlocks = memo.content.filter(b => b.type === "tag");

  return (
    <article
      className={`${styles.card} ${memo.pin ? styles.pinned : ""}`}
      data-color={memo.color}
    >
      {/* Colour rail — apply color via data-color in CSS */}
      <div className={styles.rail} aria-hidden />

      <div className={styles.cardInner}>
        {/* Header row */}
        <div className={styles.cardHeader}>
          <span className={styles.author}>
            <span className={styles.avatar}>A</span>
            {/* Replace with real author name */}
          </span>
          <span className={styles.meta}>
            已编辑于 {fmtShort(memo.edited)}
          </span>
          {memo.pin && <span className={styles.pinLabel}>置顶</span>}
          <div className={styles.actions}>
            <button aria-label="编辑">✎</button>
            <button aria-label="复制">⎘</button>
            <button aria-label="删除">⌫</button>
          </div>
        </div>

        {/* Content — reuse the same blocks as FlowView if desired */}
        <div className={styles.body}>
          {memo.content.map((block, i) => {
            if (block.type === "tag") return null; // shown below
            if (block.type === "h") return <h3 key={i} className={styles.bh}>{block.text}</h3>;
            if (block.type === "p") return <p key={i} className={styles.bp}>{block.text}</p>;
            if (block.type === "quote") return <blockquote key={i} className={styles.bq}>「{block.text}」</blockquote>;
            if (block.type === "code") return <pre key={i} className={styles.bc}><code>{block.text}</code></pre>;
            if (block.type === "todo") return (
              <div key={i} className={`${styles.bt} ${block.done ? styles.done : ""}`}>
                <span className={styles.checkbox} />
                <span>{block.lead && <strong>{block.lead}</strong>}{block.text}</span>
              </div>
            );
            if (block.type === "b") return (
              <div key={i} className={styles.bb}>
                <strong>{block.lead}</strong>{block.text}
              </div>
            );
            return null;
          })}

          {/* Inline tag chips */}
          {tagBlocks.length > 0 && (
            <div className={styles.tags}>
              {tagBlocks.map((b, i) => (
                <span key={i} className={styles.tagChip}>{b.text}</span>
              ))}
            </div>
          )}
        </div>

        {/* Footer / reactions */}
        <footer className={styles.footer}>
          <button
            className={`${styles.react} ${memo.reactions.heart > 0 ? styles.liked : ""}`}
            onClick={onLike}
          >
            ♥ {memo.reactions.heart}
          </button>
          <span className={styles.react}>↓ {memo.reactions.down}</span>
        </footer>
      </div>
    </article>
  );
}
