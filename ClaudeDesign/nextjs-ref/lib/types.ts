// lib/types.ts
// ─────────────────────────────────────────────────────────────────────────────
// Core data types for the Memo workspace.
// These mirror the actual DB/API shape — extend as needed.

// ── Content blocks ────────────────────────────────────────────────────────────

export type BlockType =
  | "h"       // heading
  | "p"       // paragraph
  | "todo"    // checklist item
  | "b"       // bullet with optional lead
  | "tag"     // inline tag reference
  | "code"    // code snippet
  | "quote";  // block quote

export interface Block {
  type: BlockType;
  text: string;
  lead?: string;   // bold prefix, used in "b" and "todo" types
  done?: boolean;  // for "todo"
}

// ── Memo ──────────────────────────────────────────────────────────────────────

export type MemoColor =
  | "rose" | "butter" | "mint" | "sky" | "lilac" | "lavender" | "sage";

export interface Reactions {
  heart: number;
  down: number;
}

export interface Memo {
  id: string;
  /** ISO 8601, creation date */
  date: string;
  /** ISO 8601, last edited */
  edited: string;
  pin: boolean;
  color: MemoColor;
  /** Explicit tag list (mirrors #tag blocks, kept in sync) */
  tags: string[];
  content: Block[];
  reactions: Reactions;
  authorId: string;
}

// ── View / UI ─────────────────────────────────────────────────────────────────

export type ViewMode  = "flow" | "list";
export type SortMode  = "date" | "tag";
export type FilterKey = "all"  | "pin" | "today";

export interface TagSummary {
  tag: string;
  count: number;
}

export interface MemoWorkspaceState {
  view:         ViewMode;
  sort:         SortMode;
  filter:       FilterKey;
  query:        string;
  selectedDate: string | null;   // "YYYY-MM-DD" or null
  activeTags:   Set<string>;
}
