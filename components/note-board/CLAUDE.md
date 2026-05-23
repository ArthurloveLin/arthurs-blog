# Note Board Module

Shared infrastructure for `/memo` and `/guestbook`. Both pages use identical
components with different board configs (`lib/note-board-config.ts`).

## File Map

```
NoteBoardExperience.tsx   — page-level entry: wires up Provider + view toggle
NoteBoardProvider.tsx     — global board state + actions (zustand-like context)
types.ts                  — NoteCardViewModel, NotePosition, control interfaces
lib/note-board-config.ts  — per-board config (title, slug, limits, flags)
lib/note-boards.ts        — Supabase queries for board messages

views/
  MemoBoardShell.tsx      — layout chrome (header, sidebar, filters UI)
  MemosStreamView.tsx     — stream feed (date/priority groups → MemoStreamCard)
  MemoSidebar.tsx         — desktop sidebar: calendar, quick filters, tag cloud
  MemoStreamCard.tsx      — individual card in stream view
  MobileNoteList.tsx      — card list used inside MobileStickyStack overlay
  MobileStickyStack.tsx   — draggable sticky-card stack (mobile sticky view)
  StickyStackPreview.tsx  — read-only preview strip on homepage

components/
  StickyNoteCard.tsx      — full sticky note card (board + preview variants)
  NoteActionButton.tsx    — icon-only button with tooltip (MUST use for card actions)
  NoteContent.tsx         — markdown/checklist renderer
  NoteEditor.tsx          — textarea + submit form
  PriorityPicker.tsx      — priority dot control

hooks/
  useBoardData.ts         — initial load + pagination
  useBoardMutations.ts    — create / edit / delete / archive
  useBoardNoteItems.ts    — assembles NoteCardViewModel list
  useBoardSurface.ts      — desktop canvas drag state
  useNoteEditor.ts        — editor open/close + optimistic note

contexts/
  NoteColorThemeContext.tsx — color palette switcher (persisted to localStorage)
```

## Architecture Decisions

### MemoBoardShell is only the chrome
`MemoBoardShell` owns the outer card, header row, filter state UI, and
desktop sidebar. It renders `{children}` for the actual feed. It does NOT
know which view (stream vs sticky) is active. Each view (`MemosStreamView`,
`MobileStickyStack`) renders the shell itself and passes its content as children.

### Header / filter UI convention
The top of the shell has one unified info row:
- Left: board title (mono label) + loaded-count + optional filter pill
- Right: search, sort, theme, toggle-view, new-note — all 34 × 34 icon buttons

Filter state is shown as a compact inline pill next to the loaded count
(`filterPillLabel`). There is **no separate full-width filter banner** — do not
re-introduce one. The pill is clickable and calls `handleClearFilter` directly.

### Card action buttons — always use NoteActionButton
Every icon action on a card (edit, archive, delete) must use `NoteActionButton`
from `components/NoteActionButton.tsx`. It handles:
- `pointer-down` propagation stop (prevents drag triggering on sticky notes)
- Tooltip via `iconTooltip` CSS class
- Consistent hover/focus styling via `StickyNote.module.css`

Never use a raw `<button>` for card-level icon actions.

### Mobile vs desktop card split
The same `NoteCardViewModel` data is rendered by two completely different
components depending on context:

| Context | Component |
|---|---|
| Stream view (both viewports) | `MemoStreamCard` |
| Sticky-stack overlay on mobile | `MobileNoteList` |
| Sticky board on desktop | `StickyNoteCard.Board` |

`MobileNoteList` and `MemoStreamCard` must stay visually consistent.
When adding a new card-level action, add it to **both**.

### Filter state flow
`useMemoBoardFilters` (defined in `MemoBoardShell.tsx`) is the single source
of truth for date filtering. It is instantiated in the view (e.g. `MemosStreamView`)
and passed down into `MemoBoardShell` via the `filters` prop. The shell reads it
for display; the view calls `filters.filterItemsByDate(items)` before rendering.

Provider-level state (`useNoteBoardBoardState`) owns search query, active tag,
sort mode, and archive toggle. Date selection lives in the view's local state
and is surfaced through `useMemoBoardFilters`.

### Color theming
`NoteColorThemeContext` provides a `theme` object with a `colors` array.
`getStickyColorIndex(getStickyColorSeed(message))` maps a message to a
deterministic color slot. Applied as a left-border accent on stream cards
and as the sticky note background on the board. Both `MemoStreamCard` and
`StickyNoteCard` must use this context — do not hardcode colors.

### Optimistic updates
New notes appear instantly via an optimistic `NoteCardViewModel` injected by
`useBoardMutations`. These have `isOptimistic: true`; the card applies
`animate-in fade-in slide-in-from-bottom-3` when this flag is set.
Do not remove this animation class — it is the primary feedback for submission.

