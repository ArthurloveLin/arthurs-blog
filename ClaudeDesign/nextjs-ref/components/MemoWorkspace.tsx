// components/MemoWorkspace.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Client root — owns all interactive state via useMemoFilter.
// Composes Sidebar + TopBar + the active view.
//
// Data flows DOWN (props); events flow UP (callbacks).
// Nothing here knows about card appearance — that's the view's concern.

"use client";

import { useState, useCallback } from "react";
import type { Memo, TagSummary } from "@/lib/types";
import { useMemoFilter } from "@/hooks/useMemoFilter";
import { Sidebar }   from "@/components/sidebar/Sidebar";
import { TopBar }    from "@/components/topbar/TopBar";
import { FlowView }  from "@/components/views/FlowView";
import { ListView }  from "@/components/views/ListView";
import styles from "./MemoWorkspace.module.css";

interface Props {
  initialMemos: Memo[];
  today:  string;
  byDay:  Map<string, number>;
  tags:   TagSummary[];
}

export function MemoWorkspace({ initialMemos, today, byDay, tags }: Props) {
  // Local memo list — updated optimistically on like / edit / delete.
  const [memos, setMemos] = useState<Memo[]>(initialMemos);

  const { state, actions, visible, counts } = useMemoFilter(memos, today);

  // Calendar navigation (month/year) lives here; does NOT affect filter state.
  const [calYear,  setCalYear]  = useState(() => new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(() => new Date().getMonth());

  const prevMonth = useCallback(() => {
    setCalMonth(m => { if (m === 0) { setCalYear(y => y - 1); return 11; } return m - 1; });
  }, []);
  const nextMonth = useCallback(() => {
    setCalMonth(m => { if (m === 11) { setCalYear(y => y + 1); return 0; } return m + 1; });
  }, []);

  // Optimistic reaction toggle — call your API endpoint here.
  const handleLike = useCallback((id: string) => {
    setMemos(prev =>
      prev.map(m =>
        m.id === id
          ? { ...m, reactions: { ...m.reactions, heart: m.reactions.heart > 0 ? 0 : 1 } }
          : m
      )
    );
    // TODO: await api.patch(`/memos/${id}/react`, { type: "heart" });
  }, []);

  return (
    <div className={styles.workspace}>
      <Sidebar
        year={calYear}
        month={calMonth}
        today={today}
        byDay={byDay}
        selectedDate={state.selectedDate}
        tags={tags}
        activeTags={state.activeTags}
        filter={state.filter}
        counts={counts}
        onPrevMonth={prevMonth}
        onNextMonth={nextMonth}
        onPickDay={d => actions.setDate(d === state.selectedDate ? null : d)}
        onToggleTag={actions.toggleTag}
        onSetFilter={actions.setFilter}
      />

      <main className={styles.main}>
        <TopBar
          total={visible.length}
          month={`${calYear}年${calMonth + 1}月`}
          query={state.query}
          sort={state.sort}
          view={state.view}
          activeTags={state.activeTags}
          selectedDate={state.selectedDate}
          onQuery={actions.setQuery}
          onSort={actions.setSort}
          onView={actions.setView}
          onClearTag={actions.clearTag}
          onClearDate={() => actions.setDate(null)}
          onClearAll={actions.clearAll}
        />

        {state.view === "flow" ? (
          <FlowView memos={visible} onLike={handleLike} />
        ) : (
          <ListView memos={visible} onLike={handleLike} />
        )}
      </main>
    </div>
  );
}
