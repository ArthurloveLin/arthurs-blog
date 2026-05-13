// components/topbar/TopBar.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Sticky top bar: title · expandable search · sort seg · view seg · CTA.
// Active filter chips are rendered below the main row.

"use client";

import { useState, useRef, useEffect } from "react";
import type { SortMode, ViewMode } from "@/lib/types";
import styles from "./TopBar.module.css";

interface Props {
  total:        number;
  month:        string;       // "2026年5月"
  query:        string;
  sort:         SortMode;
  view:         ViewMode;
  activeTags:   Set<string>;
  selectedDate: string | null;
  onQuery:      (q: string) => void;
  onSort:       (s: SortMode) => void;
  onView:       (v: ViewMode) => void;
  onClearTag:   (tag: string) => void;
  onClearDate:  () => void;
  onClearAll:   () => void;
}

export function TopBar({
  total, month, query, sort, view,
  activeTags, selectedDate,
  onQuery, onSort, onView, onClearTag, onClearDate, onClearAll,
}: Props) {
  const [searchOpen, setSearchOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (searchOpen) inputRef.current?.focus();
  }, [searchOpen]);

  const hasFilters = activeTags.size > 0 || !!selectedDate;

  return (
    <div className={styles.wrapper}>
      <div className={styles.bar}>

        {/* Title */}
        <div className={styles.title}>
          <h1 className={styles.h1}>便签<span className={styles.accent}> · </span>工作台</h1>
          <span className={styles.sub}>{month} · 共 {total} 条</span>
        </div>

        <div className={styles.spacer} />

        {/* Search */}
        <div
          className={`${styles.search} ${(searchOpen || query) ? styles.searchOpen : ""}`}
          onClick={() => setSearchOpen(true)}
        >
          <span className={styles.searchIcon} aria-hidden>⌕</span>
          {(searchOpen || query) && (
            <input
              ref={inputRef}
              className={styles.searchInput}
              value={query}
              placeholder="搜索便签内容、标签…"
              onChange={e => onQuery(e.target.value)}
              onBlur={() => { if (!query) setSearchOpen(false); }}
            />
          )}
        </div>

        {/* Sort segmented control */}
        <div className={styles.seg} role="group" aria-label="排序">
          {(["date", "tag"] as SortMode[]).map(s => (
            <button
              key={s}
              className={`${styles.segBtn} ${sort === s ? styles.segBtnActive : ""}`}
              onClick={() => onSort(s)}
            >
              {s === "date" ? "日期" : "标签"}
            </button>
          ))}
        </div>

        {/* View segmented control */}
        <div className={styles.seg} role="group" aria-label="视图">
          {(["flow", "list"] as ViewMode[]).map(v => (
            <button
              key={v}
              className={`${styles.segBtn} ${view === v ? styles.segBtnActive : ""}`}
              onClick={() => onView(v)}
            >
              {v === "flow" ? "便签墙" : "时间线"}
            </button>
          ))}
        </div>

        {/* New memo CTA */}
        <button className={styles.cta}>＋ 新便签</button>
      </div>

      {/* Active filter chips */}
      {hasFilters && (
        <div className={styles.filters}>
          <span className={styles.filtersLabel}>筛选中：</span>

          {selectedDate && (
            <span className={styles.chip}>
              {selectedDate}
              <button onClick={onClearDate} aria-label="清除日期">×</button>
            </span>
          )}

          {[...activeTags].map(tag => (
            <span key={tag} className={styles.chip}>
              {tag}
              <button onClick={() => onClearTag(tag)} aria-label={`清除 ${tag}`}>×</button>
            </span>
          ))}

          <button className={styles.clearAll} onClick={onClearAll}>
            全部清除
          </button>
        </div>
      )}
    </div>
  );
}
