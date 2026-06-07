# Test Suite Supplement Plan — Arthur's Blog

## 1. Current State

Coverage is shallow and structurally capped. Of ~50 API route handlers only ~7 are meaningfully tested (mostly public reads); every high-risk mutation path is untested, including a genuinely unauthenticated data-loss endpoint (`app/api/items/bulk-delete/route.ts` deletes by id with no auth check). The E2E suite covers the blog reading core well but verifies the app's richest interactive features (guestbook posting, memo habit check-ins, recipe revisions) only as "canvas renders." All 6 Cloudflare workers and all 15 `lib/` pure-logic modules have zero unit coverage because **no JS/TS test runner exists in the repo at all**. (Note: the `if: github.event_name != 'schedule'` guards are **by design** — GitHub's `schedule:` trigger is disabled and the suite is fired by VPS crontab via `workflow_dispatch`, which passes the guards and runs everything incl. teardown. Not a gap.) The single biggest structural reason coverage can't improve is the AI test generator that's meant to fill gaps: it is delta-only, capped at 5 files/day, scoped to `app/api/` only, doesn't count its own output as coverage (causing 5x memo / 3x health duplicates), and gates on `--collect-only` which passes assertion-free skip placeholders (8 already merged). The machinery looks sophisticated but cannot raise absolute coverage.

## 2. Coverage Gap Map

| Area | Surface size | Tested | Untested | Biggest hole |
|---|---|---|---|---|
| API routes | 50 route.ts | ~7 | ~31 | `items/bulk-delete` (no auth, data-loss); entire admin surface; all mutation paths (ratings, reactions, sessions, habits) |
| Pages / E2E | 22 routes | 9 | 10 (4 are soft-archived, not real gaps) | Interactive write paths: guestbook posting, memo habit check-in, recipe revisions, auth submit |
| Workers | 6 edge workers | 0 | 6 | `CommentRateLimiterDurableObject` math + comment-thread cache invalidation; cron sync mode selection; SSRF/CORS allowlists |
| lib/ units | 15 modules | 0 | 15 | `date-format.ts` (16 callers), `memo-due-tags.ts` (every-tick resend loop), `spotify-history-utils.ts` week math |

## 3. Prioritized Supplement Plan

Ordered by (risk × leverage) / effort. Quick high-value wins first.

