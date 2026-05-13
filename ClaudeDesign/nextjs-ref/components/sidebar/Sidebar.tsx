// components/sidebar/Sidebar.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Left panel: brand strip · calendar · quick filters · tag cloud.
// Pure presentational — all data and callbacks come from MemoWorkspace.

"use client";

import type { FilterKey, TagSummary } from "@/lib/types";
import { Calendar }  from "./Calendar";
import { TagCloud }  from "./TagCloud";
import styles from "./Sidebar.module.css";

interface Props {
  year:         number;
  month:        number;       // 0-indexed
  today:        string;       // "YYYY-MM-DD"
  byDay:        Map<string, number>;
  selectedDate: string | null;
  tags:         TagSummary[];
  activeTags:   Set<string>;
  filter:       FilterKey;
  counts:       { total: number; pin: number; today: number; month: number };
  onPrevMonth:  () => void;
  onNextMonth:  () => void;
  onPickDay:    (date: string) => void;
  onToggleTag:  (tag: string) => void;
  onSetFilter:  (f: FilterKey) => void;
}

const QUICK_FILTERS: Array<{ key: FilterKey; label: string; countKey: keyof Props["counts"] }> = [
  { key: "all",   label: "全部便签", countKey: "total" },
  { key: "pin",   label: "置顶",     countKey: "pin"   },
  { key: "today", label: "今日",     countKey: "today" },
];

export function Sidebar({
  year, month, today, byDay, selectedDate,
  tags, activeTags, filter, counts,
  onPrevMonth, onNextMonth, onPickDay, onToggleTag, onSetFilter,
}: Props) {
  return (
    <aside className={styles.sidebar}>

      {/* ── Brand ── */}
      <div className={styles.brand}>
        <span className={styles.logo}>M E M O</span>
        <span className={styles.meta}>
          第 1 页 · <strong>{counts.total}</strong> 张 · 本月 <strong>{counts.month}</strong>
        </span>
      </div>

      {/* ── Calendar ── */}
      <section className={styles.section}>
        <Calendar
          year={year}
          month={month}
          today={today}
          byDay={byDay}
          selectedDate={selectedDate}
          onPrev={onPrevMonth}
          onNext={onNextMonth}
          onPick={onPickDay}
        />
      </section>

      {/* ── Quick filters ── */}
      <section className={styles.section}>
        <h2 className={styles.sectionHeading}>快速筛选</h2>
        <ul className={styles.filterList}>
          {QUICK_FILTERS.map(({ key, label, countKey }) => (
            <li key={key}>
              <button
                className={`${styles.filterBtn} ${filter === key ? styles.filterBtnActive : ""}`}
                onClick={() => onSetFilter(key)}
              >
                <span>{label}</span>
                <span className={styles.filterCount}>{counts[countKey]}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      {/* ── Tags ── */}
      <section className={styles.section}>
        <h2 className={styles.sectionHeading}>
          标签
          <span className={styles.tagTotal}>{tags.length}</span>
        </h2>
        <TagCloud
          tags={tags}
          activeTags={activeTags}
          onToggle={onToggleTag}
        />
      </section>

      <div className={styles.spacer} />
      <p className={styles.footer}>灵感来自纸张、便签与剪报。</p>
    </aside>
  );
}
