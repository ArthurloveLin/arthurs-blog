// components/sidebar/Calendar.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Mini calendar with:
//   • Prev/next month navigation
//   • Dot indicators (or heatmap bg) for days with memos
//   • Clickable days to filter by date
//   • Today highlight; selected-date highlight

"use client";

import styles from "./Calendar.module.css";

interface Props {
  year:         number;
  month:        number;       // 0-indexed
  today:        string;       // "YYYY-MM-DD"
  byDay:        Map<string, number>;
  selectedDate: string | null;
  onPrev:       () => void;
  onNext:       () => void;
  onPick:       (date: string) => void;
}

const DOW_LABELS = ["一","二","三","四","五","六","日"];

/** Build a 6-row × 7-col grid starting on Monday */
function buildCells(year: number, month: number) {
  const firstDow  = (new Date(year, month, 1).getDay() + 6) % 7; // Mon = 0
  const daysInMonth  = new Date(year, month + 1, 0).getDate();
  const daysInPrev   = new Date(year, month, 0).getDate();

  const cells: Array<{ y: number; m: number; d: number; out: boolean }> = [];

  // Trailing days from previous month
  for (let i = firstDow - 1; i >= 0; i--) {
    const pm = month === 0 ? 11 : month - 1;
    const py = month === 0 ? year - 1 : year;
    cells.push({ y: py, m: pm, d: daysInPrev - i, out: true });
  }

  // Current month
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ y: year, m: month, d, out: false });
  }

  // Leading days from next month
  while (cells.length % 7 !== 0) {
    const last = cells[cells.length - 1];
    const nm = last.m === 11 ? 0 : last.m + 1;
    const ny = last.m === 11 ? last.y + 1 : last.y;
    const nd = last.m === nm ? last.d + 1 : 1;
    cells.push({ y: ny, m: nm, d: nd, out: true });
  }

  return cells;
}

function toKey(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export function Calendar({ year, month, today, byDay, selectedDate, onPrev, onNext, onPick }: Props) {
  const cells    = buildCells(year, month);
  const maxCount = Math.max(1, ...byDay.values());

  return (
    <div className={styles.cal}>

      {/* Header */}
      <div className={styles.head}>
        <span className={styles.title}>{year}年{month + 1}月</span>
        <div className={styles.nav}>
          <button onClick={onPrev} aria-label="上个月">‹</button>
          <button onClick={onNext} aria-label="下个月">›</button>
        </div>
      </div>

      {/* Grid */}
      <div className={styles.grid}>
        {DOW_LABELS.map(d => (
          <span key={d} className={styles.dow}>{d}</span>
        ))}

        {cells.map((c, i) => {
          const key    = toKey(c.y, c.m, c.d);
          const count  = byDay.get(key) ?? 0;
          const isToday  = key === today;
          const isSel    = key === selectedDate;
          const hasMemos = !c.out && count > 0;

          // Heat intensity 0.08 – 0.55 relative to busiest day
          const heatOpacity = hasMemos
            ? Math.min(0.55, 0.08 + (count / maxCount) * 0.47)
            : 0;

          return (
            <button
              key={i}
              className={[
                styles.cell,
                c.out   && styles.out,
                isToday && styles.today,
                isSel   && styles.selected,
                hasMemos && styles.hasMemos,
              ].filter(Boolean).join(" ")}
              style={{ "--heat": heatOpacity } as React.CSSProperties}
              onClick={() => hasMemos && onPick(key)}
              title={hasMemos ? `${key} · ${count} 条` : undefined}
              aria-pressed={isSel}
              aria-label={`${c.y}年${c.m + 1}月${c.d}日${hasMemos ? `，${count} 条便签` : ""}`}
            >
              <span className={styles.num}>{c.d}</span>
              {/* Density dots — shown when NOT using heatmap bg */}
              {hasMemos && !isSel && (
                <span className={styles.dots} aria-hidden>
                  {Array.from({ length: Math.min(count, 3) }, (_, j) => (
                    <i key={j} className={styles.dot} />
                  ))}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
