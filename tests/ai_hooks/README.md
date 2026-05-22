# AI Analysis Hook

This directory provides the integration point between the test pipeline and AI agents.

## How It Works

```
pytest --json-report --json-report-file=report.json
         ↓
format_report.py --input report.json --output /tmp/failure-context.md
         ↓
AI agent reads /tmp/failure-context.md
         ↓
Analysis → ntfy notification or PR comment
```

## Connecting Antigravity CLI

In `.github/workflows/tests.yml`, the `ai-analysis` job (runs on failure only) does:

```yaml
- name: Format failure report
  run: |
    python tests/ai_hooks/format_report.py \
      --input tests/ai_hooks/report.json \
      --output /tmp/failure-context.md

- name: Run AI analysis
  run: |
    # Replace this with the actual Antigravity CLI command once confirmed:
    # antigravity run --prompt "$(cat /tmp/failure-context.md)" --output /tmp/analysis.md
    #
    # Or use Claude Code:
    # claude --print "Analyze these test failures and suggest fixes:\n$(cat /tmp/failure-context.md)" > /tmp/analysis.md
    echo "TODO: wire up Antigravity CLI here"
    cat /tmp/failure-context.md

- name: Send analysis to ntfy
  run: |
    if [ -f /tmp/analysis.md ]; then
      curl -s -X POST "$NTFY_URL/$NTFY_TOPIC" \
        -H "Authorization: Bearer $NTFY_TOKEN" \
        -H "Title: AI Test Analysis" \
        -d "$(head -c 4000 /tmp/analysis.md)"
    fi
  env:
    NTFY_URL: ${{ secrets.NTFY_URL }}
    NTFY_TOPIC: ${{ secrets.NTFY_TOPIC }}
    NTFY_TOKEN: ${{ secrets.NTFY_TOKEN }}
```

## Design Principles

- **Not in the hot path** — AI analysis runs only after tests finish, and only on failure.
- **No pass/fail authority** — The AI produces suggestions, not assertions. The test
  results themselves determine CI pass/fail.
- **Pluggable** — The `format_report.py` output is plain Markdown. Any AI agent
  that reads text files can be swapped in here: Antigravity, Claude Code, GPT-4, etc.

## Adding Weekly Test Generation

To have AI suggest new test cases for uncovered endpoints, add a weekly scheduled
job to `tests.yml`:

```yaml
on:
  schedule:
    - cron: '0 3 * * 0'  # Every Sunday 03:00 UTC

jobs:
  suggest-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: |
          # List endpoints without test coverage
          python tests/ai_hooks/suggest_tests.py --scan tests/api/ \
            > /tmp/coverage-gaps.md
          # Feed to AI agent for test skeleton generation
          # antigravity run --prompt "$(cat /tmp/coverage-gaps.md)" > /tmp/new-tests.py
```
