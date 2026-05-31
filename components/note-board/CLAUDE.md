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
  useStickyNoteDrag.ts    — shared sticky-note drag physics (board + preview cards)

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

### Sticky-note drag physics is shared via `useStickyNoteDrag`
The grab/release GSAP timelines, velocity-based wobble, and rAF-batched
position state live in `hooks/useStickyNoteDrag.ts`, used by **both**
`StickyNoteCardFrame` (in `StickyNoteCard.tsx`) and the standalone
`StickyNotePreviewCard.tsx` (homepage preview strip). Editing the hook changes
the feel on both surfaces. Per-card differences are passed in as options, not
branched inside the hook:
- **shadows** — the two cards use different resting/lift/release box-shadows
  (the preview card's release even cross-fades two different shadows).
- **computeDragBounds** — board card has `mobile-stack` / `contained` / preview
  variants; the preview card uses fixed bounds.
- **shouldReleaseOnCommit** — preview card always plays the release; the board
  card skips it on a mobile-stack fling past `PREVIEW_REVEAL_THRESHOLD`.

Do not re-inline this logic into one card — that recreates the fork the hook
removed. Note `StickyNoteCard.Preview` (the `variant="preview"` path) is
currently unused; the live preview is the standalone file.

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
(migration `20260518075249_memo_due_at.sql`). These columns are the **legacy** path;
the active path encodes reminders inline in `content` (see below). When the column
`due_at` is updated, `notified_at` is reset to NULL so a fresh notification fires.

**Editor UI**: `DueDateInserter` (inline component in `NoteBoardExperience.tsx`) renders
as an `AlarmClock` icon in the editor toolbar, admin-only (rendered under the
`state.isAdmin` block). It is purely a text-splicer — `handleInsert` builds the
`@due[label](iso[,repeat])` string and calls `insertAtCursor(tag)`. It holds no
provider/editor state; the tag lives in the note `content` like any other text.

**Card display**: an inline `@due` tag inside content is rendered as `InlineDueChip`
(defined in `components/note-board/components/NoteContent.tsx`). Separately, a legacy
*column* `due_at` is shown as a standalone `AlarmClock` badge in `MemoStreamCard` /
`StickyNoteCard`, but **only when the content has no inline `@due` tag**
(`!hasInlineDueTags(message.content)`) so the two never double-render. Badge color:
slate (>24h) / amber (≤24h) / red (overdue).

**There is no `memo_reminders` table and no `/api/note-boards/memo/reminders` route.**
Reminders are not separate rows — they are encoded **inline in the memo's `content`**
as `@due` tags. The only reminder columns are the legacy `comments.due_at` /
`comments.repeat_mode` / `comments.repeat_days` / `comments.notified_at` /
`comments.notified_dues`, and only the legacy path still reads `due_at`/`repeat_mode`.

**Inline `@due` tag format** (parsed by `lib/memo-due-tags.ts`):
```
@due[label](iso)                          # one-off
@due[label](iso,daily)
@due[label](iso,weekly)
@due[label](iso,monthly)
@due[label](iso,weekdays)
@due[label](iso,custom:1,3,5)             # 0=Sun … 6=Sat
```
A `custom:` spec with no valid weekday degrades to one-off (it could never advance).
`weekly`/`monthly` are reminder-only — they are **not** tracked as habits (the habit
parser in `lib/memo-habits.ts` only recognises `daily`/`weekdays`/`custom`).

**DueDateInserter** (inline component in `NoteBoardExperience.tsx`):
- The calendar/time/repeat picker; `handleInsert` builds the `@due[...]` string and
  calls `insertAtCursor(tag)` to splice it into the editor textarea. That's it — there
  is no `PendingReminder`, no `addDraftReminder`, no POST to a reminders endpoint.
  The tag rides along with the note content through the normal create/update path.
- Label input always visible; defaults to `提醒` when empty.

**Notification pipeline** (`app/api/memo/check-reminders/route.ts`):
```
VPS crontab (every minute)
  → POST /api/memo/check-reminders  (Bearer REMINDER_CHECK_TOKEN, fail-closed:
                                     missing env → 500, not open)
    → pages through ALL matching memos (no fixed cap), then per memo:
    → Path 1 (primary): inline @due[label](iso[,repeat]) tags in content
        once   → send ntfy, push iso into comments.notified_dues
        repeat → send ntfy, rewrite the tag's iso to the next future occurrence
    → Path 2: habit checklist items (- [ ] … @due) → occurrence rows + content advance
    → Path 3 (legacy): comments.due_at / repeat_mode columns
        once   → send ntfy, set notified_at
        repeat → send ntfy, advance due_at
    → ntfy via lib/ntfy.ts (NTFY_INTERNAL_URL / NTFY_TOPIC)
```

**`advanceDueAt` advances to the next *future* occurrence**, not just +1 period: a
back-filled or long-overdue repeat collapses into a single upcoming fire instead of
replaying one notification per missed period every tick (bounded by an iteration cap).

**`notified_at` belongs to Path 3 only.** Path 1 must not write it (it tracks delivery
via `notified_dues` + content rewrite); writing it there would falsely mark a
co-located column `due_at` as already notified. Weekday math for repeats uses the
Asia/Shanghai calendar day (`getShanghaiWeekday`) on both the dispatcher and the
habit-reschedule path in `updateBoardMessage`.

The blog container is on `1panel-network` so it can reach ntfy by container name.
`NTFY_INTERNAL_URL`, `NTFY_TOPIC`, `REMINDER_CHECK_TOKEN` are set in `.env.local`.

**Agenda view** (`getMemoAgendaItems` in `lib/note-boards.ts`):
- Runs two parallel queries: inline `@due` tags + `due_at` column memos
- Column memos: recurring ones always shown (next occurrence); one-time only if
  `due_at > now` (unfired)
- Dedup by `(memoId, dueAt)`: inline wins only for an identical due instant; a memo
  carrying both an inline tag and a *distinct* column `due_at` shows both (keying on
  memo id alone would silently drop the column due)

**Hard constraints**:
- `due_at` is only settable/visible for memo, not guestbook (admin-only in practice).
- Do not call `Date.now()` inline in JSX — React's `react-hooks/purity` lint will reject
  it. Even `useMemo(() => Date.now(), [])` is flagged. The correct pattern is
  `const [now] = useState(Date.now)` — pass the function reference, not the call result,
  so React invokes it as a lazy initializer internally (see `InlineDueChip` in
  `NoteContent.tsx` and `MemoStreamCard`).
- `notified_at` must always be reset to NULL when `due_at` changes; the API layer
  (`updateBoardMessage`) handles this via `'due_at' in input` check.
- `patch` object in `updateBoardMessage` is typed `Record<string, string | boolean | number | number[] | null>` — the `number[]` is required for `repeat_days`; do not narrow it back to scalar-only.
