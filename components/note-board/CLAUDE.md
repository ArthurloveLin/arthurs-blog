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
of truth for client-side filtering. It is instantiated in the view (e.g. `MemosStreamView`)
and passed down into `MemoBoardShell` via the `filters` prop. The shell reads it
for display; the view calls `filters.filterItems(items)` before rendering.

Provider-level state (`useNoteBoardBoardState`) owns search query, active tag,
sort mode, and archive toggle. Date selection lives in the view's local state
and is surfaced through `useMemoBoardFilters`.

### Where filtering happens: resident memo (client) vs. server
This is the **non-obvious** part — do not assume all boards filter the same way.

**Memo (active AND archived) = fully-resident working sets.** Active and archived are
two SEPARATE resident sets — each loads in ONE fetch (`initialPageLimit: 500` in
`lib/note-board-config.ts` — a safety cap, not pagination) and derives **everything
client-side**: tag/search/date/due via `filters.filterItems(...)`, and **sort/direction**
in-memory too. `getBoardQueryKey` (`useBoardData.ts`) reduces a resident key to just
`note-board:memo:{active|archived}` (+ identity) — it OMITS sort, direction, tag, search,
and date when `isResidentMemo` (`slug === 'memo'`), so changing ANY of them does NOT
trigger a network re-fetch (only switching active↔archived re-fetches the other set).
That round-trip was the old source of the "click tag/change sort → nothing → results pop
in" lag. The SWR fetcher (and `handleLoadMore`/`handleNextPage`) force `q=''/tags=[]/date=null`
for resident memo so the server returns the unfiltered full set.

Keeping archived resident too is what makes the **tag cloud behave identically in both
views**: because `messages` is never replaced by a server-filtered subset, `allTags`
(derived from `messages`) always shows ALL tags — selecting one filters the note list but
never narrows the cloud. (When archived was server-filtered, clicking a tag re-fetched
only matching notes, so the cloud silently shrank to co-occurring tags — inconsistent
with active.)

Because sort is out of the key, a dedicated effect re-sorts the resident set in place
(`replaceMessages((c) => c, { sort: true, resetPositions: true })`) when sortMode/direction
change — guarded to fire only on a real sort change while resident, never on mount.

**Only guestbook = server-side filtering + pagination.** It keeps tag/search in the SWR
key and re-fetches on change. `filterItems` applies tag/search ONLY when `slug === 'memo'`;
for guestbook it is a no-op for those dims (guestbook only loads a page at a time, so
client-filtering would miss unloaded rows). There is no longer any board that filters
both server- and client-side, so the old case-sensitivity double-filter hazard is gone.

