# AI Analysis Hook

This directory provides the integration point between the test pipeline and AI agents.

## AI Nightly Summary Pipeline

Runs after every nightly test run (success or failure). Selects the prompt template
based on job outcome: failures → root-cause analysis; all pass → brief all-clear summary.

```
pytest --junit-xml=tests/ai_hooks/report.xml         (api-tests, always uploaded)
pytest --junit-xml=allure-results/infra-junit.xml    (infra-tests, always uploaded)
         ↓
format_report.py --input report.xml infra-junit.xml --output /tmp/failure-context.md
         ↓ (Choose prompt template)
         │  api-tests/infra-tests failed → prompts/failure_analysis.md
         │  all passed               → prompts/test_summary.md
         ↓ (fills {FAILURE_CONTEXT})
agy --dangerously-skip-permissions -p "$(cat /tmp/failure-analysis-prompt.md)"
         ↓
/tmp/ai-analysis-result.md → ntfy notification
  failure: 🤖 AI Failure Analysis  (priority 3)
  success: 🤖 AI Nightly Summary   (priority 2)
```

`format_report.py` accepts multiple `--input` files (any subset may be missing —
partial artifact downloads are handled gracefully). If no XML is present at all, a
plain-text fallback context is written instead.

## Test Generation Pipeline

```
scan_coverage_gaps.py --since "24 hours ago"   (delta lane)
   └─ if no recent gaps → scan_coverage_gaps.py --all-routes   (full-surface backfill, 5/run)
         ↓ (fills {COVERAGE_GAPS_CONTENT} in prompts/test_gen.md)
agy --add-dir tests/ai_generated/ --dangerously-skip-permissions -p "$(cat /tmp/test-gen-prompt.md)"
         ↓ py_compile + pytest --collect-only
         ↓ validate_test_asserts.py  (reject assertion-free placeholders)
         ↓ require a `# tested-source:` header on every file
git branch ai-tests/<date>-<sha> → gh pr create
```

**Coverage model.** `scan_coverage_gaps.py` computes coverage from the
`# tested-source: <path>` header that test files carry (exact match, and it reads
`tests/ai_generated/` too — so already-covered routes like memo/health are not
regenerated), falling back to the domain word from a test's filename for legacy
header-less tests. `--all-routes` enumerates every `app/api` route (not just
git-changed ones), so routes that were never touched still get backfilled over
time. The header is mandatory on generated files precisely so this dedup works.

## Files

| File | Purpose |
|---|---|
| `format_report.py` | Parse JUnit XML(s) → Markdown for AI consumption |
| `scan_coverage_gaps.py` | Find uncovered `app/api` routes — delta (`--since`) or full-surface (`--all-routes`); header-based coverage index |
| `validate_test_asserts.py` | Assert-gate: reject generated files whose tests assert nothing |
| `test_scan_coverage_gaps.py`, `test_validate_test_asserts.py` | Unit tests for the two hooks above |
| `prompts/failure_analysis.md` | agy prompt template for root-cause analysis (on failure) |
| `prompts/test_summary.md` | agy prompt template for all-clear summary (on success) |
| `prompts/test_gen.md` | agy prompt template for test stub generation |
| `pr_body_template.md` | PR description template for AI-generated test PRs |

## Design Principles

- **Not in the hot path** — AI analysis runs only after tests finish, and only on failure.
- **No pass/fail authority** — The AI produces suggestions, not assertions. Test results
  determine CI pass/fail.
- **Isolated write scope** — `--add-dir tests/ai_generated/` (test gen only) pins where
  agy may write new files. The failure analysis uses only `--dangerously-skip-permissions`
  (no `--add-dir`) because adding a broad path triggers agy to index it, causing brain
  bloat and slowdowns — the prompt already contains all the context agy needs.
- **Pluggable** — `format_report.py` output is plain Markdown. Any AI agent that reads
  text files can be swapped in.
