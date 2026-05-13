// hooks/useMemoFilter.ts
// ─────────────────────────────────────────────────────────────────────────────
// Client-side hook that owns the full workspace filter / sort state
// and returns a derived `visible` memo list.
//
// Usage (in app/page.tsx):
//   const { state, actions, visible } = useMemoFilter(memos, todayYMD());

"use client";

import { useCallback, useMemo, useReducer } from "react";
import type { Memo, MemoWorkspaceState, FilterKey, SortMode, ViewMode } from "@/lib/types";
import { ymd, ym, memoTags } from "@/lib/utils";

// ── State & Actions ───────────────────────────────────────────────────────────

type Action =
  | { type: "SET_VIEW";          view: ViewMode }
  | { type: "SET_SORT";          sort: SortMode }
  | { type: "SET_FILTER";        filter: FilterKey }
  | { type: "SET_QUERY";         query: string }
  | { type: "SET_DATE";          date: string | null }
  | { type: "TOGGLE_TAG";        tag: string }
  | { type: "CLEAR_TAG";         tag: string }
  | { type: "CLEAR_ALL_FILTERS" };

const INITIAL_STATE: MemoWorkspaceState = {
  view:         "flow",
  sort:         "date",
  filter:       "all",
  query:        "",
  selectedDate: null,
  activeTags:   new Set(),
};

function reducer(state: MemoWorkspaceState, action: Action): MemoWorkspaceState {
  switch (action.type) {
    case "SET_VIEW":   return { ...state, view: action.view };
    case "SET_SORT":   return { ...state, sort: action.sort };
    case "SET_FILTER": return { ...state, filter: action.filter, selectedDate: null };
    case "SET_QUERY":  return { ...state, query: action.query };
    case "SET_DATE":   return {
      ...state, selectedDate: action.date,
      // picking a day clears the filter shortcut
      filter: action.date ? "all" : state.filter,
    };
    case "TOGGLE_TAG": {
      const next = new Set(state.activeTags);
      next.has(action.tag) ? next.delete(action.tag) : next.add(action.tag);
      return { ...state, activeTags: next };
    }
    case "CLEAR_TAG": {
      const next = new Set(state.activeTags);
      next.delete(action.tag);
      return { ...state, activeTags: next };
    }
    case "CLEAR_ALL_FILTERS":
      return { ...state, selectedDate: null, activeTags: new Set(), filter: "all", query: "" };
    default:
      return state;
  }
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useMemoFilter(memos: Memo[], today: string) {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);

  // ── Derived: filtered + sorted list ──────────────────────────────────────

  const visible = useMemo(() => {
    let list = memos;

    // Quick-filter shortcuts
    if (state.filter === "pin")   list = list.filter(m => m.pin);
    if (state.filter === "today") list = list.filter(m => ymd(m.date) === today);

    // Calendar day selection
    if (state.selectedDate) {
      list = list.filter(m => ymd(m.date) === state.selectedDate);
    }

    // Tag intersection (all active tags must be present)
    if (state.activeTags.size > 0) {
      list = list.filter(m => {
        const tags = memoTags(m);
        for (const t of state.activeTags) if (!tags.has(t)) return false;
        return true;
      });
    }

    // Full-text search
    if (state.query.trim()) {
      const q = state.query.trim().toLowerCase();
      list = list.filter(m =>
        m.content.some(b =>
          (b.text ?? "").toLowerCase().includes(q) ||
          (b.lead ?? "").toLowerCase().includes(q)
        ) || m.tags.some(t => t.toLowerCase().includes(q))
      );
    }

    // Sort
    return [...list].sort((a, b) => {
      // Pinned always first
      if (a.pin !== b.pin) return a.pin ? -1 : 1;

      if (state.sort === "date") {
        return a.date < b.date ? 1 : -1;
      }
      if (state.sort === "tag") {
        const ta = [...memoTags(a)].sort().join(",");
        const tb = [...memoTags(b)].sort().join(",");
        if (ta === tb) return a.date < b.date ? 1 : -1;
        if (!ta) return 1;
        if (!tb) return -1;
        return ta.localeCompare(tb);
      }
      return 0;
    });
  }, [memos, state, today]);

  // ── Counts for sidebar & topbar ───────────────────────────────────────────

  const counts = useMemo(() => {
    const thisMonth = ym(today);
    return {
      total:  memos.length,
      pin:    memos.filter(m => m.pin).length,
      today:  memos.filter(m => ymd(m.date) === today).length,
      month:  memos.filter(m => ym(m.date) === thisMonth).length,
    };
  }, [memos, today]);

  // ── Actions (stable references) ───────────────────────────────────────────

  const actions = {
    setView:   useCallback((view: ViewMode)          => dispatch({ type: "SET_VIEW", view }),           []),
    setSort:   useCallback((sort: SortMode)          => dispatch({ type: "SET_SORT", sort }),           []),
    setFilter: useCallback((filter: FilterKey)       => dispatch({ type: "SET_FILTER", filter }),       []),
    setQuery:  useCallback((query: string)           => dispatch({ type: "SET_QUERY", query }),         []),
    setDate:   useCallback((date: string | null)     => dispatch({ type: "SET_DATE", date }),           []),
    toggleTag: useCallback((tag: string)             => dispatch({ type: "TOGGLE_TAG", tag }),          []),
    clearTag:  useCallback((tag: string)             => dispatch({ type: "CLEAR_TAG", tag }),           []),
    clearAll:  useCallback(()                        => dispatch({ type: "CLEAR_ALL_FILTERS" }),        []),
  };

  return { state, actions, visible, counts };
}
