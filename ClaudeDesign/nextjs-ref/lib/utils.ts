// lib/utils.ts
// ─────────────────────────────────────────────────────────────────────────────
// Pure date / string helpers shared across components.
// No side effects, no imports — safe to use in Server Components.

/** "2026-05-13T10:13:00" → "2026-05-13" */
export function ymd(isoDate: string): string {
  return isoDate.slice(0, 10);
}

/** "2026-05-13" → "2026-05" */
export function ym(isoDate: string): string {
  return isoDate.slice(0, 7);
}

/** Date string → Chinese weekday, e.g. "周三" */
export function weekdayCN(isoDate: string): string {
  const names = ["周日","周一","周二","周三","周四","周五","周六"];
  return names[new Date(isoDate).getDay()];
}

/** "2026-05-13T10:13:00" → "5/13 10:13" */
export function fmtShort(isoDate: string): string {
  const d = new Date(isoDate);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${d.getMonth() + 1}/${d.getDate()} ${hh}:${mm}`;
}

/** Today as "YYYY-MM-DD" in local time */
export function todayYMD(): string {
  return ymd(new Date().toISOString().replace(/T.*/, "T00:00:00"));
}

/**
 * Build a Map<"YYYY-MM-DD", count> for the calendar heatmap.
 * Used in: Sidebar → Calendar.
 */
export function memosByDay(
  memos: Array<{ date: string }>
): Map<string, number> {
  const map = new Map<string, number>();
  for (const m of memos) {
    const k = ymd(m.date);
    map.set(k, (map.get(k) ?? 0) + 1);
  }
  return map;
}

/**
 * Collect all unique tags from memos and sort by frequency descending.
 * A tag can live in `memo.tags[]` OR as a `{ type:"tag" }` content block.
 */
export function aggregateTags(
  memos: Array<{ tags: string[]; content: Array<{ type: string; text?: string }> }>
): Array<{ tag: string; count: number }> {
  const map = new Map<string, number>();
  for (const m of memos) {
    const seen = new Set<string>();
    m.tags.forEach(t => seen.add(t));
    m.content.forEach(b => { if (b.type === "tag" && b.text) seen.add(b.text); });
    seen.forEach(t => map.set(t, (map.get(t) ?? 0) + 1));
  }
  return [...map.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}

/**
 * Extract all tags from a single memo (union of .tags and tag blocks).
 */
export function memoTags(
  memo: { tags: string[]; content: Array<{ type: string; text?: string }> }
): Set<string> {
  const s = new Set(memo.tags);
  memo.content.forEach(b => { if (b.type === "tag" && b.text) s.add(b.text); });
  return s;
}