**Sidebar tag counts** are derived client-side from `messages` (`allTags` in
`NoteBoardProvider`), so they reflect the current resident set (active vs archived) and
stay reactive to optimistic create/delete. **Date counts** (`computedDateCounts` /
`memoDateCounts` in `useMemoBoardFilters`) drive the calendar heatmap AND the
"全部便签"/"今日创建" quick-filter counts, which are active-view metrics (clicking them
switches archive OFF) — so memoDateCounts stays anchored to the ACTIVE set even while
archived: it snapshots the active counts (React's adjust-state-during-render pattern) and
freezes the snapshot while `showArchived`. Without this, opening archived would flip
"全部便签" to the archived subset count. The old `/memo/tags` and `/memo/dates` endpoints
(and `getMemoTagCounts`/`getMemoDateCounts`) were REMOVED (they hardcoded `archived: false`).
Only `/memo/agenda` (due items) remains a server endpoint. Counts are bounded by the 500
working-set cap.

**Date semantics: `created_at`.** Both the calendar counts and the client date filter
key off `created_at` (via `getItemDateKey`). The old server date filter used `updated_at`;
removing it (client-only now) unified the two — keep date filtering on `created_at`.

In the sticky board view (`BoardStickyView`), any active filter pulls from
`state.allNoteItems` (the full resident set) instead of the paginated `state.noteItems`,
gated on `filters.isFilterMode` — otherwise client tag/search would only see the
current desktop page of 10.

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

### Memo Habits（重复任务）状态机 — non-obvious semantics

习惯系统横跨 `lib/memo-habits.ts`（纯解析，client-safe）、`lib/memo-habits-server.ts`
（状态机 + Supabase）、`app/api/memo/check-reminders/route.ts`（cron 派发）、
`app/api/note-boards/memo/habits/*`（complete/delay/occurrence API）。只读单个文件
会做错以下决定：

**状态语义 — `delayed` 是终态，不是 open 状态。**
`memo_habit_occurrences.status` 四个落库值的含义：
- `pending` — 唯一的 open 状态。reconcile / `buildCurrentState` / `resolveOrCreateOccurrence`
  / `markSuperseded` 判 open 时只认 `pending`，不要把 `delayed` 加回去。
- `completed` / `missed` — 终态。
- `delayed` — 终态：记录"这一天被跨日推迟走了"（`delayed_to` = 目标时刻），后继的
  open 状态由推迟时插入的新 `pending` 行承载。streak 把 delayed 视为断签
  （"延后不是免罚"），周统计/热图把它与 missed 分开展示。

**推迟语义按上海日历日分叉**（`delayMemoHabitOccurrence`）：
- 同日推迟：原地改 `due_at`，仍 `pending`，统计上不留痕（15 分钟的小推不该有代价）。
- 跨日推迟：先 INSERT 目标日新 `pending` 行、后把当前行标 `delayed`（INSERT-before-PATCH，
  失败时宁可双 open 行自愈也不丢任务）。不要改回写 `missed` —— 那会把"推迟"算成
  "错过"并让延后统计永远为 0（修复前的 bug）。

**事件归因规则**（`getOccurrenceEventTime`）：`completed` → `completed_at`；
`missed`/`delayed` → **`due_at`**（任务所属日），绝不能用 `updated_at` —— reconcile 在
午夜后才把昨天的 pending 标 missed，用 `updated_at` 会把错过记到第二天/下一周
（修复前的已知 bug）。日历热图、本周漏失、completionRate 全部依赖这条规则。

**同日去重必须包含 completed/delayed**（`upsertMemoHabitOccurrenceForReminder`）：
cron 在计划时间为 repeat 习惯建行前，检查当天（上海日）是否已有
`pending`/`delayed`/`completed` 行 —— completed = 今天已提前完成（不建行、不发提醒）、
delayed = 今天已被推迟走（同前）、pending = 同日改了时间（复用该行，提醒展示其实际
`due_at`）。只查 open 行的旧逻辑会在"推迟到次日早上并完成"后于计划时间再建一行，
午夜变 missed 并清零 streak。函数返回 `{ shouldNotify, effectiveDueAt }`，调用方
据此决定是否发 ntfy；**content tag 的推进必须无条件执行**（否则该项每 tick 重触发）。

**取 open 行永远取最早的**（`buildCurrentState` / `resolveOrCreateOccurrence`）：
行按 `due_at` 降序，所以是数组**最后**一个匹配。取最晚会在"今天 + 推迟后继"双 open
行并存时把完成操作打到未来的 occurrence、隐藏今天的 pending。

**itemKey 的时间签名已规范化为 UTC HH:mm**（`getScheduleSignature`，及
`note-boards.ts` 中镜像的 `scheduleSig` —— 两处必须同步改）：用
`new Date(dueAt).toISOString().slice(11,16)` 而非原始字符串 slice，使 `+08:00` 与 `Z`
两种写法得到同一 key（cron 首次推进会把手写 +08:00 重写成 UTC）。对已存量 UTC 数据
key 不变。回归测试在 `tests/unit/memo-habits.test.ts`。

**reconcile 在读之前 await**（`getMemoHabitOverview` / `getMemoHabitItemDetail`）：
客户端在上海午夜恰好 refetch 一次（`scheduleMidnightRefresh`），若用 `after()` 后置
reconcile，这次 refetch 拿到的就是未翻日的数据。reconcile 失败要吞掉降级为读。

**已知死路径（勿当 bug 修，也勿依赖）**：同日推迟会把 `reminder_sent_at` 置 null，
但没有任何派发器按 occurrence 行的时间发提醒（cron 只认 content tag 时间）——
推迟后的新时刻不会有提醒，这是当前设计边界。
