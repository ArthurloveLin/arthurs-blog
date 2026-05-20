# Recipe Module

Book-style recipe viewer and editor with two visual themes, revision history, and a prerequisite skill graph.

## File Map

```
RecipeBookShell.tsx        — entry: picks BookShell vs PageTurnBookShell based on user theme; lazy-loads both
BookShell.tsx              — "pixel/art-book" theme: two-page spread layout, overlay system
PageTurnBookShell.tsx      — "page-turn" theme: animated page flip shell
book-shell-overlay-context.tsx — context for right-panel overlay (portals right-page content)
book-shell.css / page-turn-book-shell.css — theme-specific CSS

RecipeSpread.tsx           — server component: fetches recipe data, decides view vs edit mode
RecipeSpreadClient.tsx     — client wrapper for RecipeSpread
RecipeSpreadSkeleton.tsx   — loading placeholder matching book layout

RecipeLeftPage.tsx         — view: left page (title, meta, flavor radar, skill tree preview)
RecipeRightPage.tsx        — view: right page (steps, ingredients, links)
RecipeEditLeftPage.tsx     — edit: left page form
RecipeEditRightPage.tsx    — edit: right page form + save actions
recipe-edit-shared.tsx     — shared types/helpers for edit pages

RecipeRevisionArchive.tsx  — revision history panel (rendered as right overlay)
RevisionTimeline.tsx       — timeline UI for revisions
revision-preview.ts        — revision preview type + helper

RecipeSkillGraphPanel.tsx  — prerequisite graph panel (D3-based, via SkillTreeGraph.tsx)
RecipeSkillGraphProvider.tsx — context/data loader for skill graph
SkillTreeGraph.tsx         — D3 force graph renderer
FlavorRadar.tsx            — radar chart for recipe flavor profile

TableOfContentsPage.tsx    — TOC page rendered as left page on recipe list view
RecipeBookmarks (multiple) — tab/bookmark components for navigation within the book

recipe-book-theme-context.tsx — theme type + context
lib/recipes.ts             — all Supabase queries, revision CRUD, skill graph query
```

## Architecture Decisions

### Theme selection
`RecipeBookShell` reads the user's theme from `localStorage` (`recipe-book-shell-theme`). Cookie with the same key is set server-side so SSR can pick the right initial theme without a flash. Two valid values: `'pixel'` (default, BookShell) and `'page-turn'` (PageTurnBookShell). Both shells are dynamically imported (`next/dynamic`) to avoid bundling both upfront.

### Right-panel overlay via context
`BookShell` manages one right-side overlay slot via `BookShellOverlayContext`. Children (e.g., `RecipeRightPage`) can portal arbitrary content into the overlay by calling `setRightOverlay`. Used by revision history panel and skill graph panel to take over the right page without unmounting the spread. The overlay sits inside `isolation: isolate` stacking context — do not change this, it prevents `z-index` conflicts with the page-flip animation.

### Revision system
Each save creates a `recipe_revisions` row in Supabase with:
- `version` (integer, monotonically increasing)
- `change_summary` (optional user-provided string)
- `snapshot` (full recipe JSON at that point in time, nullable)

`revision-preview.ts` defines `RecipeRevisionPreview` — a lightweight type that flattens revision + snapshot for display in `RevisionTimeline`. The snapshot can be null for older revisions where the data was not captured; `buildRevisionPreviews` handles this gracefully.

### Skill graph
Recipes can declare prerequisites linking to other recipes with a `skill_label`. `lib/recipes.ts` builds a graph (nodes + links) cached with `revalidate: false` tagged `recipes-skill-graph`. Invalidated when any recipe changes. D3 force simulation runs client-side only inside `SkillTreeGraph.tsx`.

## Hard Constraints

- `BookShellOverlayProvider` must wrap any content that needs to use `setRightOverlay`. It is provided by `BookShell` — do not add a second provider outside the shell.
- The `isolation: isolate` class on the book container is load-bearing for the page-flip z-index. Do not remove it.
- `revalidate: false` for the skill graph cache is intentional — the graph only changes when a recipe prerequisite is added/removed, both of which call `revalidateTag('recipes-skill-graph')` explicitly.
