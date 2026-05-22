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
scan_coverage_gaps.py --since "24 hours ago" --output /tmp/coverage-gaps.md
         ↓ (fills {COVERAGE_GAPS_CONTENT} in prompts/test_gen.md)
agy --add-dir tests/ai_generated/ --dangerously-skip-permissions -p "$(cat /tmp/test-gen-prompt.md)"
         ↓ (py_compile + pytest --collect-only validation)
git branch ai-tests/<date>-<sha> → gh pr create
```

## Files

| File | Purpose |
|---|---|
| `format_report.py` | Parse JUnit XML(s) → Markdown for AI consumption |
| `scan_coverage_gaps.py` | Detect source files changed in last N hours without test coverage |
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
