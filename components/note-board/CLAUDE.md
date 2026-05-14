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