### Priority sorting (memo only)
Priority sort is only available when `meta.board.slug === 'memo'`. Pass
`allowPrioritySort={meta.board.slug === 'memo'}` to `MemoBoardShell`. The
guestbook config sets `allowPrioritySort={false}`.

### DDL reminder (due_at) — memo only

Each memo note can carry an optional `due_at` ISO timestamp. The full data flow:

**Storage**: `comments.due_at TIMESTAMPTZ NULL` + `comments.notified_at TIMESTAMPTZ NULL`
(migration `20260518075249_memo_due_at.sql`). When `due_at` is updated, `notified_at`
is reset to NULL so a fresh notification fires at the new time.

**Editor UI**: `DueDatePicker` (inline component in `NoteBoardExperience.tsx`) renders
as an `AlarmClock` icon in the editor toolbar. Admin-only — guarded by `state.isAdmin`.
State lives in `useNoteEditor` as `draftDueAt` / `editDueAt`, exposed through
`NoteBoardProvider` as `editorDueAt` / `updateEditorDueAt`.

**Card display**: `due_at` is shown as a small badge on both `MemoStreamCard` and
`StickyNoteCard` (via `StickyDueBadge` component). Three color states:
- slate — more than 24h away
- amber — within 24h
- red — overdue

**Repeat modes** (`comments.repeat_mode`, migration `20260523000000_memo_repeat_mode.sql`):
- The DB columns (`repeat_mode`, `repeat_days`, `due_at`) still exist and the
  `check-reminders` API still handles the column-based advance path for legacy notes.
- **New UI no longer writes these columns.** All reminders created via `DueDateInserter`
  are now inline `@due` tags — including batch/repeat modes.

**DueDateInserter** (inline component in `NoteBoardExperience.tsx`):
- Reads context via `useNoteBoardEditorState()` / `useNoteBoardActions()` — no props needed.
- **Create mode**: calls `boardActions.addDraftReminder(r)` to stage a `PendingReminder`
  in `useNoteEditor`. After note save, `submitDraft` POSTs each pending reminder to
  `/api/note-boards/memo/reminders` (with the now-known `memo_id`), then attaches them
  to the message via `addReminderToMessage`.
- **Edit mode**: directly POSTs to `/api/note-boards/memo/reminders`, then calls
  `boardActions.addReminderToMessage` for optimistic update.
- All modes: single reminder rule (no batch generation). Recurring reminders advance
  their `due_at` on each fire in `check-reminders`.
- Label input always visible; shown as `{label || '提醒'}` on the card badge.
- `editorDueAt` / `editorRepeatMode` / `editorRepeatDays` in provider state are never
  set by new notes — they remain for backwards compat when editing legacy column-based notes.

**Notification pipeline**:
```
VPS crontab (every minute)
  → POST localhost:3000/api/memo/check-reminders  (Bearer token auth)
    → Path 1 (primary): query memo_reminders WHERE due_at ≤ now AND notified_at IS NULL
        join comments WHERE archived = false
        → POST http://1Panel-ntfy-5k3U/memo-reminder  (via lib/ntfy.ts)
        → once:   UPDATE memo_reminders SET notified_at = now()
        → repeat: UPDATE memo_reminders SET due_at = <next occurrence>  (notified_at stays NULL)
    → Path 2 (legacy): inline @due[label](iso) tags in content
    → Path 3 (legacy): column due_at / repeat_mode on comments table
```

The blog container is on `1panel-network` so it can reach ntfy by container name.
`NTFY_INTERNAL_URL`, `NTFY_TOPIC`, `REMINDER_CHECK_TOKEN` are set in `.env.local`.

**Agenda view** (`getMemoAgendaItems` in `lib/note-boards.ts`):
- Runs two parallel queries: inline `@due` tags + `due_at` column memos
- Column memos: recurring ones always shown (next occurrence); one-time only if
  `due_at > now` (unfired)
- Dedup by memo ID: if a memo has both inline tags and `due_at`, inline tags win

**Hard constraints**:
- `due_at` is only settable/visible for memo, not guestbook (admin-only in practice).
- Do not call `Date.now()` inline in JSX — React's `react-hooks/purity` lint will reject
  it. Even `useMemo(() => Date.now(), [])` is flagged. The correct pattern is
  `const [now] = useState(Date.now)` — pass the function reference, not the call result,
  so React invokes it as a lazy initializer internally (see `StickyDueBadge`).
- `notified_at` must always be reset to NULL when `due_at` changes; the API layer
  (`updateBoardMessage`) handles this via `'due_at' in input` check.
- `patch` object in `updateBoardMessage` is typed `Record<string, string | boolean | number | number[] | null>` — the `number[]` is required for `repeat_days`; do not narrow it back to scalar-only.
