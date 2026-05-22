"""
Parse pytest JSON report (--json-report) + Allure results and output
a structured Markdown document for AI analysis.

The output format is intentionally simple and verbose so that any
AI agent (Antigravity CLI, Claude Code, GPT, etc.) can consume it
without requiring a custom schema.

Usage:
  pytest --json-report --json-report-file=tests/ai_hooks/report.json ...
  python tests/ai_hooks/format_report.py \\
      --input tests/ai_hooks/report.json \\
      --output /tmp/failure-context.md

Output is written to stdout if --output is omitted.
"""

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path


def format_failure(test: dict) -> str:
    name = test.get("nodeid", "unknown")
    outcome = test.get("outcome", "")
    call = test.get("call", {})
    longrepr = call.get("longrepr", "") or test.get("longrepr", "")

    lines = [f"### `{name}`"]
    lines.append(f"**Outcome:** {outcome}")

    if longrepr:
        lines.append("\n**Traceback:**")
        lines.append("```")
        # Trim very long tracebacks
        lines.append(str(longrepr)[:2000])
        lines.append("```")

    setup = test.get("setup", {})
    if setup.get("outcome") == "error":
        lines.append("\n**Setup Error:**")
        lines.append("```")
        lines.append(str(setup.get("longrepr", ""))[:500])
        lines.append("```")

    return "\n".join(lines)


def build_markdown(report: dict) -> str:
    created = datetime.now(timezone.utc).isoformat()
    summary = report.get("summary", {})

    total = summary.get("total", 0)
    passed = summary.get("passed", 0)
    failed = summary.get("failed", 0)
    error = summary.get("error", 0)
    skipped = summary.get("skipped", 0)
    duration = report.get("duration", 0)

    tests: list[dict] = report.get("tests", [])
    failures = [t for t in tests if t.get("outcome") in ("failed", "error")]

    lines = [
        f"# Test Failure Report",
        f"",
        f"**Generated:** {created}",
        f"**Duration:** {duration:.1f}s",
        f"**Total:** {total} | Passed: {passed} | Failed: {failed} | Error: {error} | Skipped: {skipped}",
        f"",
    ]

    if not failures:
        lines.append("✅ No failures to report.")
        return "\n".join(lines)

    lines.append(f"## Failed Tests ({len(failures)})")
    lines.append("")

    for test in failures:
        lines.append(format_failure(test))
        lines.append("")

    lines.append("---")
    lines.append("## Suggested Analysis Questions")
    lines.append("")
    lines.append("1. Are these failures new (regression) or pre-existing?")
    lines.append("2. Do multiple failures share a common root cause (e.g., auth, network, test data)?")
    lines.append("3. Is there a setup/teardown fixture that may have failed first?")
    lines.append("4. Could this be a timing issue (slow container startup, network timeout)?")
    lines.append("5. What changed in the latest commit that could cause these failures?")

    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(description="Format pytest JSON report for AI analysis")
    parser.add_argument("--input", required=True, help="Path to pytest-json-report output (report.json)")
    parser.add_argument("--output", default=None, help="Output markdown file path (stdout if omitted)")
    args = parser.parse_args()

    input_path = Path(args.input)
    if not input_path.exists():
        print(f"ERROR: Input file not found: {input_path}", file=sys.stderr)
        sys.exit(1)

    with open(input_path) as f:
        report = json.load(f)

    markdown = build_markdown(report)

    if args.output:
        Path(args.output).write_text(markdown)
        print(f"Report written to {args.output}")
    else:
        print(markdown)


if __name__ == "__main__":
    main()