| # | Item | Area | Risk addressed | Effort | Type |
|---|---|---|---|---|---|
| 1 | ~~Un-gate the nightly cron~~ — **INVALID**: guards are by-design (VPS crontab fires `workflow_dispatch`). Optional only: drop the dead `schedule:` block (lines 4-5) to stop empty grey runs | Pipeline | none (cosmetic) | S | optional cleanup |
| 2 | Add auth-rejection (403) tests for all 7 `app/api/admin/*` routes + `revalidate`, `sessions` POST/PATCH/DELETE — runs with no creds in CI | API | Silent auth-guard regression exposing uploads/deletes/cache-bust | S | new test |
| 3 | Test `POST /api/items/bulk-delete`: 400 on empty/non-array ids, 200 zero-deleted on bogus uuids, + xfail asserting auth SHOULD be required | API | Unauthenticated data-loss endpoint, regression blast-radius | S | new test |
| 4 | Test `PUT /api/ratings`: happy upsert, missing-field 400s, onConflict idempotency | API | Anonymous spoofable score overwrite | S | new test |
| 5 | Stand up vitest unit harness (10-line `vitest.config.ts`, node env, `@`/`./` alias, `"test":"vitest run"`); pin `TZ=Asia/Shanghai`, use fake timers | lib/ + workers | No JS/TS runner exists — blocks ALL unit testing | S | new harness |
| 6 | Unit-test `lib/date-format.ts` (parseBlogFrontmatterDate +08:00 cases, formatStableDate, hasEditedTimestamp 1s threshold) | lib/ | 16-caller fan-in; TZ bugs invisible to tsc | S | new test |
| 7 | Unit-test `lib/memo-due-tags.ts` (parseRepeatSpec `custom:` degradation, parseInlineDueTags, getShanghaiWeekday) | lib/ | Documented every-tick reminder resend loop | S | new test |
| 8 | Add `@cloudflare/vitest-pool-workers` + test `CommentRateLimiterDurableObject` (window reset, alarm reschedule, retryAfter ceil, param clamps) via `runInDurableObject` | Workers | Only abuse-protection on public comment writes | M | new harness + test |
| 9 | Unit-test `workers/spotify-now-playing-worker/now-playing-cache.ts` (idle/standard/near-end SWR=0 branches, ceil clamp 1..5) + refresh-bypass key stripping | Workers | Stale "now playing" UI regression; force-refresh correctness | S | new test |
| 10 | Unit-test SSRF/CORS boundaries: `spotify-image-proxy` isAllowedHostname (reject `scdn.co.attacker.com`, http://) + `wardrobe-supabase-worker` resolveCorsOrigin | Workers | Open-relay SSRF / cross-site Supabase proxy exposure | S | new test |
| 11 | E2E guestbook write journey: compose→color→submit→assert new note card, empty-submit validation, persist-on-reload, rate-limit 429 surfaces | Pages | Core write path could be fully broken, suite stays green | M | new test |
| 12 | E2E memo habit journey: create habit note→check-in→streak increments, double-check-in idempotent, persists on reload | Pages | Feature's reason-to-exist has zero functional coverage | M | new test |
| 13 | Test habit mutation routes (`memo/habits/complete`, `delay`, `occurrence/[id]` DELETE): 403 unauth + happy/validation/404 | API | Data-mutating routes the AI gen never discovered (library_only skip) | M | new test |
| 14 | Unit-test `lib/spotify-history-utils.ts` (buildWeekDayKeys Mon-anchor + Sunday=7, segmentTracksByTime boundaries, formatDateLabel 今天/昨天) | lib/ | Off-by-one silently shows wrong week across dashboard | M | new test |
| 15 | Unit-test `workers/genius-worker` cleanLyrics 5-step pipeline + extractData position-truncation retry + searchGenius artist match | Workers | Brittle string logic degrades lyrics on Genius markup change | M | new test |
| 16 | Unit-test `lib/blog-search.ts` (stripMarkdownToText rules, buildSearchSnippet window, splitHighlightedText) + `lib/spotify-tag-analysis.ts` (aggregate/radar normalize, max>=1 guard) | lib/ | Regex/aggregation silent breakage site-wide | M | new test |
| 17 | Test contact + reaction/emoji writes (`contact` POST, `posts|comments/[id]/reaction|emoji`): happy, missing-identity 400, invalid-emoji 400, 404-not-500 | API | Anonymous spam/abuse + validation regression surface | M | new test |
| 18 | Consolidate the 5 `test_memo_*` duplicates into one parametrized file; add the authorized `check-reminders` happy path (with REMINDER_CHECK_TOKEN) | API | Side-effecting cron path never exercised; wasted runtime | S | new test |
| 19 | Bundle tiny high-fan-in validators: `spotify-img.ts` (11 callers), `note-priority.ts`, `comment-reactions.ts`, `comment-emojis.ts` normalizers | lib/ | Input-validation boundaries on every write | S | new test |
| 20 | E2E auth boundary: invalid-login error renders (no crash), `/admin/settings` unauth → redirect `/` | Pages | Silent auth/redirect regressions | M | new test |

## 4. Nightly Pipeline Improvements

- ~~Remove the schedule guard / make teardown unconditional~~ — **INVALID** (corrected): the guards are intentional; VPS crontab triggers via `workflow_dispatch`, so all jobs incl. teardown run normally. Still valid hygiene, optional: add `rm -f .env.test.local` to teardown, and consider `concurrency: cancel-in-progress: false` so a manually-dispatched run isn't killed mid-flight.
- **[nightly — M]** Stop swallowing full E2E: replace `|| true` (line 269) with a dedicated `continue-on-error` step whose outcome is captured and surfaced as a distinct `E2E-FULL` field in the ntfy summary. Non-blocking should mean "doesn't fail the gate," not "invisible."
- **[nightly — M]** Fix green-but-meaningless signal: upgrade `fmt` to distinguish success/failure/skipped/cancelled, and emit a distinct "Nightly did not run" alert when `api-tests` is skipped/empty rather than a normal ❌.
- **[push-CI — M]** Add a unit-test job (vitest for `lib/`+workers, pytest units) so logic is tested per-push without the container — pairs with harness item #5.
- **[push-CI/nightly — M]** Add coverage: `pytest-cov` (absent from `tests/requirements.txt`) + vitest `--coverage`, upload XML artifact, soft trend. Grounds the AI gen loop in real coverage instead of git-diff heuristics.
- **[nightly — M]** Add API contract/schema assertions to `tests/api` so a 200-with-wrong-shape fails (today any 2xx passes).
- **[push-on-supabase-change — M]** Add a migrations-apply job (throwaway Postgres / Supabase branch applies `supabase/` migrations in order) — currently `supabase/**` is paths-ignored and a bad migration only surfaces in production.
- **[push-CI/weekly — L]** Add non-blocking security scanning (`npm audit --audit-level=high` + `pip-audit` on push; Trivy/CodeQL on weekly-release image) — none today despite many R2/Supabase secrets and `--dangerously-skip-permissions` agent jobs.
- **[nightly — L]** Add a11y (axe-core via pytest-playwright on hero/theme routes) + visual-regression snapshot for the theme/hero paths — directly targets the theme-flash class of bug the project shipped 6 times.

## 5. Fix the AI Generator (the leverage point)

The generator is the reason coverage is *structurally* capped, not just incidentally low. It can churn forever and never raise absolute coverage. Four changes to `tests/ai_hooks/scan_coverage_gaps.py` and the gen pipeline:

1. **Add an absolute full-surface pass (stop being delta-only).** Today it scans `git log --since "24 hours ago"`, `MAX_FILES=5`, `SOURCE_DIRS=('app/api/',)` — so routes unchanged since baseline are *never* targeted, and even `--since "365 days ago"` still stops at 5. Add a separate weekly backfill mode that enumerates every httpx-testable `app/api/` route regardless of git recency and batches the uncovered set across runs. Keep the delta scan as the fast same-day lane. This is the only change that lets the mechanism reach the 14/19 permanently-uncovered domains (admin, comments, contact, genius, me, posts, ratings, sessions, …).

2. **Count `tests/ai_generated/` as coverage.** `build_coverage_index` scans only `tests/api/` + `tests/e2e/` (`TEST_DIRS`), so changelog/health/memo — which live *only* in `ai_generated/` — stay "gaps" forever and get a new file every time the route changes. This is the direct cause of the 5x `test_memo_*`, 3x `test_health_*`, 2x `test_changelog_*` duplicates. Include `ai_generated/` in the index and dedup by the `# tested-source:` path before generating.

3. **Add an "asserts something" quality gate.** Validation is `py_compile` + `pytest --collect-only` — both pass a test whose entire body is `pytest.skip()`. 8 of 18 merged files have zero asserts. AST-scan generated files to require ≥1 assert per non-skipped test, reject files where every test unconditionally skips, and run them against the already-running `:3020` container before opening the PR.

4. **Replace lossy domain-word keying + revisit shallow tests.** `extract_domain_word` uses only `parts[2]`, collapsing 50 routes to 19 words (one `test_blog.py` marks the whole `blog/*` subtree covered); the `startswith/endswith` match is a latent false-positive (a future `test_me.py` would suppress `memo`). Key by full route path with exact matching, make the `# tested-source:` header mandatory, and let prune flag pure skip-placeholders regardless of `lib/` name collisions so the 8 dead files can finally be removed.

5. **(Longer-term) Broaden beyond `app/api/`.** Route `lib/` modules to a pytest-or-vitest unit generator and `components/` to a Playwright generator. Today 58 lib + 171 component files are structurally invisible to self-maintenance.

## 6. Suggested Rollout

**Phase 1 — Week 1: quick wins, unblock the machinery (items #1–7, pipeline S-items).**
Un-gate the cron and fix teardown safety (#1 + teardown bullets) — without this nothing runs. Land the cheap, creds-free API tests (#2 admin/sessions 403, #3 bulk-delete, #4 ratings). Stand up the vitest harness (#5) and ship the two highest-fan-in `lib/` tests (#6 date-format, #7 memo-due-tags). Consolidate memo duplicates (#18).

**Phase 2 — Week 2: harness depth + workers + interactive E2E (items #8–17, #19–20).**
Add `vitest-pool-workers` and test the rate-limiter DO (#8), now-playing cache (#9), SSRF/CORS boundaries (#10), genius lyric logic (#15). Write the interactive E2E journeys (#11 guestbook, #12 memo habits, #20 auth boundary) and the habit mutation API tests (#13). Round out lib units (#14 spotify-history, #16 blog-search/tag-analysis, #19 validators) and the anonymous-write API tests (#17). In parallel add the push-CI unit job + coverage and contract assertions.

**Phase 3 — Week 3: generator overhaul + remaining categories (Section 5 + L pipeline items).**
Implement the full-surface backfill pass, count `ai_generated/` as coverage, add the assert-gate, and fix domain-word keying (Section 5 #1–4). Add migrations-apply, security scanning, and a11y/visual-regression. Defer Section 5 #5 (lib/component generators) to after the API generator is proven.

---

## Week 1 — Progress (landed 2026-06-07)

Item #1 dropped (cron guards are by-design; VPS crontab fires `workflow_dispatch`). Everything else delivered, static-verified (vitest run, `tsc --noEmit`, eslint, `pytest --collect-only`). Live API assertions await the next nightly container run.

| Item | Status | Files |
|---|---|---|
| #3 bulk-delete | ✅ | `tests/api/test_items.py` — 400 validation ×3, bogus-uuid 204 no-op, **strict xfail** for the unauth data-loss gap |
| #2 admin/sessions/revalidate 403 | ✅ | `tests/api/test_admin_auth.py` — 7 admin routes + sessions POST/PATCH/DELETE → 403, revalidate → 401 |
| #4 ratings | ✅ (validation) | `tests/api/test_ratings.py` — missing item_id/author/score → 400, **strict xfail** for unauth write (FK-safe). Happy/idempotency deferred (needs seeded item) |
| #18 check-reminders | ✅ (auth half) | `tests/api/test_memo.py` — wrong/no Bearer token rejected. Happy dispatch not tested (sends ntfy). ai_generated memo dedup deferred to the generator fix (§5 #2) |
| #5 vitest harness | ✅ | `vitest.config.ts`, `package.json` (`test:unit`, vitest devDep) |
| #6 date-format | ✅ | `tests/unit/date-format.test.ts` — 7 cases (parse +08:00, format invalid, 1s edit threshold, year TZ-cross) |
| #7 memo-due-tags | ✅ | `tests/unit/memo-due-tags.test.ts` — repeat-spec, due-tag parse, Shanghai-weekday boundary |

**Bug found by #7 — FIXED** — `parseRepeatSpec('custom:')` did NOT degrade to `once` as its own comment promised: `Number('') === 0` let an empty custom spec through as **day 0 (Sunday)**, a phantom weekly reminder (the "every-tick resend" class). Fixed in `lib/memo-due-tags.ts` by dropping empty tokens (`.filter(Boolean)`) before `Number()`; the test now asserts the degrade directly.

**Run:** unit `npm run test:unit` · API (needs container) `pytest tests/api -q`. The strict xfails (bulk-delete + ratings auth) flip to xpass and fail loudly the moment a guard is added — that's the signal to delete the marker and assert 403.

---

## Week 2 — COMPLETE (2026-06-07)

Three test runners now in play:
- **`npm run test:unit`** — 63 lib + worker-pure unit tests (node, TZ=Asia/Shanghai)
- **`npm run test:workers`** — 17 worker pure-logic tests (node, `workers/*/test/`)
- **`npm --prefix workers/engagement-worker test`** — 6 DurableObject tests (workerd via pool-workers)

| Item | Status | Files |
|---|---|---|
| #14 spotify-history-utils | ✅ | `tests/unit/spotify-history-utils.test.ts` — Monday-anchor week, Sunday=7, hour-boundary segmenting, 今天/昨天 |
| #16 blog-search + tag-analysis | ✅ | `tests/unit/blog-search.test.ts`, `spotify-tag-analysis.test.ts` |
| #19 small validators | ✅ | `tests/unit/note-priority.test.ts`, `spotify-img.test.ts`, `comment-validators.test.ts` |
| #9 now-playing cache | ✅ | `tests/unit/now-playing-cache.test.ts` |
| #13 habit mutation API | ✅ | `tests/api/test_habits.py` — validation 400 + ownership gate (403/404) |
| #17 anonymous-write API | ✅ | `tests/api/test_reactions.py`, `test_contact.py` — identity/emoji validation, 404-not-500 |
| #11/#12/#20 E2E | ✅ (structural) | `tests/e2e/test_guestbook.py`, `test_memo.py`, `test_auth_boundary.py` — full write-sims TODO'd for a live run |
| #10 SSRF/CORS | ✅ | `workers/spotify-image-proxy/test/hostname.test.ts`, `workers/wardrobe-supabase-worker/test/cors.test.ts` (helpers exported) |
| #15 genius lyrics | ✅ | `workers/genius-worker/test/scraper.test.ts` (cleanLyrics/extractData exported) |
| #8 rate-limiter DO | ✅ | `workers/engagement-worker/test/rate-limiter.test.ts` (pool-workers, workerd) |

**Harness notes for the future:**
- New worker pure-logic tests go in `workers/<w>/test/` (outside tsconfig `src`, so `check:workers` is unaffected) and run via the root `test:workers` config.
- The DO test uses `vitest.config.mts` (ESM — pool-workers 0.16 is ESM-only) + the `cloudflareTest()` plugin. `test:workers` excludes engagement-worker so its pool-only test isn't run in the node harness.
- CI wiring (run these three in push-CI / nightly) is a Week-3 pipeline item — not yet added to the workflows.